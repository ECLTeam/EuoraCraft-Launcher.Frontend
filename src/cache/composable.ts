// 提供响应式缓存管理，方便Vue组件使用
// 简单持久化单值场景推荐使用 VueUse 的 useLocalStorage，本模块保留用于 TTL/分组/批量场景

import { ref, getCurrentScope, onScopeDispose, type Ref } from 'vue'
import { globalCache, type CacheOptions, CACHE_KEYS, CACHE_GROUPS } from '@/cache'

/**
 * 缓存钩子返回值接口
 */
interface CacheHookReturn<T> {
  /** 缓存数据（响应式） */
  data: Ref<T | null>
  /** 是否正在加载 */
  loading: Ref<boolean>
  /** 是否有错误 */
  error: Ref<boolean>
  /** 设置缓存 */
  setCache: (value: T, options?: CacheOptions) => void
  /** 删除缓存 */
  deleteCache: () => void
  /** 刷新缓存（删除并重新加载） */
  refresh: () => void
  /** 缓存是否有效（存在且未过期） */
  isValid: Ref<boolean>
}

/**
 * 使用全局缓存
 */
export function useGlobalCache<T = unknown>(
  key: string,
  defaultValue: T | null = null,
  options: CacheOptions = {}
): CacheHookReturn<T> {
  const data = ref<T | null>(defaultValue) as Ref<T | null>
  const loading = ref(false)
  const error = ref(false)
  const isValid = ref(false)

  const loadFromCache = () => {
    try {
      const cached = globalCache.get<T>(key)
      if (cached !== null) {
        data.value = cached
        isValid.value = true
        error.value = false
      } else {
        data.value = defaultValue
        isValid.value = false
      }
    } catch (e) {
      console.error(`加载缓存失败 [${key}]:`, e)
      error.value = true
      data.value = defaultValue
      isValid.value = false
    }
  }

  const setCache = (value: T, setOptions: CacheOptions = {}) => {
    try {
      const mergedOptions = { ...options, ...setOptions }
      globalCache.set(key, value, mergedOptions)
      data.value = value
      isValid.value = true
      error.value = false
    } catch (e) {
      console.error(`设置缓存失败 [${key}]:`, e)
      error.value = true
    }
  }

  const deleteCache = () => {
    try {
      globalCache.delete(key)
      data.value = defaultValue
      isValid.value = false
      error.value = false
    } catch (e) {
      console.error(`删除缓存失败 [${key}]:`, e)
      error.value = true
    }
  }

  const refresh = () => {
    deleteCache()
    loadFromCache()
  }

  if (getCurrentScope())
    onScopeDispose(
      globalCache.subscribe((changedKey) => {
        if (changedKey === null || changedKey === key) loadFromCache()
      })
    )

  loadFromCache()

  return {
    data,
    loading,
    error,
    setCache,
    deleteCache,
    refresh,
    isValid,
  }
}

/**
 * 使用带自动刷新的缓存
 */
export function useAutoRefreshCache<T = unknown>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions & { autoRefresh?: boolean } = {}
) {
  const { autoRefresh = true, ...cacheOptions } = options
  const cache = useGlobalCache<T>(key, null, cacheOptions)
  const { data, loading, error, setCache, isValid } = cache
  let pendingRequest: Promise<T | null> | null = null
  let latestRequest = 0

  // 自动获取数据
  const fetchData = async (forceRefresh = false): Promise<T | null> => {
    if (!forceRefresh && pendingRequest) return pendingRequest
    if (!forceRefresh) {
      // 启动预取可能在组件创建后、首次 fetchData 前完成；再次读取共享缓存避免重复请求。
      const latestCached = globalCache.get<T>(key)
      if (latestCached !== null) {
        data.value = latestCached
        isValid.value = true
        error.value = false
        return latestCached
      }
    }

    loading.value = true
    error.value = false
    const requestId = ++latestRequest
    const revision = globalCache.getRevision(key, cacheOptions.group)
    const request = (async () => {
      try {
        const result = await fetchFn()
        if (requestId === latestRequest && revision === globalCache.getRevision(key)) setCache(result, cacheOptions)
        return result
      } catch (e) {
        console.error(`获取数据失败 [${key}]:`, e)
        if (requestId === latestRequest) error.value = true
        return null
      } finally {
        if (requestId === latestRequest) loading.value = false
      }
    })()
    pendingRequest = request
    const cleanup = () => {
      if (pendingRequest === request) pendingRequest = null
    }
    void request.then(cleanup, cleanup)
    return request
  }

  // 自动刷新逻辑
  let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

  if (autoRefresh && cacheOptions.ttl) {
    const refreshInterval = Math.min(cacheOptions.ttl, 5 * 60 * 1000) // 最多5分钟刷新一次

    autoRefreshTimer = setInterval(() => {
      fetchData(true).catch(console.error)
    }, refreshInterval)
  }

  const stopAutoRefresh = () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
    }
  }

  // 组件作用域销毁时自动清理定时器
  onScopeDispose(() => stopAutoRefresh())

  return {
    data: cache.data,
    loading: cache.loading,
    error: cache.error,
    setCache: cache.setCache,
    deleteCache: cache.deleteCache,
    refresh: () => {
      cache.deleteCache()
      return fetchData(true)
    },
    isValid: cache.isValid,
    fetchData,
    stopAutoRefresh,
  }
}

/**
 * 缓存工具函数
 */
export const cacheUtils = {
  /** 清空所有缓存 */
  clearAll: () => globalCache.clear(),

  /** 清空指定分组缓存 */
  clearGroup: (group: string) => globalCache.clearGroup(group),

  /** 获取缓存统计 */
  getStats: () => globalCache.getStats(),

  /** 检查缓存是否存在 */
  has: (key: string) => globalCache.has(key),

  /** 批量设置缓存 */
  batchSet: <T>(items: Array<{ key: string; value: T; options?: CacheOptions }>) => {
    items.forEach(({ key, value, options }) => {
      globalCache.set(key, value, options)
    })
  },

  /** 批量获取缓存 */
  batchGet: <T>(keys: string[]): Record<string, T | null> => {
    const result: Record<string, T | null> = {}
    keys.forEach((key) => {
      result[key] = globalCache.get<T>(key)
    })
    return result
  },
}

// 导出常量
export { CACHE_KEYS, CACHE_GROUPS }
