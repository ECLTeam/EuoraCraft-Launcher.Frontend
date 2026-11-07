import { invalidateResource } from '@/app/data/refreshCoordinator'
import { queryClient } from '@/app/queryClient'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import type { WardrobeKind } from '@/types/accounts'
import type { QueryKey } from '@tanstack/vue-query'

export const littleSkinWardrobeStaleTime = 60_000

const accountKey = (accountId: string) => ['littleskin-wardrobe', accountId] as const
export const littleSkinManagementKey = (accountId: string) => [...accountKey(accountId), 'management'] as const
export const littleSkinClosetKey = (accountId: string, kind: WardrobeKind, page: number) =>
  [...accountKey(accountId), 'closet', kind, page] as const

function isFresh(queryKey: QueryKey): boolean {
  return queryClient.getQueryCache().find({ queryKey })?.isStaleByTime(littleSkinWardrobeStaleTime) === false
}

export function isLittleSkinWardrobeCached(accountId: string, kind: WardrobeKind, page: number): boolean {
  return isFresh(littleSkinManagementKey(accountId)) && isFresh(littleSkinClosetKey(accountId, kind, page))
}

export function invalidateLittleSkinWardrobe(accountId: string): Promise<void> {
  return invalidateResource(accountKey(accountId), false)
}

export function clearLittleSkinWardrobe(accountId: string): void {
  queryClient.removeQueries({ queryKey: accountKey(accountId) })
}

export function isLittleSkinAuthorizationError(reason: unknown): boolean {
  return (
    reason instanceof BackendCommandError &&
    (reason.errorCode === 'LITTLESKIN_PERMISSION_REQUIRED' ||
      reason.errorCode === 'LITTLESKIN_AUTH_REQUIRED' ||
      reason.errorCode === 'LITTLESKIN_INVALID_GRANT')
  )
}

export async function withLittleSkinWardrobeAccess<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (reason) {
    if (isLittleSkinAuthorizationError(reason)) clearLittleSkinWardrobe(accountId)
    throw reason
  }
}
