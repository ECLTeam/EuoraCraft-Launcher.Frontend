import { afterEach, describe, expect, it } from 'vitest'
import appStyles from './app.css?raw'

afterEach(() => {
  document.querySelector('#window-test-styles')?.remove()
  document.body.innerHTML = ''
})

describe('窗口裁剪', () => {
  it.each(['native', 'system_shadow'])('系统模式 %s 禁用 app 和 body 圆角裁剪', (mode) => {
    const style = document.createElement('style')
    style.id = 'window-test-styles'
    style.textContent = appStyles
    document.head.append(style)
    document.body.innerHTML = `<div id="app" data-window-chrome="${mode}"><div class="launcher-app" data-window-chrome="${mode}"></div></div>`
    for (const element of [document.body, document.querySelector('#app')!, document.querySelector('.launcher-app')!]) {
      expect(Number.parseFloat(getComputedStyle(element).borderRadius)).toBe(0)
      expect(getComputedStyle(element).clipPath).toBe('none')
    }
  })
})
