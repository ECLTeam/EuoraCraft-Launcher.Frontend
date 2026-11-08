import { describe, expect, it } from 'vitest'
import { addedFindings, analyzeStyles, applyExceptions } from '../../scripts/design-style-rules.mjs'

const css = (source, file = 'src/styles/views/Example.css') => analyzeStyles(file, source)
const rules = (source) => css(source).map((item) => item.rule)

describe('新增样式约束', () => {
  it.each([
    '.card {color:#fff}',
    '.card {background:linear-gradient(red, var(--ecl-surface))}',
    '.card {box-shadow:0 2px 4px rgba(0,0,0,.2)}',
    '.card {--private-color:oklch(.7 .2 200)}',
    '.card {color:var(--ecl-text, white)}',
    '.card {color:r\\65 d}',
    '.card {color:rgb(255 0 0)}',
  ])('拒绝新颜色及其变体：%s', (source) => {
    expect(rules(source)).toContain('literal-color')
  })

  it('允许主题派生色、内容字符串、URL、关键字和非颜色几何', () => {
    expect(
      rules(`.card { color:var(--ecl-text); border:1px solid currentColor;
        background:rgba(var(--primary-rgb) /* ) white #fff */, .2); outline-color:transparent;
        content:'white #fff'; background-image:url("data:image/svg+xml,#fff");
        font-family:'red'; border-radius:50%; margin:0; /* color: red */ }`)
    ).toEqual([])
  })

  it('主题来源只拥有自身变量定义，不豁免普通组件声明', () => {
    expect(css(':root {--ecl-surface: #fff}', 'src/styles/tokens.css')).toEqual([])
    expect(css('[data-ui-skin="folia"] {--ecl-surface: rgba(255,255,255,.5)}', 'src/styles/folia.css')).toEqual([])
    expect(css('@theme {--color-neutral-50:#fafafa}', 'src/styles/main.css')).toEqual([])
    expect(css('.card {color:white}', 'src/styles/tokens.css')[0].rule).toBe('literal-color')
    expect(css('.card {--ecl-text:white}', 'src/styles/tokens.css')[0].rule).toBe('literal-color')
  })

  it.each([
    '.card {transition: opacity .3s ease}',
    '.card {animation: spin 1s linear infinite}',
    '.card {animation-delay:-20ms}',
    '.card {transition-timing-function:cubic-bezier(0,0,1,1)}',
    '.card {transition-duration:var(--duration-normal, 250ms)}',
    '.card {animation-timing-function:steps(4)}',
    '.card {--page-duration:2s; transition:opacity var(--page-duration)}',
  ])('拒绝非令牌动效：%s', (source) => {
    expect(rules(source)).toContain('literal-motion')
  })

  it('允许现有动效变量与关闭效果，关键帧只在公共入口定义', () => {
    expect(
      rules(
        '.card {transition:opacity var(--duration-fast) var(--ease-emphasized); animation:none; transition-delay:0s}'
      )
    ).toEqual([])
    expect(rules('@keyframes wiggle { to {transform:rotate(10deg)} }')).toEqual(['keyframe-owner'])
    expect(css('@keyframes wiggle {to {opacity:1}}', 'src/styles/animations.css')).toEqual([])
  })

  it('拦截把内容区限死在固定像素的宽度与高度', () => {
    expect(rules('.panel {max-width:820px}')).toEqual(['literal-geometry'])
    expect(rules('.panel {min-width:320px}')).toEqual(['literal-geometry'])
    expect(rules('.panel {max-height:480px}')).toEqual(['literal-geometry'])
    expect(rules('.panel {max-width:820px!important}')).toEqual(['literal-geometry', 'important-owner'])
  })

  it('允许图标尺寸、百分比、零值、变量与响应式断点', () => {
    expect(
      rules(`.panel { width:14px; height:14px; min-height:0; max-width:100%;
        max-width:var(--ecl-content-width); min-width:calc(100% - 2px); max-width:none;
        max-width:min(320px, calc(100vw - 40px)) }`)
    ).toEqual([])
    expect(rules('@media (max-width:820px) { .panel {gap:8px} }')).toEqual([])
    expect(rules('@container connect-room (max-width:620px) { .panel {gap:8px} }')).toEqual([])
  })

  it('主题来源仍可定义几何默认值', () => {
    expect(css(':root {--ecl-page-padding: 20px}', 'src/styles/tokens.css')).toEqual([])
    expect(css('.panel {max-width:820px}', 'src/styles/tokens.css')[0].rule).toBe('literal-geometry')
  })

  it('解析多个 SFC 样式块并保留源码行号', () => {
    const source = `<template><div /></template>\n<style scoped>\n.card {color:#fff}\n</style>\n<style>\n.badge{color:red!important}\n</style>`
    const findings = analyzeStyles('src/components/Example.vue', source)
    expect(findings.map((item) => item.line)).toEqual([3, 6, 6])
    expect(findings[0].context).not.toBe(findings[1].context)
    expect(findings[2].rule).toBe('important-owner')
  })

  it('无法解析或未支持的样式明确失败', () => {
    expect(() => css('.card {color:red')).toThrow()
    expect(() => css('.card {color:rgb(1,2,3}')).toThrow()
    expect(() =>
      analyzeStyles('src/Example.vue', '<template><div /></template><style lang="scss">$x:red;</style>')
    ).toThrow()
    expect(() =>
      analyzeStyles('src/Example.vue', '<template><div /></template><style src="https://test/style.css"/>')
    ).toThrow()
    expect(() =>
      analyzeStyles('src/components/Example.vue', '<template><div /></template><style src="../../public/style.css"/>')
    ).toThrow()
    expect(() =>
      analyzeStyles('src/Example.vue', '<template><div /></template><style src="@/styles/../../public/style.css"/>')
    ).toThrow()
  })

  it('保留存量声明，但拦截改值、换选择器、复制文件和增加重复项', () => {
    const previous = css('.card{color:white}')
    expect(addedFindings(previous, css('/* moved line */\n.card{color:white}'))).toEqual([])
    expect(addedFindings(previous, css('.card{color:red}'))).toHaveLength(1)
    expect(addedFindings(previous, css('.other{color:white}'))).toHaveLength(1)
    expect(addedFindings(previous, css('.card{color:white;color:white}'))).toHaveLength(1)
    expect(addedFindings(previous, css('.card{color:white}', 'src/Copy.css'))).toHaveLength(1)
    expect(addedFindings(previous, [])).toEqual([])
    expect(addedFindings(previous, css('@media(width > 900px){.card{color:white}}'))).toHaveLength(1)
    expect(addedFindings(previous, css('.card{color:white!important}')).map((item) => item.rule)).toContain(
      'important-owner'
    )
  })

  it('格式化逗号和函数空格不算新增，选择器和内容字符串的含义仍参与身份', () => {
    const previous = css('.a,.b{box-shadow:0 1px 2px rgba(0,0,0,.2)}')
    expect(addedFindings(previous, css('.a,\n.b { box-shadow: 0 1px 2px rgba(0, 0, 0, .2); }'))).toEqual([])
    expect(addedFindings(css('.a .b{color:red}'), css('.a.b{color:red}'))).toHaveLength(1)
    expect(addedFindings(css('[title="a  b"]{color:red}'), css('[title="a b"]{color:red}'))).toHaveLength(1)
  })
})

describe('精确样式例外', () => {
  const findings = css('.brand {color:#ff0000}')
  const entry = {
    ...findings[0],
    reason: '已审阅的品牌图例固有色',
    owner: 'frontend',
    expires: '2026-12-01',
  }
  delete entry.line
  const check = (exceptions, current = findings) => applyExceptions(findings, current, { exceptions }, '2026-11-02')

  it('唯一精确匹配的有效例外才能放行', () => {
    expect(check([entry])).toEqual([])
    expect(check([])).toHaveLength(1)
  })

  it.each([
    { expires: '2026-11-01' },
    { expires: '2026-02-30' },
    { reason: '' },
    { owner: '' },
    { file: 'src/**/*.css' },
    { value: 'blue' },
    { rule: 'unknown' },
    { extra: true },
  ])('拒绝过期、无解释、宽范围、过时或未知例外：%s', (patch) => {
    expect(() => check([{ ...entry, ...patch }])).toThrow()
  })

  it('不接受重复或同时匹配多个声明的例外', () => {
    expect(() => check([entry, entry])).toThrow()
    expect(() => check([entry], [...findings, ...findings])).toThrow()
    expect(() => applyExceptions([], [], { exceptions: [], other: true })).toThrow()
  })
})
