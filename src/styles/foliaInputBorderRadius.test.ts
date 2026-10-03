import { afterEach, describe, expect, it } from 'vitest'
import foliaCss from './folia.css?raw'

/**
 * 读取已注入样式表中匹配选择器的规则声明，用于断言极光皮肤的圆角声明。
 * jsdom 不保留 `inherit` 等 CSS 关键字（getComputedStyle 会把它规范化掉），
 * 因此这里直接校验规则声明本身。
 */
function declaredBorderRadius(selectorFragment: string): string {
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue
      if (!rule.selectorText.includes("[data-ui-skin='folia']")) continue
      if (!rule.selectorText.includes(selectorFragment)) continue
      const value = rule.style.getPropertyValue('border-radius')
      if (value) return value
    }
  }
  return ''
}

afterEach(() => {
  document.querySelector('[data-test-input-radius-styles]')?.remove()
  document.body.innerHTML = ''
})

describe('极光皮肤输入框描边圆角', () => {
  /**
   * naive 的 .n-input-wrapper 不承载圆角，圆角只画在 .n-input 与其
   * .n-input__border/__state-border 上。极光皮肤的 1px 描边挂在 wrapper 上，
   * 若不显式继承控件圆角就会呈矩形，与跟随圆角的 hover/focus 高亮错位。
   */
  it('n-input-wrapper 继承控件圆角，且不改写自带圆角的 n-base-selection', () => {
    const style = document.createElement('style')
    style.dataset.testInputRadiusStyles = ''
    style.textContent = foliaCss
    document.head.append(style)

    expect(declaredBorderRadius('.n-input-wrapper')).toBe('inherit')
    // .n-base-selection 自带 naive 的 var(--n-border-radius)，不能被继承规则改写。
    expect(declaredBorderRadius('.n-base-selection')).toBe('')
  })
})
