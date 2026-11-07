import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopWindow } from './desktopWindow'

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI__')
})

function windowFixture() {
  const handlers = new Map<string, () => void>()
  const resizeUnsubscribe = vi.fn()
  const focusUnsubscribe = vi.fn()
  const nativeWindow = {
    isMinimized: vi.fn().mockResolvedValue(false),
    isVisible: vi.fn().mockResolvedValue(true),
    onResized: vi.fn(async (handler: () => void) => {
      handlers.set('resize', handler)
      return resizeUnsubscribe
    }),
    onFocusChanged: vi.fn(async (handler: () => void) => {
      handlers.set('focus', handler)
      return focusUnsubscribe
    }),
  }
  Object.defineProperty(window, '__TAURI__', {
    configurable: true,
    value: { window: { getCurrentWindow: () => nativeWindow } },
  })
  return { nativeWindow, handlers, resizeUnsubscribe, focusUnsubscribe }
}

describe('原生窗口可见性', () => {
  it('失焦时仍按可见与最小化状态判断，最小化和恢复分别通知', async () => {
    const { nativeWindow, handlers, resizeUnsubscribe, focusUnsubscribe } = windowFixture()
    const changed = vi.fn()
    const dispose = await desktopWindow.onVisibilityChanged(changed)
    handlers.get('focus')!()
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2))
    expect(changed).toHaveBeenLastCalledWith(true)
    nativeWindow.isMinimized.mockResolvedValue(true)
    handlers.get('resize')!()
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(false))
    nativeWindow.isMinimized.mockResolvedValue(false)
    handlers.get('focus')!()
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(true))
    nativeWindow.isVisible.mockResolvedValue(false)
    handlers.get('resize')!()
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(false))
    dispose()
    dispose()
    expect(resizeUnsubscribe).toHaveBeenCalledOnce()
    expect(focusUnsubscribe).toHaveBeenCalledOnce()
  })

  it('迟到读取不覆盖较新的状态，退订后在途读取不再通知', async () => {
    const { nativeWindow, handlers } = windowFixture()
    const changed = vi.fn()
    const dispose = await desktopWindow.onVisibilityChanged(changed)
    let resolveOld!: (value: boolean) => void
    nativeWindow.isMinimized.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        })
    )
    handlers.get('resize')!()
    nativeWindow.isMinimized.mockResolvedValue(true)
    handlers.get('focus')!()
    await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(false))
    resolveOld(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(changed).toHaveBeenCalledTimes(2)
    let resolveDisposed!: (value: boolean) => void
    nativeWindow.isMinimized.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDisposed = resolve
        })
    )
    handlers.get('resize')!()
    dispose()
    resolveDisposed(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('订阅中途失败释放已经建立的监听', async () => {
    const { nativeWindow, resizeUnsubscribe } = windowFixture()
    nativeWindow.onFocusChanged.mockRejectedValueOnce(new Error('native unavailable'))
    await expect(desktopWindow.onVisibilityChanged(vi.fn())).rejects.toThrow('native unavailable')
    expect(resizeUnsubscribe).toHaveBeenCalledOnce()
  })

  it('普通浏览器不创建原生订阅', async () => {
    const changed = vi.fn()
    const dispose = await desktopWindow.onVisibilityChanged(changed)
    dispose()
    expect(changed).not.toHaveBeenCalled()
  })
})
