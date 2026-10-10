import { computed, ref } from 'vue'

export const GLOBAL_MODAL_PRIORITY = {
  automaticUpdate: 60,
  launcherInfo: 70,
  interactive: 80,
  launcherWarning: 75,
  launcherCritical: 90,
  agreement: 95,
  error: 100,
} as const

type GlobalModalKind = 'modal' | 'blocker'

interface GlobalModalEntry {
  id: string
  kind: GlobalModalKind
  priority: number
  sequence: number
  title: string
  isFullscreen: boolean
  lockScroll: boolean
  parentId: string | null
  closing: boolean
  onRequestClose?: () => void
}

export interface GlobalModalRegistration {
  id: string
  title?: string
  priority?: number
  isFullscreen?: boolean
  lockScroll?: boolean
  parentId?: string | null
  onRequestClose?: () => void
}

function normalizePriority(priority: number | undefined): number {
  if (!Number.isFinite(priority)) return GLOBAL_MODAL_PRIORITY.interactive
  return Math.max(0, Math.min(100, Math.round(priority ?? GLOBAL_MODAL_PRIORITY.interactive)))
}

/**
 * 创建应用级模态框栈。
 *
 * 优先级与打开顺序决定活动项；普通子窗口保留祖先作为背景，仅最上层可以
 * 交互。独立提示继续抢占，关闭和重置按实际关系清理后代。
 */
export function createGlobalModalStack() {
  const entries = ref<GlobalModalEntry[]>([])
  let nextSequence = 0

  const activeEntry = computed<GlobalModalEntry | null>(() => {
    if (entries.value.length === 0) return null
    return (
      [...entries.value].sort((left, right) => {
        if (right.priority !== left.priority) return right.priority - left.priority
        return right.sequence - left.sequence
      })[0] ?? null
    )
  })
  const activeModalId = computed(() => (activeEntry.value?.kind === 'modal' ? activeEntry.value.id : null))
  const hasActiveOverlay = computed(() => activeEntry.value !== null)
  const interactiveModalId = computed(() => (activeEntry.value?.closing ? null : activeModalId.value))
  const displayedEntries = computed(() => {
    const chain: GlobalModalEntry[] = []
    let entry = activeEntry.value
    while (entry?.kind === 'modal' && !chain.includes(entry)) {
      chain.unshift(entry)
      // 全屏切换全屏仍只展示当前一页，不叠加更早的全屏祖先。
      if (entry.isFullscreen) break
      entry = entries.value.find((candidate) => candidate.id === entry?.parentId) ?? null
    }
    return chain
  })
  const displayedModalIds = computed(() => displayedEntries.value.map((entry) => entry.id))
  const currentFullscreenId = computed(() => displayedEntries.value.find((entry) => entry.isFullscreen)?.id ?? null)
  const isScrollLocked = computed(() => displayedEntries.value.some((entry) => entry.lockScroll))
  const isFullscreenActive = computed(() => currentFullscreenId.value !== null)
  const activeTitle = computed(() => displayedEntries.value.find((entry) => entry.isFullscreen)?.title ?? '')

  function resolveParent(registration: GlobalModalRegistration): string | null {
    const parentId =
      registration.parentId === undefined && registration.isFullscreen
        ? entries.value.filter((entry) => entry.isFullscreen).sort((a, b) => b.sequence - a.sequence)[0]?.id
        : registration.parentId
    if (!parentId || parentId === registration.id) return null
    let parent = entries.value.find((entry) => entry.kind === 'modal' && entry.id === parentId && !entry.closing)
    const visited = new Set([registration.id])
    while (parent) {
      if (visited.has(parent.id)) return null
      visited.add(parent.id)
      parent = entries.value.find((entry) => entry.id === parent?.parentId)
    }
    return visited.size > 1 ? parentId : null
  }

  function register(registration: GlobalModalRegistration): string | null {
    const existing = entries.value.find((entry) => entry.id === registration.id)
    const entry: GlobalModalEntry = {
      id: registration.id,
      kind: 'modal',
      priority: normalizePriority(registration.priority),
      sequence: existing?.sequence ?? nextSequence++,
      title: registration.title?.trim() ?? '',
      isFullscreen: registration.isFullscreen === true,
      lockScroll: registration.lockScroll !== false,
      parentId: existing ? existing.parentId : resolveParent(registration),
      closing: false,
      onRequestClose: registration.onRequestClose,
    }
    entries.value = [...entries.value.filter((candidate) => candidate.id !== entry.id), entry]
    return entry.parentId
  }

  function descendants(ids: Set<string>): Set<string> {
    const removedIds = new Set(ids)
    let found = true
    while (found) {
      found = false
      for (const entry of entries.value) {
        if (entry.parentId && removedIds.has(entry.parentId) && !removedIds.has(entry.id)) {
          removedIds.add(entry.id)
          found = true
        }
      }
    }
    return removedIds
  }

  function removeEntries(ids: Set<string>, notifyIds: Set<string>): void {
    const removed = entries.value.filter((entry) => ids.has(entry.id))
    entries.value = entries.value.filter((entry) => !ids.has(entry.id))
    removed
      .filter((entry) => notifyIds.has(entry.id))
      .sort((left, right) => right.sequence - left.sequence)
      .forEach((entry) => entry.onRequestClose?.())
  }

  function unregister(id: string): void {
    const removedIds = descendants(new Set([id]))
    removeEntries(removedIds, new Set([...removedIds].filter((candidate) => candidate !== id)))
  }

  /** 退场期间保留关系与滚动锁，组件 afterLeave 再移除自身。 */
  function beginClose(id: string): void {
    const target = entries.value.find((entry) => entry.id === id)
    if (!target || target.closing) return
    const childIds = descendants(new Set([id]))
    childIds.delete(id)
    removeEntries(childIds, childIds)
    entries.value = entries.value.map((entry) => (entry.id === id ? { ...entry, closing: true } : entry))
  }

  function unregisterFullscreen(id: string): void {
    const target = entries.value.find((entry) => entry.id === id && entry.isFullscreen)
    if (!target) return
    unregister(id)
  }

  function addBlocker(id: string, priority: number = GLOBAL_MODAL_PRIORITY.interactive): void {
    const existing = entries.value.find((entry) => entry.id === id)
    const entry: GlobalModalEntry = {
      id,
      kind: 'blocker',
      priority: normalizePriority(priority),
      sequence: existing?.sequence ?? nextSequence++,
      title: '',
      isFullscreen: false,
      lockScroll: false,
      parentId: null,
      closing: false,
    }
    entries.value = [...entries.value.filter((candidate) => candidate.id !== id), entry]
  }

  function closeActive(): void {
    const entry = activeEntry.value
    if (!entry || entry.kind !== 'modal' || entry.closing) return
    unregister(entry.id)
    entry.onRequestClose?.()
  }

  function reset(): void {
    const closers = entries.value
      .filter((entry) => entry.kind === 'modal')
      .sort((left, right) => right.sequence - left.sequence)
      .map((entry) => entry.onRequestClose)
    entries.value = []
    closers.forEach((close) => close?.())
  }

  function resetFullscreen(): void {
    const ids = descendants(new Set(entries.value.filter((entry) => entry.isFullscreen).map((entry) => entry.id)))
    removeEntries(ids, ids)
  }

  return {
    hasActiveOverlay,
    activeModalId,
    interactiveModalId,
    displayedModalIds,
    currentFullscreenId,
    activeTitle,
    isScrollLocked,
    isFullscreenActive,
    register,
    unregister,
    unregisterFullscreen,
    beginClose,
    addBlocker,
    closeActive,
    reset,
    resetFullscreen,
  }
}

/** 全局单例：所有应用模态框共用同一仲裁状态。 */
export const globalModalStack = createGlobalModalStack()

export function useGlobalModalStack() {
  return globalModalStack
}
