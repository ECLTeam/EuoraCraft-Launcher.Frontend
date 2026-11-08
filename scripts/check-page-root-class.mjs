// 页面根类检查：src/views 下的页面根元素必须落到公共页面骨架上，不能自建根类。
// 与增量样式检查不同，本检查每次都核对全量视图，否则存量违规永远不会再次触发。
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, posix, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { parse: parseSfc } = createRequire(import.meta.url)('vue/compiler-sfc')

// 这些布局与弹层组件自带页面骨架，由组件内部消费 ecl-page，调用方不必重复声明。
const layoutShells = new Set(['SectionLayout', 'FullscreenModal', 'Modal', 'ConfirmDialog', 'ErrorModal'])
const acceptedRootClasses = new Set(['ecl-page', 'tab-pane'])

// 待迁移清单：迁移到公共骨架后必须同步删除对应条目，否则本检查失败。
// 目标形态见 docs/ECL_DESIGN_SYSTEM.md 第 8 章「页面根类收敛清单」。
const pendingMigration = new Set([
  'src/views/Download.vue',
  'src/views/Game.vue',
  'src/views/Instances.vue',
  'src/views/instances/InstancesTab.vue',
  'src/views/instances/ManageTab.vue',
  'src/views/instances/RunningInstancesTab.vue',
  'src/views/more/ToolsTab.vue',
])

function listVueFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listVueFiles(path))
    else if (entry.name.endsWith('.vue')) files.push(path)
  }
  return files
}

function staticClasses(element) {
  const classes = new Set()
  for (const prop of element.props ?? []) {
    const name = prop.type === 7 ? prop.name : prop.name
    const isClassBinding = prop.type === 7 ? name === 'bind' && prop.arg?.content === 'class' : name === 'class'
    if (!isClassBinding) continue
    const value = prop.type === 7 ? prop.exp?.content : prop.value?.content
    if (typeof value !== 'string') continue
    // 只接受字面量形式；动态拼接无法静态判定，按未通过处理。
    const literal = prop.type === 7 ? value.match(/^(['"`])([\s\S]*)\1$/) : [null, null, value]
    if (!literal) continue
    const text = literal[2]
    if (literal[1] === '`' && text.includes('${')) continue
    for (const token of text.split(/\s+/)) if (token) classes.add(token)
  }
  return classes
}

/**
 * 判定单个视图文件的根元素是否符合页面骨架约定。
 *
 * 只看模板根元素：根元素是布局壳组件时由壳内部负责骨架，根元素带
 * ecl-page 或 tab-pane 时视为已落到公共骨架。动态 class 无法静态判定，
 * 一律按未通过处理，避免靠字符串拼接绕过检查。
 *
 * :param file: 仓库内相对路径，用于报告和待迁移清单比对
 * :param source: 该 .vue 文件的源码
 * :return: {ok: true} 或 {ok: false, reason: string}
 */
export function checkViewRoot(file, source) {
  const { descriptor, errors } = parseSfc(source, { filename: file })
  if (errors.length) throw new Error(`${file}: Vue SFC 解析失败`)
  const root = descriptor.template?.ast?.children?.find((node) => node.type === 1)
  if (!root) throw new Error(`${file}: 模板缺少根元素`)
  if (layoutShells.has(root.tag)) return { ok: true }
  const classes = staticClasses(root)
  if ([...acceptedRootClasses].some((name) => classes.has(name))) return { ok: true }
  const declared = [...classes].join(' ') || '(无 class)'
  return { ok: false, reason: `根元素 <${root.tag} class="${declared}"> 未使用 ecl-page 或 tab-pane` }
}

/**
 * 全量核对 src/views 下的视图，并验证待迁移清单没有过期条目。
 *
 * :param directory: 前端仓库根目录
 * :return: {checked, violations, pending, stale, unexpected}
 *   violations 为全部不符合项；pending 为清单内已确认的存量；
 *   stale 为已修复但仍留在清单里的条目；unexpected 为清单外的新增不符合项。
 */
export function checkPageRoots(directory) {
  const viewsDirectory = join(directory, 'src/views')
  const files = listVueFiles(viewsDirectory)
    .map((path) => posix.normalize(relative(directory, path).split('\\').join('/')))
    .sort()
  const violations = []
  for (const file of files) {
    const result = checkViewRoot(file, readFileSync(join(directory, file), 'utf8'))
    if (!result.ok) violations.push({ file, reason: result.reason })
  }
  const violating = new Set(violations.map((item) => item.file))
  return {
    checked: files.length,
    violations,
    pending: violations.filter((item) => pendingMigration.has(item.file)),
    stale: [...pendingMigration].filter((file) => !violating.has(file)).sort(),
    unexpected: violations.filter((item) => !pendingMigration.has(item.file)),
  }
}

function main() {
  try {
    const root = resolve(import.meta.dirname, '..')
    const result = checkPageRoots(root)
    console.log(
      `页面根类检查：解析视图：${result.checked}；不符合：${result.violations.length}；待迁移：${result.pending.length}；清单外新增：${result.unexpected.length}；过期条目：${result.stale.length}`
    )
    for (const item of result.unexpected) console.error(`新增不符合：${item.file} ${item.reason}`)
    for (const file of result.stale) console.error(`待迁移清单已过期，请删除该条目：${file}`)
    if (result.unexpected.length || result.stale.length) process.exitCode = 1
    else console.log('页面根类检查通过。')
  } catch (error) {
    console.error(`页面根类检查失败：${error.message}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
