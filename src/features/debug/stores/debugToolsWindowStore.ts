import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'

export type DebugToolsWindowMode = 'closed' | 'floating' | 'minimized'

export interface DebugToolsBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export const useDebugToolsWindowStore = defineStore('debugToolsWindow', () => {
  const mode = ref<DebugToolsWindowMode>('closed')
  const layout = reactive({ x: 16, y: 64, width: 640, height: 440 })
  let hasPosition = false
  let bounds: DebugToolsBounds | null = null
  let returnFocusTarget: HTMLElement | null = null

  function constrain(): void {
    const left = bounds?.left ?? 16
    const top = bounds?.top ?? (document.querySelector('.titlebar')?.getBoundingClientRect().bottom || 48) + 16
    const right = bounds?.right ?? window.innerWidth - 16
    const bottom = bounds?.bottom ?? window.innerHeight - 16
    const maxWidth = Math.max(0, right - left)
    const maxHeight = Math.max(0, bottom - top)
    layout.width = Math.min(maxWidth, Math.max(Math.min(420, maxWidth), layout.width))
    layout.height = Math.min(maxHeight, Math.max(Math.min(280, maxHeight), layout.height))
    layout.x = Math.min(Math.max(left, layout.x), Math.max(left, right - layout.width))
    layout.y = Math.min(Math.max(top, layout.y), Math.max(top, bottom - layout.height))
  }

  function setBounds(next: DebugToolsBounds | null): void {
    bounds = next
    constrain()
  }

  function activate(): void {
    if (mode.value === 'closed') {
      mode.value = 'minimized'
      constrain()
    }
  }

  function open(): void {
    if (mode.value !== 'floating')
      returnFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!hasPosition) {
      layout.x = bounds?.left ?? 16
      layout.y = bounds?.top ?? 64
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

  function restoreFocus(): boolean {
    const target = returnFocusTarget
    returnFocusTarget = null
    if (!target?.isConnected || target.closest('[inert]')) return false
    const stack = useGlobalModalStack()
    const owner = target.closest<HTMLElement>('[data-modal-id]')?.dataset.modalId
    if (stack.hasActiveOverlay.value ? owner !== stack.interactiveModalId.value : owner !== undefined) return false
    target.focus()
    return document.activeElement === target
  }

  return { mode, layout, activate, open, close, minimize, move, resize, constrain, setBounds, restoreFocus }
})
