import { createRequire } from 'node:module'
import { posix } from 'node:path'
import postcss from 'postcss'

// 在 Node 工具边界加载 Vue 官方解析器，避免产品 Vite 的 vue 运行时别名改写编译器子路径。
const { parse: parseSfc } = createRequire(import.meta.url)('vue/compiler-sfc')

const colorNames = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood
  cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
  darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
  firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew
  hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
  mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
  midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
  rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
  whitesmoke yellow yellowgreen`
    .split(/\s+/)
    .filter(Boolean)
)

const tokenSources = new Set(['base.css', 'tokens.css', 'folia.css', 'main.css'].map((name) => `src/styles/${name}`))
const ruleNames = new Set(['literal-color', 'literal-motion', 'keyframe-owner', 'important-owner'])

export const designRuleMessages = {
  'literal-color': '使用现有语义颜色变量；内容固有颜色请说明归属并登记精确例外。',
  'literal-motion': '使用现有 duration/easing 变量；零时长关闭效果允许直接表达。',
  'keyframe-owner': '公共关键帧归入 src/styles/animations.css。',
  'important-owner': '确认级联和所有权边界，移除 !important 或登记有期限的精确例外。',
}

function unescapeCss(value) {
  return value.replace(/\\([\da-f]{1,6})\s?|\\([^\r\n])/gi, (_match, hex, character) =>
    hex ? String.fromCodePoint(Number.parseInt(hex, 16) || 0xfffd) : character
  )
}

// 只解析 CSS 值，不把字符串、注释或资源 URL 中的颜色当作样式声明。
function valueTokens(value) {
  const tokens = []
  let index = 0
  while (index < value.length) {
    const rest = value.slice(index)
    if (rest.startsWith('/*')) {
      const end = value.indexOf('*/', index + 2)
      if (end < 0) throw new Error('CSS 值中存在未结束的注释')
      index = end + 2
    } else if (value[index] === '"' || value[index] === "'") {
      const quote = value[index++]
      let closed = false
      while (index < value.length) {
        if (value[index++] === '\\') index++
        else if (value[index - 1] === quote) {
          closed = true
          break
        }
      }
      if (!closed) throw new Error('CSS 值中存在未结束的字符串')
    } else {
      const word = rest.match(/^(?:[-_a-z]|\\[\da-f]{1,6}\s?|\\.)[\w-]*(?:(?:\\[\da-f]{1,6}\s?|\\.)[\w-]*)*/i)
      if (word) {
        const name = unescapeCss(word[0]).toLowerCase()
        index += word[0].length
        if (value[index] === '(') {
          const start = ++index
          let depth = 1
          let quote = ''
          while (index < value.length && depth > 0) {
            if (!quote && value.startsWith('/*', index)) {
              const end = value.indexOf('*/', index + 2)
              if (end < 0) throw new Error('CSS 函数中存在未结束的注释')
              index = end + 2
              continue
            }
            const character = value[index++]
            if (character === '\\') index++
            else if (quote) {
              if (character === quote) quote = ''
            } else if (character === '"' || character === "'") quote = character
            else if (character === '(') depth++
            else if (character === ')') depth--
          }
          if (depth) throw new Error('CSS 值中存在未结束的函数')
          const content = value.slice(start, index - 1)
          if (name !== 'url') {
            tokens.push({ name, content, function: true })
            tokens.push(...valueTokens(content))
          }
        } else tokens.push({ name, function: false })
      } else {
        const literal = rest.match(/^(?:#[\da-f]+|[+-]?(?:\d*\.\d+|\d+)(?:ms|s)\b)/i)
        if (literal) {
          tokens.push({ name: literal[0].toLowerCase(), function: false })
          index += literal[0].length
        } else index++
      }
    }
  }
  return tokens
}

function normalizedCss(text) {
  return text
    .split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/)/g)
    .map((part) => {
      if (part.startsWith('/*')) return ''
      if (part.startsWith('"') || part.startsWith("'")) return part
      return part.replace(/\s+/g, ' ').replace(/\s*([,():;>+~])\s*/g, '$1')
    })
    .join('')
    .trim()
}

function contextOf(node, block) {
  const ancestors = []
  for (let current = node.parent; current?.type !== 'root'; current = current?.parent) {
    if (!current) break
    if (current.type === 'rule') ancestors.unshift(normalizedCss(current.selector))
    else if (current.type === 'atrule') ancestors.unshift(normalizedCss(`@${current.name} ${current.params}`))
  }
  return JSON.stringify([block, ...ancestors])
}

function ownsToken(file, node) {
  if (!tokenSources.has(file) || !node.prop.startsWith('--')) return false
  const parent = node.parent
  if (parent.type === 'atrule') return file === 'src/styles/main.css' && parent.name === 'theme'
  return (
    parent.type === 'rule' &&
    parent.selector
      .split(',')
      .every((selector) => /^(?::root|\[data-(?:theme|ui-skin)\s*=\s*['"][\w-]+['"]\])$/.test(selector.trim()))
  )
}

function nodeRules(file, node) {
  if (node.type === 'atrule')
    return /^(?:-webkit-)?keyframes$/i.test(node.name) && file !== 'src/styles/animations.css' ? ['keyframe-owner'] : []
  if (node.type !== 'decl') return []
  const rules = []
  const property = unescapeCss(node.prop).toLowerCase()
  const tokens = valueTokens(node.value)
  if (!ownsToken(file, node)) {
    const colorProperty = /color|background|border|shadow|fill|stroke|outline|column-rule/.test(property)
    if (
      (colorProperty || property.startsWith('--')) &&
      tokens.some(
        (token) =>
          token.name.startsWith('#') ||
          (!token.function && colorNames.has(token.name)) ||
          (token.function &&
            /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk)$/.test(token.name) &&
            !/\bvar\s*\(/i.test(unescapeCss(token.content)))
      )
    )
      rules.push('literal-color')
    if (
      (/^(?:-webkit-)?(?:transition|animation)(?:$|-(?:duration|delay|timing-function)$)/.test(property) ||
        property.startsWith('--')) &&
      tokens.some(
        (token) =>
          (/^[+-]?(?:\d*\.\d+|\d+)(?:ms|s)$/.test(token.name) && Number.parseFloat(token.name) !== 0) ||
          /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|steps|cubic-bezier)$/.test(token.name)
      )
    )
      rules.push('literal-motion')
  }
  if (node.important) rules.push('important-owner')
  return rules
}

/** 分析当前源码；旧版和新版都走同一解析路径，错误必须显式失败。 */
export function analyzeStyles(file, source) {
  let blocks = [{ content: source, offset: 0, identity: 'css' }]
  if (file.endsWith('.vue')) {
    const { descriptor, errors } = parseSfc(source, { filename: file })
    if (errors.length) throw new Error(`${file}: Vue SFC 解析失败`)
    blocks = descriptor.styles.map((style, index) => {
      if (style.lang && style.lang !== 'css') throw new Error(`${file}: 尚未支持此样式语言，不能跳过检查`)
      if (style.src && !/^(?:@\/styles\/|\.\.?\/).*\.css$/.test(style.src))
        throw new Error(`${file}: 外部 style 必须指向项目内 CSS`)
      if (style.src) {
        const target = style.src.startsWith('@/')
          ? posix.normalize(`src/${style.src.slice(2)}`)
          : posix.normalize(posix.join(posix.dirname(file), style.src))
        if (!target.startsWith('src/') || target.includes('\\')) throw new Error(`${file}: 外部 style 超出受管源码目录`)
      }
      return {
        content: style.content,
        offset: style.loc.start.line - 1,
        identity: `style:${index}:${style.scoped ? 'scoped' : 'global'}:${style.module || ''}`,
      }
    })
  }
  const findings = []
  for (const block of blocks) {
    let root
    try {
      root = postcss.parse(block.content, { from: file })
    } catch {
      throw new Error(`${file}: CSS 解析失败，无法完成设计检查`)
    }
    root.walk((node) => {
      for (const rule of nodeRules(file, node)) {
        findings.push({
          file,
          rule,
          context: contextOf(node, block.identity),
          property: node.type === 'decl' ? node.prop : `@${node.name}`,
          value: node.type === 'decl' ? `${node.value}${node.important ? ' !important' : ''}` : node.params,
          line: node.source.start.line + block.offset,
        })
      }
    })
  }
  return findings
}

export function findingKey(finding) {
  return JSON.stringify([finding.file, finding.rule, finding.context, finding.property, normalizedCss(finding.value)])
}

/** 重复次数也参与比较，复制旧违规或移动到其他规则不能借旧记录获得豁免。 */
export function addedFindings(previous, current) {
  const counts = new Map()
  for (const item of previous) counts.set(findingKey(item), (counts.get(findingKey(item)) ?? 0) + 1)
  return current.filter((item) => {
    const key = findingKey(item)
    const count = counts.get(key) ?? 0
    if (!count) return true
    counts.set(key, count - 1)
    return false
  })
}

/** 精确例外有期限且必须对应唯一现存声明；空、过期或扩大范围均失败。 */
export function applyExceptions(added, current, payload, today = new Date().toISOString().slice(0, 10)) {
  if (!payload || Object.keys(payload).join() !== 'exceptions' || !Array.isArray(payload.exceptions))
    throw new Error('样式例外文件必须仅包含 exceptions 数组')
  const allowed = new Set()
  const fields = ['file', 'rule', 'context', 'property', 'value', 'reason', 'owner', 'expires']
  for (const entry of payload.exceptions) {
    if (
      !entry ||
      Object.keys(entry).length !== fields.length ||
      !fields.every((key) => typeof entry[key] === 'string' && entry[key].trim()) ||
      !/^src\/(?!.*(?:\.\.|[*?\\]))[^\0]+\.(?:css|vue)$/.test(entry.file) ||
      !ruleNames.has(entry.rule) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) ||
      !Number.isFinite(Date.parse(entry.expires)) ||
      new Date(entry.expires).toISOString().slice(0, 10) !== entry.expires ||
      entry.expires < today
    )
      throw new Error('样式例外字段无效或已经过期')
    const key = findingKey(entry)
    if (allowed.has(key) || current.filter((item) => findingKey(item) === key).length !== 1)
      throw new Error(`样式例外未匹配唯一现存声明：${entry.file} [${entry.rule}]`)
    allowed.add(key)
  }
  return added.filter((item) => !allowed.has(findingKey(item)))
}
