import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { useDebugToolsWindowStore } from './debugToolsWindowStore'

beforeEach(() => {
  useGlobalModalStack().reset()
  setActivePinia(createPinia())
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
})

describe('调试工具会话窗口', () => {
  it('圆形可拖到右边缘，切换矩形后按新宽度收敛', () => {
    const settings = useSettingsStore()
    settings.ui.debugTools = { minimizedShape: 'circle' }
    const store = useDebugToolsWindowStore()
    store.setBounds({ left: 16, top: 64, right: 944, bottom: 584 })
    store.activate()
    store.move(9999, 9999)
    expect(store.minimizedPosition).toEqual({ x: 884, y: 476 })
    settings.ui.debugTools.minimizedShape = 'rectangle'
    expect(store.minimizedPosition).toEqual({ x: 668, y: 476 })
  })

  it('加载的关闭偏好禁止激活，临时禁用不覆盖偏好', () => {
    const settings = useSettingsStore()
    settings.ui.debugTools = { visible: false, minimizedShape: 'circle' }
    const store = useDebugToolsWindowStore()
    store.activate()
    store.open()
    expect(store.mode).toBe('closed')
    settings.ui.debugTools.visible = true
    store.activate()
    store.close()
    expect(settings.ui.debugTools.visible).toBe(true)
  })

  it('保存失败保留可见状态，允许重试，执行期间拒绝重复提交', async () => {
    const settings = useSettingsStore()
    const store = useDebugToolsWindowStore()
    store.activate()
    const patch = vi.spyOn(settings, 'patchUiDebugTools').mockRejectedValueOnce(new Error('写入失败'))
    await expect(store.savePreferences({ visible: false })).rejects.toThrow('写入失败')
    expect(store.mode).toBe('minimized')
    expect(store.isSavingPreferences).toBe(false)
    let finish!: () => void
    patch.mockImplementationOnce(async (next) => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      settings.ui.debugTools = next
    })
    const saving = store.savePreferences({ visible: false })
    expect(store.isSavingPreferences).toBe(true)
    expect(await store.savePreferences({ visible: true })).toBe(false)
    finish()
    await saving
    expect(store.mode).toBe('closed')
    expect(settings.ui.debugTools?.visible).toBe(false)
    expect(patch).toHaveBeenCalledTimes(2)
  })
  it('收起条和展开面板分别保存位置，宿主缩小时收敛收起条边界', () => {
    const store = useDebugToolsWindowStore()
    store.setBounds({ left: 80, top: 72, right: 940, bottom: 580 })
    store.activate()
    expect(store.minimizedPosition).toEqual({ x: 0, y: 0 })
    store.move(180, 100)
    store.open()
    store.move(140, 120)
    store.minimize()
    expect(store.minimizedPosition).toEqual({ x: 180, y: 100 })
    expect(store.layout.x).toBe(140)
    expect(store.layout.y).toBe(120)
    store.move(9000, 9000)
    expect(store.minimizedPosition).toEqual({ x: 600, y: 464 })
    store.setBounds({ left: 20, top: 64, right: 400, bottom: 300 })
    expect(store.minimizedPosition).toEqual({ x: 120, y: 192 })
  })

  it('进入全屏后收起工具，不把焦点还给后台页面', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const store = useDebugToolsWindowStore()
    store.open()
    const active = document.createElement('button')
    document.body.append(active)
    active.focus()
    useGlobalModalStack().register({ id: 'active-fullscreen', isFullscreen: true })
    store.minimize()
    expect(store.restoreFocus()).toBe(false)
    expect(document.activeElement).toBe(active)
    opener.remove()
    active.remove()
    useGlobalModalStack().reset()
  })

  it('展开面板收敛到当前页面范围，收起不会覆盖保存的拖动位置', () => {
    const store = useDebugToolsWindowStore()
    store.setBounds({ left: 80, top: 72, right: 940, bottom: 580 })
    store.open()
    expect(store.layout.x).toBe(80)
    expect(store.layout.y).toBe(72)
    store.move(160, 120)
    const layout = { ...store.layout }
    store.minimize()
    store.open()
    expect(store.layout).toEqual(layout)
    store.setBounds({ left: 20, top: 64, right: 500, bottom: 340 })
    expect(store.layout.x + store.layout.width).toBeLessThanOrEqual(500)
    expect(store.layout.y + store.layout.height).toBeLessThanOrEqual(340)
  })

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
