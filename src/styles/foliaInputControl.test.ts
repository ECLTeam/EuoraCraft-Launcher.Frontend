import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import foliaCss from './folia.css?raw'

/**
 * 读取已注入样式表中匹配选择器的规则声明。
 * jsdom 不保留 `inherit` 等 CSS 关键字（getComputedStyle 会把 border-radius 规范化掉），
 * 因此圆角继承只能校验规则声明本身。
 */
function declaredValue(selectorFragment: string, property: string): string {
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue
      if (!rule.selectorText.includes("[data-ui-skin='folia']")) continue
      if (!rule.selectorText.includes(selectorFragment)) continue
      const value = rule.style.getPropertyValue(property)
      if (value) return value
    }
  }
  return ''
}

beforeEach(() => {
  const style = document.createElement('style')
  style.dataset.testInputControlStyles = ''
  style.textContent = foliaCss
  document.head.append(style)
  document.documentElement.dataset.uiSkin = 'folia'
  document.body.innerHTML = `
    <div class="n-input"><div class="n-input-wrapper"></div></div>
    <div class="n-base-selection"></div>
  `
})

afterEach(() => {
  document.querySelector('[data-test-input-control-styles]')?.remove()
  delete document.documentElement.dataset.uiSkin
  document.body.innerHTML = ''
})

describe('极光皮肤输入框描边', () => {
  /**
   * .n-input-wrapper 与 .n-base-selection 的高度由内容撑开，border 会在内容盒之外
   * 额外撑高 2px，使输入框比并排的 NInputGroup 按钮高出 1px，下拉框也整体变高。
   */
  it('不使用 border 描边，避免撑高控件', () => {
    const wrapper = document.querySelector<HTMLElement>('.n-input-wrapper')
    expect(wrapper).not.toBeNull()
    expect(getComputedStyle(wrapper!).borderTopWidth).toBe('0px')

    // 描边改由不参与布局的 inset 阴影承担，颜色仍沿用控件描边令牌。
    expect(getComputedStyle(wrapper!).boxShadow).toBe('inset 0 0 0 1px var(--control-border)')
  })

  /**
   * naive 的 .n-input-wrapper 不承载圆角，圆角只画在 .n-input 与其
   * .n-input__border/__state-border 上。若不显式继承控件圆角，描边会呈矩形，
   * 与跟随圆角的 hover/focus 高亮错位。
   */
  it('n-input-wrapper 继承控件圆角，且不改写自带圆角的 n-base-selection', () => {
    expect(declaredValue('.n-input-wrapper', 'border-radius')).toBe('inherit')
    // .n-base-selection 自带 naive 的 var(--n-border-radius)，不能被继承规则改写。
    expect(declaredValue('.n-base-selection', 'border-radius')).toBe('')
  })
})
