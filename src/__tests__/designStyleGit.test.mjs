import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDesignStyles } from '../../scripts/check-design-styles.mjs'
import { designRange, styleSources } from '../../scripts/design-style-git.mjs'

const temporaryRoot = realpathSync(tmpdir())
const directories = []
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function write(root, file, text) {
  const target = join(root, file)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, text)
}
function repository() {
  const root = realpathSync(mkdtempSync(join(temporaryRoot, 'ecl-design-')))
  directories.push(root)
  git(root, 'init', '--quiet')
  git(root, 'config', 'user.email', 'test@example.invalid')
  git(root, 'config', 'user.name', 'Design check fixture')
  git(root, 'config', 'core.autocrlf', 'false')
  git(root, 'config', 'commit.gpgsign', 'false')
  write(root, 'scripts/design-style-exceptions.json', '{"exceptions":[]}')
  write(root, 'src/Example.css', '.card { color: white; }')
  const first = save(root)
  return { root, first }
}
function save(root) {
  git(root, 'add', '--all')
  git(root, 'commit', '--quiet', '-m', 'fixture')
  return git(root, 'rev-parse', 'HEAD')
}
const check = (root, options = {}) => checkDesignStyles(root, options, {})

afterEach(() => {
  for (const directory of directories.splice(0).reverse()) {
    const actual = realpathSync(directory)
    if (dirname(actual) !== temporaryRoot || !actual.split(/[\\/]/).at(-1).startsWith('ecl-design-'))
      throw new Error('拒绝清理非本测试创建的目录')
    rmSync(actual, { recursive: true, force: true })
  }
})

describe('本地增量样式检查', () => {
  it('未改的历史声明不阻塞；同时覆盖暂存、未暂存和未跟踪文件', () => {
    const { root } = repository()
    expect(check(root).failures).toEqual([])
    write(root, 'src/Example.css', '.card {color:red}')
    git(root, 'add', 'src/Example.css')
    write(root, 'src/Second.css', '.second{color:blue}')
    git(root, 'add', 'src/Second.css')
    write(root, 'src/Second.css', '.second{color:purple}')
    write(root, 'src/新 面板.vue', '<template><div /></template><style>.new{color:#fff}</style>')
    const result = check(root)
    expect(result.changed).toHaveLength(3)
    expect(result.failures.map((item) => item.value).sort()).toEqual(['#fff', 'purple', 'red'])
    expect(readFileSync(join(root, 'src/Example.css'), 'utf8')).toContain('red')
  })

  it('删除不触发新违规；重命名和复制的旧色仍然受检', () => {
    const { root } = repository()
    renameSync(join(root, 'src/Example.css'), join(root, 'src/Renamed.css'))
    expect(check(root).failures).toHaveLength(1)
    rmSync(join(root, 'src/Renamed.css'))
    expect(check(root).failures).toEqual([])
    expect(check(root).changed).toEqual(['src/Example.css'])
  })

  it('生成文件和产品源目录以外的文件不纳入扫描', () => {
    const { root } = repository()
    write(root, 'src/generated/Generated.css', '.card{color:red}')
    write(root, 'dist/Output.css', '.card{color:red}')
    expect(check(root).files).toBe(1)
    expect(check(root).changed).toEqual([])
  })

  it('当前样式语法错误和损坏例外文件都必须失败', () => {
    const { root } = repository()
    write(root, 'src/Example.css', '.card {')
    expect(() => check(root)).toThrow()
    write(root, 'src/Example.css', '.card{}')
    write(root, 'scripts/design-style-exceptions.json', '{}')
    expect(() => check(root)).toThrow()
  })
})

describe('CI 提交范围', () => {
  it('干净 checkout 仍检查提交差异，不能只看空工作区', () => {
    const { root, first } = repository()
    write(root, 'src/Example.css', '.card {color:red}')
    const target = save(root)
    expect(git(root, 'status', '--porcelain')).toBe('')
    expect(check(root).failures).toEqual([])
    const result = check(root, { base: first, target })
    expect(result.range.source).toBe('frontend-commits')
    expect(result.failures).toHaveLength(1)
    expect(designRange(root, {}, { CI: 'true', ECL_DESIGN_BASE: first, ECL_DESIGN_TARGET: target })).toMatchObject({
      base: first,
      target,
    })
  })

  it('不能用不完整的 CI 输入、零摘要、缺失对象或空基线通过', () => {
    const { root, first } = repository()
    expect(() => designRange(root, {}, { CI: 'true' })).toThrow()
    expect(() => designRange(root, {}, { CI: 'true', ECL_DESIGN_BASE: first })).toThrow()
    expect(() => check(root, { base: '0'.repeat(40) })).toThrow()
    expect(() => check(root, { base: 'f'.repeat(40) })).toThrow()
    expect(() => check(root, { base: '--help' })).toThrow()
    expect(() => check(root, { base: 'HEAD~9999' })).toThrow()
  })

  it('目标提交必须读取其自身例外，不能借工作区文件放行', () => {
    const { root, first } = repository()
    write(root, 'src/Example.css', '.card{color:red}')
    const target = save(root)
    write(root, 'scripts/design-style-exceptions.json', '{}')
    expect(check(root, { base: first, target }).failures).toHaveLength(1)
    expect(() => check(root)).toThrow()
  })

  it('新分支首次 push 使用默认分支共同祖先，缺失历史仍失败', () => {
    const { root, first } = repository()
    git(root, 'update-ref', 'refs/remotes/origin/main', first)
    write(root, 'src/Example.css', '.card{color:red}')
    const target = save(root)
    const environment = {
      CI: 'true',
      ECL_DESIGN_BASE: '0'.repeat(40),
      ECL_DESIGN_TARGET: target,
      ECL_DESIGN_DEFAULT_BRANCH: 'main',
    }
    expect(designRange(root, {}, environment)).toMatchObject({ base: first, target })
    expect(() => designRange(root, {}, { ...environment, ECL_DESIGN_DEFAULT_BRANCH: 'missing' })).toThrow()
    git(root, 'update-ref', 'refs/remotes/origin/main', target)
    expect(() => designRange(root, {}, environment)).toThrow(/首次 push/)
  })

  it('主仓库范围按前后 gitlink 取前端提交，忽略前端空工作区', () => {
    const { root: frontend, first } = repository()
    write(frontend, 'src/Example.css', '.card{color:red}')
    const target = save(frontend)
    const { root: parent } = repository()
    git(parent, 'update-index', '--add', '--cacheinfo', `160000,${first},frontend`)
    git(parent, 'commit', '--quiet', '-m', 'first gitlink')
    const baseParent = git(parent, 'rev-parse', 'HEAD')
    git(parent, 'update-index', '--cacheinfo', `160000,${target},frontend`)
    git(parent, 'commit', '--quiet', '-m', 'new gitlink')
    const targetParent = git(parent, 'rev-parse', 'HEAD')
    const result = check(frontend, { base: baseParent, target: targetParent, superproject: parent })
    expect(result.range).toEqual({ base: first, target, source: 'superproject-gitlinks' })
    expect(result.failures).toHaveLength(1)
  })

  it('缺失或错误类型的主仓库 gitlink 不能当作无变化', () => {
    const { root: frontend } = repository()
    const { root: parent, first } = repository()
    expect(() => check(frontend, { base: first, target: first, superproject: parent })).toThrow(/gitlink/)
    write(parent, 'frontend/not-a-submodule.css', '')
    const target = save(parent)
    expect(() => check(frontend, { base: target, target, superproject: parent })).toThrow(/gitlink/)
  })

  it('Git 文件来源读取真实提交内容，路径与提交输入不交给 shell', () => {
    const { root, first } = repository()
    write(root, 'src/Example.css', '.card{color:red}')
    expect(styleSources(root, first).get('src/Example.css')).toContain('white')
    expect(styleSources(resolve(root)).get('src/Example.css')).toContain('red')
  })
})
