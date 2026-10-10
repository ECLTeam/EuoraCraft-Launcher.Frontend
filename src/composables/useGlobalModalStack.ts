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
  const displayedEntries = ref<GlobalModalEntry[]>([])
  const leavingEntries = ref<GlobalModalEntry[]>([])
  const renderedIds = new Set<string>()
  let nextSequence = 0

  const requestedEntry = computed<GlobalModalEntry | null>(() => {
    return (
      entries.value
        .filter((entry) => !entry.closing)
        .sort((left, right) => {
          if (right.priority !== left.priority) return right.priority - left.priority
          return right.sequence - left.sequence
        })[0] ?? null
    )
  })
  const activeModalId = computed(() => displayedEntries.value.at(-1)?.id ?? null)
  const hasActiveOverlay = computed(() => requestedEntry.value !== null || leavingEntries.value.length > 0)
  const interactiveModalId = computed(() => (leavingEntries.value.length > 0 ? null : activeModalId.value))
  const requestedChain = computed(() => {
    const chain: GlobalModalEntry[] = []
    let entry = requestedEntry.value
    while (entry?.kind === 'modal' && !chain.includes(entry)) {
      chain.unshift(entry)
      // 全屏切换全屏仍只展示当前一页，不叠加更早的全屏祖先。
      if (entry.isFullscreen) break
      entry = entries.value.find((candidate) => candidate.id === entry?.parentId && !candidate.closing) ?? null
    }
    return chain
  })
  const displayedModalIds = computed(() => displayedEntries.value.map((entry) => entry.id))
  const overlayEntries = computed(() => [...displayedEntries.value, ...leavingEntries.value])
  const currentFullscreenId = computed(() => displayedEntries.value.find((entry) => entry.isFullscreen)?.id ?? null)
  const isScrollLocked = computed(() => overlayEntries.value.some((entry) => entry.lockScroll))
  const isFullscreenActive = computed(() => overlayEntries.value.some((entry) => entry.isFullscreen))
  const activeTitle = computed(() => overlayEntries.value.find((entry) => entry.isFullscreen)?.title ?? '')

  /** 新展示链只在实际渲染过的离开项全部退场后生效，共同父级继续留在背景。 */
  function reconcileDisplay(): void {
    const target = requestedChain.value
    const targetIds = new Set(target.map((entry) => entry.id))
    const leavingIds = new Set(leavingEntries.value.map((entry) => entry.id))
    for (const entry of displayedEntries.value) {
      if (!targetIds.has(entry.id) && renderedIds.has(entry.id) && !leavingIds.has(entry.id)) {
        leavingEntries.value.push(entry)
      }
    }
    displayedEntries.value =
      leavingEntries.value.length > 0
        ? target.filter((entry) => displayedEntries.value.some((displayed) => displayed.id === entry.id))
        : target
  }

  /** 组件首次挂载或开始入场时确认实际渲染，未显示的等待项无需退场。 */
  function markDisplayed(id: string): void {
    if (displayedEntries.value.some((entry) => entry.id === id)) renderedIds.add(id)
  }

  /** 由 Vue afterLeave 确认退场；仍请求显示的项保留，重复完成信号无副作用。 */
  function finishLeave(id: string): void {
    if (!leavingEntries.value.some((entry) => entry.id === id)) return
    renderedIds.delete(id)
    leavingEntries.value = leavingEntries.value.filter((entry) => entry.id !== id)
    entries.value = entries.value.filter((entry) => entry.id !== id || !entry.closing)
    reconcileDisplay()
  }

  /** 绑定本次退场记录，卸载或重新注册后的旧动画回调不能完成新的交接。 */
  function captureLeave(id: string): () => void {
    const leaving = leavingEntries.value.find((entry) => entry.id === id)
    return () => {
      if (leaving && leavingEntries.value.includes(leaving)) finishLeave(id)
    }
  }

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
    reconcileDisplay()
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
    reconcileDisplay()
    removed
      .filter((entry) => notifyIds.has(entry.id))
      .sort((left, right) => right.sequence - left.sequence)
      .forEach((entry) => entry.onRequestClose?.())
  }

  function unregister(id: string): void {
    const removedIds = descendants(new Set([id]))
    removeEntries(removedIds, new Set([...removedIds].filter((candidate) => candidate !== id)))
  }

  /** 请求关闭并暂停交互，实际退场记录保留滚动锁直到组件 afterLeave。 */
  function beginClose(id: string): void {
    const target = entries.value.find((entry) => entry.id === id)
    if (!target || target.closing) return
    const childIds = descendants(new Set([id]))
    childIds.delete(id)
    removeEntries(childIds, childIds)
    entries.value = entries.value.map((entry) => (entry.id === id ? { ...entry, closing: true } : entry))
    reconcileDisplay()
  }

  /** 卸载的组件不会再报告 afterLeave，立即释放其自身及实际后代的渲染记录。 */
  function detach(id: string): void {
    const ids = descendants(new Set([id]))
    for (const removedId of ids) renderedIds.delete(removedId)
    leavingEntries.value = leavingEntries.value.filter((entry) => !ids.has(entry.id))
    unregister(id)
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
    reconcileDisplay()
  }

  function closeActive(): void {
    const entry = entries.value.find((candidate) => candidate.id === interactiveModalId.value)
    if (!entry || entry.kind !== 'modal' || entry.closing) return
    beginClose(entry.id)
    entry.onRequestClose?.()
  }

  function reset(): void {
    const closers = entries.value
      .filter((entry) => entry.kind === 'modal')
      .sort((left, right) => right.sequence - left.sequence)
      .map((entry) => entry.onRequestClose)
    entries.value = []
    reconcileDisplay()
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
    markDisplayed,
    finishLeave,
    captureLeave,
    detach,
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
