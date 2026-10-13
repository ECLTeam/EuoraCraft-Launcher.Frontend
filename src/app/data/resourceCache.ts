import { queryClient } from '@/app/queryClient'
import { invalidateResource, setResourceSnapshot } from './refreshCoordinator'
import type { QueryKey } from '@tanstack/vue-query'

/** 批量查询适配器只保留键操作，展示快照由唯一 QueryClient 持有。 */
export function resourceCache<T>(prefix: QueryKey) {
  const queryKey = (key: string) => [...prefix, key]
  const get = (key: string): T | undefined =>
    queryClient.getQueryState(queryKey(key))?.isInvalidated ? undefined : queryClient.getQueryData<T>(queryKey(key))
  return {
    get,
    has: (key: string) => get(key) !== undefined,
    set: (key: string, value: T) => setResourceSnapshot(queryKey(key), value),
    delete: (key: string) => {
      void invalidateResource(queryKey(key))
    },
    keys: () =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: prefix })
        .flatMap((query) => {
          const key = query.queryKey[prefix.length]
          return typeof key === 'string' ? [key] : []
        }),
    values: () =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: prefix })
        .flatMap((query) => {
          const key = query.queryKey[prefix.length]
          const value = typeof key === 'string' ? get(key) : undefined
          return value === undefined ? [] : [value]
        }),
  }
}
