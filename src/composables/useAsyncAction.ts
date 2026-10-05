import { ref } from 'vue'
import { getErrorMessage } from '@/utils/error'
import { useLauncherMessage } from './useLauncherMessage'

export interface UseAsyncActionOptions {
  successMessage?: string
  errorMessage?: string
  showSuccess?: boolean
  showError?: boolean
}

export type ActionResult<T> =
  | { status: 'success'; value: T }
  | { status: 'failed'; error: string }
  | { status: 'cancelled'; value?: T }
  | { status: 'skipped' }

function isActionResult<T>(value: unknown): value is ActionResult<T> {
  if (!value || typeof value !== 'object' || !('status' in value)) return false
  if (value.status === 'success') return 'value' in value
  if (value.status === 'failed') return 'error' in value && typeof value.error === 'string'
  return value.status === 'cancelled' || value.status === 'skipped'
}

/**
 * 统一封装异步动作，自动管理 loading 状态并处理错误/成功提示。
 * @param options - 默认提示选项
 * @returns loading 状态和执行函数 run
 */
export function useAsyncAction(options: UseAsyncActionOptions = {}) {
  const message = useLauncherMessage()
  const loading = ref(false)
  let inFlight = 0

  /**
   * 执行异步函数。
   * @param fn - 待执行的异步函数
   * @param runOptions - 单次执行的提示选项，可覆盖默认选项
   * @returns 函数返回值，失败时返回 null
   */
  async function runResult<T>(
    fn: () => Promise<T | ActionResult<T> | null | undefined>,
    runOptions: Partial<UseAsyncActionOptions> = {}
  ): Promise<ActionResult<T | null>> {
    const opts = { ...options, ...runOptions }
    inFlight++
    loading.value = true
    try {
      const value = await fn()
      const result: ActionResult<T | null> = isActionResult<T>(value)
        ? value
        : value === false || value === null
          ? { status: 'cancelled', value }
          : { status: 'success', value: value ?? null }
      if (result.status === 'success' && opts.showSuccess && opts.successMessage) {
        message.success(opts.successMessage)
      }
      if (result.status === 'failed' && opts.showError !== false) message.error(result.error)
      return result
    } catch (e) {
      const msg = getErrorMessage(e, opts.errorMessage || '操作失败')
      if (opts.showError !== false) {
        message.error(msg)
      }
      return { status: 'failed', error: msg }
    } finally {
      loading.value = --inFlight > 0
    }
  }

  async function run<T>(
    fn: () => Promise<T | ActionResult<T> | null | undefined>,
    runOptions: Partial<UseAsyncActionOptions> = {}
  ): Promise<T | null> {
    const result = await runResult(fn, runOptions)
    return result.status === 'success' || result.status === 'cancelled' ? (result.value ?? null) : null
  }

  return { loading, run, runResult }
}
