import { afterEach, describe, expect, it } from 'vitest'
import appCss from './app.css?raw'
import foliaCss from './folia.css?raw'

afterEach(() => {
  document.querySelector('[data-test-background-styles]')?.remove()
  delete document.documentElement.dataset.uiSkin
  delete document.documentElement.dataset.auroraBlur
})

describe('背景媒体模糊与额外毛玻璃层', () => {
  it.each([
    ['classic', false],
    ['classic', true],
    ['folia', false],
    ['folia', true],
  ] as const)('在 %s 主题中毛玻璃层状态为 %s 时保留图片和视频滤镜', (skin, enabled) => {
    const style = document.createElement('style')
    style.dataset.testBackgroundStyles = ''
    style.textContent = `${foliaCss}\n${appCss}`
    document.head.append(style)
    document.documentElement.dataset.uiSkin = skin
    document.documentElement.dataset.auroraBlur = enabled ? '1' : '0'
    document.body.innerHTML = `
      <div class="app-background"></div>
      <video class="app-background app-background-video"></video>
      <div class="app-background-overlay"></div>
    `

    for (const media of document.querySelectorAll('.app-background')) {
      expect(getComputedStyle(media).filter).toBe('blur(var(--bg-blur, 0px))')
    }
    expect(getComputedStyle(document.querySelector('.app-background-overlay')!).backdropFilter).toBe(
      enabled ? 'var(--glass-backdrop, none)' : 'none'
    )
  })
})
