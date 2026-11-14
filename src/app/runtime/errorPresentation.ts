import { computed } from 'vue'
import type { ApiResponse } from '@/types/api'
import type { LauncherErrorEvent } from '@/types/system'
import { resolveDisplayMessage } from '@/utils/errorCodeMessages'
import { launcherPopupQueue, type LauncherPopupQueue } from './useLauncherPopupQueue'

const MAX_SEEN_ERRORS = 100
const MESSAGE_SUPPRESSION_MS = 5000

/** 严重错误弹窗优先级：游戏崩溃最高，其余后端 modal 级失败次之，均高于普通警告公告。 */
const GAME_CRASH_PRIORITY = 90
const MODAL_ERROR_PRIORITY = 85

export class BackendCommandError extends Error {
  readonly errorCode?: string
  readonly presentation: 'message' | 'modal'
  readonly errorId?: string
  readonly title?: string
  readonly detail?: string

  constructor(response: ApiResponse<unknown>, fallback: string) {
    super(resolveDisplayMessage(response.message, fallback))
    this.name = 'BackendCommandError'
    this.errorCode = response.errorCode
    this.presentation = response.presentation ?? 'message'
    this.errorId = response.errorId
    this.title = response.title
    this.detail = response.detail
  }
}

function normalizeError(payload: LauncherErrorEvent): LauncherErrorEvent | null {
  const errorId = payload.error_id?.trim()
  const message = resolveDisplayMessage(payload.message, '').trim()
  if (!errorId || !message) return null
  return {
    error_id: errorId,
    title: payload.title?.trim() || '启动器发生错误',
    message,
    detail: payload.detail?.trim() || undefined,
    kind: payload.kind,
    crash: payload.kind === 'game_crash' ? payload.crash : undefined,
  }
}

export function createLauncherErrorQueue(popupQueue: LauncherPopupQueue = launcherPopupQueue) {
  const seenIds = new Set<string>()
  const seenOrder: string[] = []
  const suppressedMessages = new Map<string, number>()

  // 严重错误与公告共用统一弹窗队列；activeError 从队首还原错误事件结构。
  const activeError = computed<LauncherErrorEvent | null>(() => {
    const popup = popupQueue.activePopup.value
    if (!popup?.errorId) return null
    return {
      error_id: popup.errorId,
      title: popup.title,
      message: popup.content,
      detail: popup.detail,
      kind: popup.kind,
      crash: popup.crash,
    }
  })
  const visible = computed(() => activeError.value !== null)

  function remember(errorId: string): void {
    seenIds.add(errorId)
    seenOrder.push(errorId)
    while (seenOrder.length > MAX_SEEN_ERRORS) {
      const oldest = seenOrder.shift()
      if (oldest) seenIds.delete(oldest)
    }
  }

  function suppressMessage(message: string): void {
    suppressedMessages.set(message, Date.now() + MESSAGE_SUPPRESSION_MS)
  }

  function enqueue(payload: LauncherErrorEvent): boolean {
    const error = normalizeError(payload)
    if (!error || seenIds.has(error.error_id)) return false
    remember(error.error_id)
    suppressMessage(error.message)
    popupQueue.enqueuePopup({
      id: error.error_id,
      title: error.title,
      content: error.message,
      level: 'critical',
      priority: error.kind === 'game_crash' ? GAME_CRASH_PRIORITY : MODAL_ERROR_PRIORITY,
      source: 'launcher',
      errorId: error.error_id,
      detail: error.detail,
      kind: error.kind,
      crash: error.crash,
    })
    return true
  }

  function dismissActive(): void {
    popupQueue.dismissActivePopup()
  }

  function consumeSuppressedMessage(message: string): boolean {
    const expiresAt = suppressedMessages.get(message)
    if (!expiresAt) return false
    suppressedMessages.delete(message)
    return expiresAt >= Date.now()
  }

  return { activeError, visible, enqueue, dismissActive, consumeSuppressedMessage, suppressMessage }
}

export const launcherErrorQueue = createLauncherErrorQueue()

let notifyError: ((message: string) => void) | null = null

/**
 * 注入全局错误通知器，用于呈现 message 级别的失败。
 */
export function setErrorNotifier(notifier: (message: string) => void): void {
  notifyError = notifier
}

export function unwrapResponse<T>(response: ApiResponse<T>, operation: string): T {
  if (response.success) return response.data as T
  const error = new BackendCommandError(response, `${operation}失败`)
  if (error.presentation === 'modal' && error.errorId) {
    launcherErrorQueue.enqueue({
      error_id: error.errorId,
      title: error.title || '启动器发生错误',
      message: error.message,
      detail: error.detail,
    })
  } else {
    // 先记录抑制，再显示顶部通知（绕过抑制检查），避免调用方 catch 后重复提示同一错误
    launcherErrorQueue.suppressMessage(error.message)
    notifyError?.(error.message)
  }
  throw error
}
