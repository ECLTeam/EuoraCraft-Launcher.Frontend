import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useAutoRefreshCache, useGlobalCache } from './composable'
import { globalCache } from './index'

describe('useAutoRefreshCache 启动预取', () => {
  it('相同键的跨组件缓存同步写入和清理，并在作用域销毁后停止订阅', () => {
    const scope = effectScope()
    const secondScope = effectScope()
    const first = scope.run(() => useGlobalCache<string>('shared'))!
    const second = secondScope.run(() => useGlobalCache<string>('shared'))!
    first.setCache('new')
    expect(second.data.value).toBe('new')
    globalCache.clearGroup('default')
    expect(second.data.value).toBeNull()
    secondScope.stop()
    first.setCache('after-dispose')
    expect(second.data.value).toBeNull()
    scope.stop()
  })

  it('合并普通请求，强制刷新执行获取且迟到的旧响应不覆盖新缓存', async () => {
    let finish!: (value: string) => void
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValueOnce('fresh')
    const scope = effectScope()
    const cache = scope.run(() => useAutoRefreshCache<string>('race', fetch, { autoRefresh: false }))!
    try {
      const old = cache.fetchData()
      const same = cache.fetchData()
      await cache.refresh()
      finish('old')
      await Promise.all([old, same])
      expect(cache.data.value).toBe('fresh')
      expect(globalCache.get('race')).toBe('fresh')
      expect(fetch).toHaveBeenCalledTimes(2)
    } finally {
      scope.stop()
    }
  })

  it.each(['all', 'group'])('获取途中清理共享缓存 %s，旧响应不回填失效缓存', async (mode) => {
    let finish!: (value: string) => void
    const scope = effectScope()
    const cache = scope.run(() =>
      useAutoRefreshCache<string>(
        'invalidated',
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
        { autoRefresh: false }
      )
    )!
    try {
      const loading = cache.fetchData()
      if (mode === 'all') globalCache.clear()
      else globalCache.clearGroup('default')
      finish('old')
      await loading
      expect(cache.data.value).toBeNull()
      expect(globalCache.get('invalidated')).toBeNull()
    } finally {
      scope.stop()
    }
  })
  afterEach(() => globalCache.clear())

  it('组件创建后才写入的共享缓存仍能在首次加载时命中，手动刷新重新请求', async () => {
    const fetch = vi.fn().mockResolvedValue('network')
    const scope = effectScope()
    const cache = scope.run(() => useAutoRefreshCache('prefetch-race', fetch, { autoRefresh: false }))!
    try {
      globalCache.set('prefetch-race', 'warm')
      expect(await cache.fetchData()).toBe('warm')
      expect(cache.data.value).toBe('warm')
      expect(fetch).not.toHaveBeenCalled()
      expect(await cache.fetchData(true)).toBe('network')
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally {
      scope.stop()
    }
  })
})
