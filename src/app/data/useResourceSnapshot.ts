import { hashKey, type QueryKey } from '@tanstack/vue-query'
import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import { queryClient } from '@/app/queryClient'

/** 页面仅持有展示副本，权威事件更新后同步展示；离开页面时释放订阅。 */
export function useResourceSnapshot<T>(queryKey: QueryKey, initial: T): ShallowRef<T> {
  const data = shallowRef<T>(structuredClone(queryClient.getQueryData<T>(queryKey) ?? initial))
  const hash = hashKey(queryKey)
  const stop = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.queryHash !== hash || event.action.type !== 'success') return
    const value = queryClient.getQueryData<T>(queryKey)
    if (value !== undefined) data.value = structuredClone(value)
  })
  onScopeDispose(stop)
  return data
}
