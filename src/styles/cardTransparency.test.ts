import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

const styles = [
  'tokens.css',
  'design-system.css',
  'common.css',
  'folia.css',
  'components/ui/Card.css',
  'components/modals/Modal.css',
]
  .map((path) => readFileSync(`src/styles/${path}`, 'utf8'))
  .join('\n')

afterEach(() => {
  document.querySelector('#surface-test-styles')?.remove()
  document.body.innerHTML = ''
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.uiSkin
})

describe('半透明卡片与浮层', () => {
  // 经典皮肤走主题表面令牌，极光皮肤的玻璃规则直接引用 --ecl-surface-backdrop
  it.each([
    ['classic', 'var(--ecl-card-backdrop)'],
    ['folia', 'var(--ecl-surface-backdrop)'],
  ])('皮肤 %s 的普通卡片不强制模糊，浮层保留独立模糊', (skin, expectedCardBackdrop) => {
    const style = document.createElement('style')
    style.id = 'surface-test-styles'
    // jsdom 不解析背景中的自定义变量；替换底色后验证真实选择器的覆盖关系。
    style.textContent = styles
      .replaceAll('var(--ecl-surface)', 'rgba(255, 255, 255, 0.88)')
      .replaceAll('var(--card-bg)', 'rgba(255, 255, 255, 0.88)')
      .replaceAll('var(--folia-glass)', 'rgba(255, 255, 255, 0.88)')
    document.head.append(style)
    document.documentElement.dataset.uiSkin = skin
    document.body.innerHTML =
      '<div class="ecl-surface"><div class="ui-card"></div></div><div class="modal-container"></div>'
    expect(getComputedStyle(document.documentElement).getPropertyValue('--ecl-surface-backdrop').trim()).toBe('none')
    // 卡片模糊走主题表面令牌，默认仍指向 --ecl-surface-backdrop
    expect(getComputedStyle(document.documentElement).getPropertyValue('--ecl-card-backdrop').trim()).toBe(
      'var(--ecl-surface-backdrop)'
    )
    expect(getComputedStyle(document.documentElement).getPropertyValue('--ecl-overlay-backdrop')).toContain('blur(')
    expect(getComputedStyle(document.querySelector('.ecl-surface')!).backdropFilter).toBe(expectedCardBackdrop)
    expect(getComputedStyle(document.querySelector('.modal-container')!).backdropFilter).toBe(
      'var(--ecl-overlay-backdrop)'
    )
    expect(getComputedStyle(document.querySelector('.ui-card')!).backgroundColor).toBe('rgba(255, 255, 255, 0.88)')
    expect(getComputedStyle(document.querySelector('.ui-card')!).backdropFilter).toBe('var(--ecl-surface-backdrop)')
  })
})
