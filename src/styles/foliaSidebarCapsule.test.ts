import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import foliaCss from './folia.css?raw'

/** 读取已注入样式表中匹配选择器的规则声明。 */
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
  style.dataset.testSidebarCapsuleStyles = ''
  style.textContent = foliaCss
  document.head.append(style)
})

afterEach(() => {
  document.querySelector('[data-test-sidebar-capsule-styles]')?.remove()
  document.body.innerHTML = ''
})

describe('极光皮肤侧边栏激活胶囊', () => {
  /**
   * 折叠态若保留 scoped 的 .sidebar.collapsed .sidebar-item.active 行内背景，
   * 折叠与展开就会变成两套彼此独立的胶囊，折叠期间改动的激活项在展开后不生效。
   */
  it('折叠态清掉行内高亮，与展开态共用同一个浮动胶囊', () => {
    const collapsedNavRule = "[data-ui-skin='folia'] .sidebar.collapsed .sidebar-nav .sidebar-item.active"
    expect(declaredValue(collapsedNavRule, 'background')).toBe('transparent')

    // 选择器需带上 .sidebar-nav，特异性 (0,6,0) 才能稳定压过 scoped 规则的 (0,5,0)，
    // 否则 Vite 生产构建改变样式顺序后折叠态会退回行内胶囊。
    expect(declaredValue(collapsedNavRule, 'background')).not.toBe('')
    expect(declaredValue('.sidebar.collapsed .sidebar-item.active', 'background')).toBe('')
  })

  /**
   * 胶囊折叠时保留在 DOM 中（不切换 display），才能随侧栏宽度过渡一起收窄。
   */
  it('折叠态不切换 display，保证宽度随侧栏过渡', () => {
    expect(declaredValue('.sidebar-active-bg', 'display')).toBe('block')
    expect(declaredValue('.sidebar.collapsed .sidebar-active-bg', 'display')).toBe('')
  })
})
