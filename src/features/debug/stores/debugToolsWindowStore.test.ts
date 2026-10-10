import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDebugToolsWindowStore } from './debugToolsWindowStore'

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
})

describe('调试工具会话窗口', () => {
  it('启用自动常驻浮条，重复启用不改变展开状态，禁用才能完全隐藏', () => {
    const store = useDebugToolsWindowStore()
    store.activate()
    expect(store.mode).toBe('minimized')
    expect(store.layout.x + 260).toBeLessThanOrEqual(944)
    store.open()
    store.activate()
    expect(store.mode).toBe('floating')
    store.minimize()
    expect(store.mode).toBe('minimized')
    store.close()
    expect(store.mode).toBe('closed')
  })

  it('重复打开和收起恢复共用同一布局，关闭不丢失本会话的位置', () => {
    const store = useDebugToolsWindowStore()
    expect(store.mode).toBe('closed')
    store.open()
    store.move(100, 100)
    store.resize(500, 320)
    store.minimize()
    store.open()
    expect(store.mode).toBe('floating')
    expect(store.layout).toEqual({ x: 100, y: 100, width: 500, height: 320 })
    store.close()
    store.open()
    expect(store.layout).toEqual({ x: 100, y: 100, width: 500, height: 320 })
  })

  it('窗口缩小时收敛尺寸和位置，拖动不进入标题栏或屏幕之外', () => {
    const store = useDebugToolsWindowStore()
    store.open()
    store.move(9000, -9000)
    expect(store.layout.x + store.layout.width).toBeLessThanOrEqual(944)
    expect(store.layout.y).toBe(64)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 360 })
    store.constrain()
    expect(store.layout.width).toBe(448)
    expect(store.layout.height).toBe(280)
    expect(store.layout.x).toBe(16)
    expect(store.layout.y).toBe(64)
  })

  it('收起后将焦点交回打开工具的原控件', () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    const store = useDebugToolsWindowStore()
    store.open()
    const otherButton = document.createElement('button')
    document.body.append(otherButton)
    otherButton.focus()
    expect(document.activeElement).toBe(otherButton)
    store.minimize()
    store.restoreFocus()
    expect(document.activeElement).toBe(button)
  })
})
