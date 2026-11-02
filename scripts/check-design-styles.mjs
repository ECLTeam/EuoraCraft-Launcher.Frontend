import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { designRange, exceptionsSource, styleSources } from './design-style-git.mjs'
import { addedFindings, analyzeStyles, applyExceptions, designRuleMessages } from './design-style-rules.mjs'

export function checkDesignStyles(directory, options = {}, environment = process.env) {
  const range = designRange(directory, options, environment)
  const previous = styleSources(directory, range.base)
  const current = styleSources(directory, range.target)
  const oldFindings = [...previous].flatMap(([file, source]) => analyzeStyles(file, source))
  const allFindings = [...current].flatMap(([file, source]) => analyzeStyles(file, source))
  const added = addedFindings(oldFindings, allFindings)
  const failures = applyExceptions(added, allFindings, exceptionsSource(directory, range.target))
  const changed = [...new Set([...previous.keys(), ...current.keys()])].filter(
    (file) => previous.get(file) !== current.get(file)
  )
  return {
    range,
    failures,
    changed,
    files: current.size,
    added: added.length,
    excepted: added.length - failures.length,
  }
}

function main() {
  try {
    const options = {}
    const fields = new Map([
      ['--base', 'base'],
      ['--target', 'target'],
      ['--superproject', 'superproject'],
    ])
    const args = process.argv.slice(2)
    for (let index = 0; index < args.length; index += 2) {
      const field = fields.get(args[index])
      if (!field || !args[index + 1] || options[field])
        throw new Error('参数应为 --base/--target/--superproject 及其值')
      options[field] = args[index + 1]
    }
    const root = realpathSync(resolve(import.meta.dirname, '..'))
    const result = checkDesignStyles(root, options)
    console.log(
      `设计检查：来源：${result.range.source}；基线：${result.range.base.slice(0, 12)}；目标：${result.range.target?.slice(0, 12) ?? '工作区'}；解析文件：${result.files}；变更文件：${result.changed.length}；新增命中：${result.added}；有效例外：${result.excepted}`
    )
    for (const finding of result.failures) {
      console.error(`${finding.file}:${finding.line} [${finding.rule}] ${designRuleMessages[finding.rule]}`)
      console.error(`  context: ${finding.context}; property: ${finding.property}`)
    }
    if (result.failures.length) process.exitCode = 1
    else console.log(result.changed.length ? '设计检查通过。' : '无受管样式变更；已解析当前文件并核对例外。')
  } catch (error) {
    console.error(`设计检查失败：${error.message}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
