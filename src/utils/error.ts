import { resolveDisplayMessage } from './errorCodeMessages'

/**
 * 取错误的可展示说明，裸错误码会被换成业务文案。
 * @param error - 任意抛出的值
 * @param fallback - 无法取得说明时使用的提示
 * @returns 可以直接展示的失败说明
 */
export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  if (typeof error === 'string') return resolveDisplayMessage(error, fallback)
  if (error instanceof Error) return resolveDisplayMessage(error.message, fallback)
  if (!error || typeof error !== 'object') return fallback

  const values = error as Record<string, unknown>
  for (const key of ['message', 'detail', 'error', 'reason']) {
    const value = values[key]
    if (typeof value === 'string' && value.trim()) return resolveDisplayMessage(value, fallback)
    if (value instanceof Error && value.message.trim()) return resolveDisplayMessage(value.message, fallback)
  }
  return fallback
}
