import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

export type DebugToolsWindowMode = 'closed' | 'floating' | 'minimized'

export const useDebugToolsWindowStore = defineStore('debugToolsWindow', () => {
  const mode = ref<DebugToolsWindowMode>('closed')
  const layout = reactive({ x: 16, y: 64, width: 640, height: 440 })
  let hasPosition = false
  let returnFocusTarget: HTMLElement | null = null

  function constrain(): void {
    const top = (document.querySelector('.titlebar')?.getBoundingClientRect().bottom || 48) + 16
    const maxWidth = Math.max(0, window.innerWidth - 32)
    const maxHeight = Math.max(0, window.innerHeight - top - 16)
    layout.width = Math.min(maxWidth, Math.max(Math.min(420, maxWidth), layout.width))
    layout.height = Math.min(maxHeight, Math.max(Math.min(280, maxHeight), layout.height))
    const visibleWidth = mode.value === 'minimized' ? Math.min(260, layout.width) : layout.width
    const visibleHeight = mode.value === 'minimized' ? 44 : layout.height
    layout.x = Math.min(Math.max(16, layout.x), Math.max(16, window.innerWidth - visibleWidth - 16))
    layout.y = Math.min(Math.max(top, layout.y), Math.max(top, window.innerHeight - visibleHeight - 16))
  }

  function activate(): void {
    if (mode.value === 'closed') {
      mode.value = 'minimized'
      if (!hasPosition) {
        layout.x = window.innerWidth - 260 - 16
        hasPosition = true
      }
      constrain()
    }
  }

  function open(): void {
    if (mode.value !== 'floating')
      returnFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!hasPosition) {
      layout.x = window.innerWidth - layout.width - 16
      hasPosition = true
    }
    mode.value = 'floating'
    constrain()
  }

  function close(): void {
    mode.value = 'closed'
  }

  function minimize(): void {
    mode.value = 'minimized'
    constrain()
  }

  function move(x: number, y: number): void {
    layout.x = x
    layout.y = y
    constrain()
  }

  function resize(width: number, height: number): void {
    layout.width = width
    layout.height = height
    constrain()
  }

  function restoreFocus(): void {
    if (returnFocusTarget?.isConnected && !returnFocusTarget.closest('[inert]')) returnFocusTarget.focus()
    returnFocusTarget = null
  }

  return { mode, layout, activate, open, close, minimize, move, resize, constrain, restoreFocus }
})
