import type { Ref } from 'vue'

export interface DesktopInteractionHandlers {
  /** 打开 WebView 开发者工具；只有调试模式会调用。 */
  openDevTools: () => void
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || !!target.closest('[contenteditable="true"]')
}

// 打开开发者工具的键盘入口：F12，以及 Ctrl+Shift+I/J/C、Ctrl+U
function isDevToolsShortcut(event: KeyboardEvent): boolean {
  if (event.key === 'F12') return true
  if (!(event.ctrlKey || event.metaKey)) return false
  if (event.key === 'U') return true
  return event.shiftKey && ['I', 'J', 'C'].includes(event.key)
}

export function installDesktopInteractionPolicy(
  isDevMode: Readonly<Ref<boolean>>,
  handlers: DesktopInteractionHandlers
): () => void {
  const onContextMenu = (event: MouseEvent) => {
    if (!isDevMode.value) event.preventDefault()
  }
  const onSelectStart = (event: Event) => {
    if (isDevMode.value || isEditable(event.target) || (event as MouseEvent).altKey) return
    event.preventDefault()
  }
  const onCopy = (event: ClipboardEvent) => {
    if (isDevMode.value || isEditable(event.target)) return
    event.preventDefault()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isDevToolsShortcut(event)) return
    // 默认行为一律拦下，否则 WebView 自带入口与后端 open_devtools 会各开一次
    event.preventDefault()
    if (isDevMode.value) handlers.openDevTools()
  }

  document.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('selectstart', onSelectStart)
  document.addEventListener('copy', onCopy)
  document.addEventListener('keydown', onKeyDown)

  return () => {
    document.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('selectstart', onSelectStart)
    document.removeEventListener('copy', onCopy)
    document.removeEventListener('keydown', onKeyDown)
  }
}
