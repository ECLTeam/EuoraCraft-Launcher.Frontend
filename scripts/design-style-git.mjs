import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

function git(directory, args) {
  try {
    return execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch {
    throw new Error('无法读取设计检查所需的 Git 对象；请获取指定基线及目标提交后重试')
  }
}

function commit(directory, reference) {
  if (typeof reference !== 'string' || !reference || reference.startsWith('-') || /^0+$/.test(reference))
    throw new Error('设计检查必须提供有效提交基线；首次 push 或手动 CI 请明确指定基线')
  return git(directory, ['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`]).trim()
}

function treeEntries(directory, revision, prefix) {
  return git(directory, ['ls-tree', '-r', '-z', revision, '--', prefix])
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf('\t')
      const [mode, type, hash] = entry.slice(0, tab).split(' ')
      return { mode, type, hash, file: entry.slice(tab + 1) }
    })
}

function frontendCommit(directory, revision) {
  const entry = treeEntries(directory, revision, 'frontend').find((item) => item.file === 'frontend')
  if (!entry || entry.mode !== '160000' || entry.type !== 'commit')
    throw new Error('主仓库提交没有有效的 frontend gitlink；不能推断空覆盖')
  return entry.hash
}

function ensureFrontendCommit(directory, hash, fetchMissing) {
  try {
    return commit(directory, hash)
  } catch (error) {
    if (!fetchMissing) throw error
    // 只取主仓库已记录的完整 SHA，不把请求输入拼接到 shell 或改变工作区。
    if (!/^[\da-f]{40}$/.test(hash)) throw new Error('前端 gitlink 不是完整提交摘要', { cause: error })
    git(directory, ['fetch', '--no-tags', 'origin', hash])
    return commit(directory, hash)
  }
}

/** 本地检查工作区；CI 必须比较提交，防止干净 checkout 产生假通过。 */
export function designRange(directory, options = {}, environment = process.env) {
  const isCi = environment.GITHUB_ACTIONS === 'true' || environment.CI === 'true' || environment.CI === '1'
  let base = options.base ?? environment.ECL_DESIGN_BASE
  const target = options.target ?? environment.ECL_DESIGN_TARGET
  const parent = options.superproject ?? environment.ECL_DESIGN_SUPERPROJECT
  if (base && /^0+$/.test(base) && isCi && environment.ECL_DESIGN_DEFAULT_BRANCH) {
    const repository = parent ? resolve(directory, parent) : directory
    const targetHash = commit(repository, target)
    const branch = environment.ECL_DESIGN_DEFAULT_BRANCH
    if (!/^[\w][\w./-]*$/.test(branch) || branch.includes('..')) throw new Error('默认分支名称无效')
    const defaultHash = commit(repository, `refs/remotes/origin/${branch}`)
    base = git(repository, ['merge-base', targetHash, defaultHash]).trim()
    if (base === targetHash) throw new Error('首次 push 无法确定独立变更范围；请手动指定设计检查基线')
  }
  if (!base && isCi) throw new Error('CI 必须设置 ECL_DESIGN_BASE，不能只检查空工作区')
  if (!target && isCi) throw new Error('CI 必须设置 ECL_DESIGN_TARGET')
  if (parent) {
    if (!base || !target) throw new Error('主仓库模式必须提供前后提交')
    const parentPath = resolve(directory, parent)
    const baseHash = frontendCommit(parentPath, commit(parentPath, base))
    const targetHash = frontendCommit(parentPath, commit(parentPath, target))
    return {
      base: ensureFrontendCommit(directory, baseHash, isCi),
      target: ensureFrontendCommit(directory, targetHash, isCi),
      source: 'superproject-gitlinks',
    }
  }
  return {
    base: commit(directory, base || 'HEAD'),
    target: target ? commit(directory, target) : null,
    source: target ? 'frontend-commits' : 'frontend-worktree',
  }
}

export function isStyleSource(file) {
  return file.startsWith('src/') && !file.startsWith('src/generated/') && /\.(?:css|vue)$/.test(file)
}

/** 读取完整当前集合用于解析和校验例外；增量比较由声明的身份与重复次数完成。 */
export function styleSources(directory, revision = null) {
  const sources = new Map()
  if (revision) {
    for (const entry of treeEntries(directory, revision, 'src')) {
      if (!isStyleSource(entry.file)) continue
      if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode))
        throw new Error(`样式来源必须是普通文件：${entry.file}`)
      sources.set(entry.file, git(directory, ['cat-file', 'blob', entry.hash]))
    }
  } else {
    const files = git(directory, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'src'])
    for (const file of new Set(files.split('\0').filter(isStyleSource))) {
      const filePath = resolve(directory, file)
      let stat
      try {
        stat = lstatSync(filePath)
      } catch (error) {
        if (error.code === 'ENOENT') continue
        throw error
      }
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`样式来源必须是普通文件：${file}`)
      const physical = relative(realpathSync(directory), realpathSync(filePath)).split(sep).join('/')
      if (!physical.startsWith('src/')) throw new Error(`样式来源超出项目目录：${file}`)
      sources.set(file, readFileSync(filePath, 'utf8'))
    }
  }
  return sources
}

export function exceptionsSource(directory, revision = null) {
  const file = 'scripts/design-style-exceptions.json'
  if (!revision) return JSON.parse(readFileSync(resolve(directory, file), 'utf8'))
  return JSON.parse(git(directory, ['show', `${revision}:${file}`]))
}
