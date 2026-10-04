import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScannedVersion } from '@/types/instances'
import type { ModSearchResult } from '@/types/mods'
import { createPopularRequest, getPopularPage, getResourceSourceConfig } from './downloadQueries'

const mocks = vi.hoisted(() => ({ search: vi.fn(), sourceConfig: vi.fn() }))
vi.mock('@/features/mods/api/modApi', () => ({ modApi: mocks }))
const emptyResult: ModSearchResult = { items: [], sources: {}, total: 0, query: '' }

describe('下载分类按需查询', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.search.mockResolvedValue(emptyResult)
    mocks.sourceConfig.mockResolvedValue({ curseforge: { available: true } })
  })

  it('不主动发起查询，页面相同在途请求合并，结果缓存交给后端', async () => {
    expect(mocks.search).not.toHaveBeenCalled()
    let finish!: (result: ModSearchResult) => void
    mocks.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const first = getPopularPage('mod', null, '')
    const second = getPopularPage('mod', null, '')
    expect(mocks.search).toHaveBeenCalledTimes(1)
    finish(emptyResult)
    await Promise.all([first, second])
    await getPopularPage('mod', null, '')
    expect(mocks.search).toHaveBeenCalledTimes(2)
    expect(mocks.search.mock.lastCall?.[0].refresh).toBe(false)
  })

  it('显式刷新等待旧请求后合并一次新的后端刷新', async () => {
    let finish!: (result: ModSearchResult) => void
    mocks.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const old = getPopularPage('mod', null, '')
    const refresh = getPopularPage('mod', null, '', true)
    const sameRefresh = getPopularPage('mod', null, '', true)
    finish(emptyResult)
    await Promise.all([old, refresh, sameRefresh])
    expect(mocks.search).toHaveBeenCalledTimes(2)
    expect(mocks.search.mock.lastCall?.[0].refresh).toBe(true)
  })

  it('失败不缓存，下一次查询可重新请求', async () => {
    mocks.search.mockRejectedValueOnce(new Error('temporary'))
    await expect(getPopularPage('world', null, '')).rejects.toThrow('temporary')
    await getPopularPage('world', null, '')
    expect(mocks.search).toHaveBeenCalledTimes(2)
  })

  it('来源配置合并在途请求，后续页面读取最新后端状态', async () => {
    await Promise.all([getResourceSourceConfig(), getResourceSourceConfig()])
    expect(mocks.sourceConfig).toHaveBeenCalledTimes(1)
    mocks.sourceConfig.mockResolvedValue({ curseforge: { available: false } })
    expect((await getResourceSourceConfig()).curseforge.available).toBe(false)
  })

  it('按页面实际目标和分类构造查询，资源包不附带模组加载器', () => {
    const instance = { vanillaName: '1.21.1', primaryLoader: 'fabric' } as ScannedVersion
    expect(createPopularRequest('mod', instance)).toMatchObject({ game_version: '1.21.1', loader_type: 'fabric' })
    expect(createPopularRequest('resourcepack', instance)).toMatchObject({ game_version: '1.21.1', loader_type: '' })
    expect(createPopularRequest('world', null)).toMatchObject({ source: 'curseforge', resource_type: 'world' })
  })
})
