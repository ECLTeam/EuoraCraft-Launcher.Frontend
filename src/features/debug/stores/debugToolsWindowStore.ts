import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { UiConfig } from '@/types/config'

export type DebugToolsWindowMode = 'closed' | 'floating' | 'minimized'

export interface DebugToolsBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export const useDebugToolsWindowStore = defineStore('debugToolsWindow', () => {
  const settings = useSettingsStore()
  const isVisible = computed(() => settings.ui.debugTools?.visible ?? true)
  const minimizedShape = computed(() => settings.ui.debugTools?.minimizedShape ?? 'rectangle')
  const minimizedWidth = computed(() => (minimizedShape.value === 'circle' ? 44 : 260))
  const isSavingPreferences = ref(false)
  const mode = ref<DebugToolsWindowMode>('closed')
  const layout = reactive({ x: 16, y: 64, width: 640, height: 440 })
  const minimizedPosition = reactive({ x: 0, y: 0 })
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
    minimizedPosition.x = Math.min(
      Math.max(0, minimizedPosition.x),
      Math.max(0, maxWidth - Math.min(minimizedWidth.value, maxWidth))
    )
    minimizedPosition.y = Math.min(Math.max(0, minimizedPosition.y), Math.max(0, maxHeight - 44))
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
    if (!isVisible.value) return
    if (mode.value === 'closed') {
      mode.value = 'minimized'
      constrain()
    }
  }

  function open(): void {
    if (!isVisible.value) return
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

  async function savePreferences(patch: NonNullable<UiConfig['debugTools']>): Promise<boolean> {
    if (isSavingPreferences.value) return false
    isSavingPreferences.value = true
    try {
      await settings.patchUiDebugTools(patch)
      if (!isVisible.value) close()
      else activate()
      return true
    } finally {
      isSavingPreferences.value = false
    }
  }

  async function show(): Promise<void> {
    if (await savePreferences({ visible: true })) open()
  }

  watch(minimizedShape, constrain, { flush: 'sync' })

  function minimize(): void {
    mode.value = 'minimized'
    constrain()
  }

  function move(x: number, y: number): void {
    if (mode.value === 'minimized') {
      minimizedPosition.x = x
      minimizedPosition.y = y
    } else {
      layout.x = x
      layout.y = y
    }
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

  return {
    isVisible,
    minimizedShape,
    minimizedWidth,
    isSavingPreferences,
    savePreferences,
    show,
    mode,
    layout,
    minimizedPosition,
    activate,
    open,
    close,
    minimize,
    move,
    resize,
    constrain,
    setBounds,
    restoreFocus,
  }
})
