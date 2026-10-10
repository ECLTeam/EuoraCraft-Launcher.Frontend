import { describe, expect, it, vi } from 'vitest'
import type { ModSearchResult } from '@/types/mods'
import { SearchPageCache } from './searchPageCache'

function result(page: number, extra: Partial<ModSearchResult> = {}): ModSearchResult {
  return {
    items: [{ projectId: `project-${page}` }] as ModSearchResult['items'],
    total: 400,
    query: '',
    sources: {},
    page,
    sessionId: 'session',
    hasMore: page < 20,
    ...extra,
  }
}

describe('搜索页缓存和后续五页预加载', () => {
  it('顺序准备第 2～6 页，翻页命中缓存并将窗口补齐到第 7 页', async () => {
    const load = vi.fn(async ({ page }) => result(page))
    const cache = new SearchPageCache(load)
    const first = (await cache.read(1))!
    await cache.prefetch(1, first)
    expect(load.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3, 4, 5, 6])
    expect(load.mock.calls.slice(1).every(([request]) => request.sessionId === 'session')).toBe(true)

    const second = (await cache.read(2))!
    await cache.prefetch(2, second)
    expect(load.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(first.page).toBe(1)
  })

  it('复用预加载中的页面请求，实际请求先于未派发的后台页', async () => {
    let finish!: (response: ModSearchResult) => void
    const load = vi.fn(({ page }) =>
      page === 2 ? new Promise<ModSearchResult>((resolve) => (finish = resolve)) : Promise.resolve(result(page))
    )
    const cache = new SearchPageCache(load)
    const first = (await cache.read(1))!
    const background = cache.prefetch(1, first)
    const second = cache.read(2)
    const foreground = cache.read(8)
    finish(result(2))
    expect((await second)?.page).toBe(2)
    expect((await foreground)?.page).toBe(8)
    await background
    expect(load.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 8, 3, 4, 5, 6])
  })

  it.each([{ hasMore: false }, { truncated: true }])('遇到末页或截断停止派发：%j', async (boundary) => {
    const load = vi.fn(async ({ page }) => result(page, page === 3 ? boundary : {}))
    const cache = new SearchPageCache(load)
    const first = (await cache.read(1))!
    await cache.prefetch(1, first)
    expect(load.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3])
  })

  it('单来源使用总数判断末页', async () => {
    const load = vi.fn(async ({ page }) => result(page, { total: 45, hasMore: undefined }))
    const cache = new SearchPageCache(load)
    await cache.prefetch(1, (await cache.read(1))!)
    expect(load.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 3])
  })

  it('空页面仍有候选时不跳页，实际继续读取绕过空缓存', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(result(1, { items: [] }))
      .mockResolvedValue(result(1))
    const cache = new SearchPageCache(load)
    await cache.prefetch(1, (await cache.read(1))!)
    expect(load).toHaveBeenCalledTimes(1)
    expect((await cache.read(1))?.items).toHaveLength(1)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('后端未推进页码时停止，不循环读取后续页', async () => {
    const load = vi.fn(async () => result(1))
    const cache = new SearchPageCache(load)
    await cache.prefetch(1, (await cache.read(1))!)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('后台失败保持当前缓存，实际取页仍报告错误并允许重试', async () => {
    const load = vi.fn().mockResolvedValueOnce(result(1)).mockRejectedValue(new Error('离线'))
    const cache = new SearchPageCache(load)
    await cache.prefetch(1, (await cache.read(1))!)
    expect((await cache.read(1))?.page).toBe(1)
    await expect(cache.read(2)).rejects.toThrow('离线')
    load.mockResolvedValue(result(2))
    expect((await cache.read(2))?.page).toBe(2)
  })

  it('作废会话后丢弃在途响应，停止后续派发', async () => {
    let finish!: (response: ModSearchResult) => void
    const load = vi.fn(() => new Promise<ModSearchResult>((resolve) => (finish = resolve)))
    const cache = new SearchPageCache(load)
    const pending = cache.read(1)
    const queued = cache.read(2)
    cache.dispose()
    finish(result(1))
    expect(await pending).toBeUndefined()
    expect(await queued).toBeUndefined()
    expect(await cache.read(1)).toBeUndefined()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('缓存有数量和有效期限制，刷新标记只用于首个请求', async () => {
    let now = 0
    const load = vi.fn(async ({ page }) => result(page))
    const cache = new SearchPageCache(load, { maxEntries: 2, refresh: true, now: () => now })
    await cache.read(1)
    await cache.read(2)
    await cache.read(3)
    await cache.read(1)
    expect(load).toHaveBeenCalledTimes(4)
    now = 600_001
    await cache.read(1)
    expect(load).toHaveBeenCalledTimes(5)
    expect(load.mock.calls.map(([request]) => request.refresh)).toEqual([true, false, false, false, false])
  })
})
