interface TauriWindow {
  minimize: () => Promise<void>
  close: () => Promise<void>
  startDragging: () => Promise<void>
  isDecorated: () => Promise<boolean>
  isMinimized: () => Promise<boolean>
  isVisible: () => Promise<boolean>
  onResized: (handler: () => void) => Promise<() => void>
  onFocusChanged: (handler: () => void) => Promise<() => void>
}

function getCurrentWindow(): TauriWindow | null {
  if (typeof window === 'undefined') return null
  return (
    (
      window as unknown as {
        __TAURI__?: {
          window?: {
            getCurrentWindow?: () => TauriWindow
          }
        }
      }
    ).__TAURI__?.window?.getCurrentWindow?.() ?? null
  )
}

export const desktopWindow = {
  /** 事件触发时读取真实窗口状态；失焦本身不代表隐藏，退订后忽略在途读取。 */
  async onVisibilityChanged(handler: (visible: boolean) => void): Promise<() => void> {
    const currentWindow = getCurrentWindow()
    if (!currentWindow) return () => undefined
    const unsubscribers: Array<() => void> = []
    let disposed = false
    let revision = 0
    let hasFailed = false
    const dispose = (): void => {
      disposed = true
      revision++
      unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe())
    }
    const refresh = async (): Promise<void> => {
      const requestRevision = ++revision
      const [minimized, visible] = await Promise.all([currentWindow.isMinimized(), currentWindow.isVisible()])
      if (disposed || requestRevision !== revision) return
      hasFailed = false
      handler(visible && !minimized)
    }
    const onWindowEvent = (): void => {
      if (disposed) return
      void refresh().catch((error) => {
        if (!disposed && !hasFailed) {
          hasFailed = true
          console.warn('[DesktopWindow] 读取窗口可见状态失败:', error)
        }
      })
    }
    try {
      unsubscribers.push(await currentWindow.onResized(onWindowEvent))
      unsubscribers.push(await currentWindow.onFocusChanged(onWindowEvent))
      await refresh()
      return dispose
    } catch (error) {
      dispose()
      throw error
    }
  },
  async isDecorated(): Promise<boolean> {
    return (await getCurrentWindow()?.isDecorated()) ?? false
  },
  async minimize(): Promise<void> {
    await getCurrentWindow()?.minimize()
  },
  async close(): Promise<void> {
    await getCurrentWindow()?.close()
  },
  /** 通过 Tauri 原生 API 启动窗口拖拽，绕过 CSS -webkit-app-region 在 Linux/macOS 上的兼容性问题 */
  async startDragging(): Promise<void> {
    await getCurrentWindow()?.startDragging()
  },
}
