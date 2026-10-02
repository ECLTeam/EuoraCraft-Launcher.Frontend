import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { globalCache } from '@/cache'
import type { ScannedVersion } from '@/types/instances'
import type { ModSearchResult } from '@/types/mods'
import {
  createPopularRequest,
  getPopularPage,
  getResourceSourceConfig,
  prefetchDownloadData,
  prefetchPopularPages,
  prefetchVersionCatalog,
  type DownloadResourceType,
} from './downloadPrefetch'

const mocks = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  search: vi.fn(),
  sourceConfig: vi.fn(),
  ensureLoaded: vi.fn(),
  instanceStore: {
    scannedVersions: [],
    selectedVersion: '',
    currentGamePath: '',
  },
  settingsStore: { download: { resourceInstallCache: {} } },
}))

vi.mock('@/features/instances/api/instanceInstallApi', () => ({
  instanceInstallApi: { getCatalog: mocks.getCatalog },
}))
vi.mock('@/features/mods/api/modApi', () => ({
  modApi: { search: mocks.search, sourceConfig: mocks.sourceConfig },
}))
vi.mock('@/features/instances/stores/instanceStore', () => ({
  useInstanceStore: () => ({ ...mocks.instanceStore, ensureLoaded: mocks.ensureLoaded }),
}))
vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => mocks.settingsStore,
}))

const emptyResult: ModSearchResult = { items: [], sources: {}, total: 0, query: '' }

describe('下载页后台预取', () => {
  beforeEach(() => {
    globalCache.clear()
    vi.clearAllMocks()
    mocks.getCatalog.mockResolvedValue({ all: [] })
    mocks.search.mockResolvedValue(emptyResult)
    mocks.sourceConfig.mockResolvedValue({ curseforge: { available: true } })
    mocks.ensureLoaded.mockResolvedValue(undefined)
  })

  afterEach(() => {
    globalCache.clear()
    vi.restoreAllMocks()
  })

  it('版本目录命中持久缓存时不重复请求，资源来源配置也共享', async () => {
    await prefetchVersionCatalog()
    await prefetchVersionCatalog()
    await getResourceSourceConfig()
    await getResourceSourceConfig()
    expect(mocks.getCatalog).toHaveBeenCalledTimes(1)
    expect(mocks.sourceConfig).toHaveBeenCalledTimes(1)
  })

  it('热门列表按实例与来源合并在途请求，缓存命中后手动刷新仍重新请求', async () => {
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
    expect(mocks.search).toHaveBeenCalledTimes(1)
    await getPopularPage('mod', null, '', true)
    expect(mocks.search).toHaveBeenCalledTimes(2)
    await getPopularPage('mod', null, 'other-instance')
    expect(mocks.search).toHaveBeenCalledTimes(3)
  })

  it('热门列表过期或请求失败后可重新获取', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    await getPopularPage('resourcepack', null, '')
    now += 10 * 60 * 1000 + 1
    await getPopularPage('resourcepack', null, '')
    expect(mocks.search).toHaveBeenCalledTimes(2)

    mocks.search.mockRejectedValueOnce(new Error('temporary'))
    await expect(getPopularPage('world', null, '')).rejects.toThrow('temporary')
    await getPopularPage('world', null, '')
    expect(mocks.search).toHaveBeenCalledTimes(4)
  })

  it('各类请求与页面默认条件一致，预取不会覆盖用户的搜索状态', async () => {
    globalCache.set('mod-search-state:mod', { query: 'fabric' })
    const instance = { vanillaName: '1.21.1', primaryLoader: 'fabric' } as ScannedVersion
    expect(createPopularRequest('world', null)).toMatchObject({ source: 'curseforge', resource_type: 'world' })
    expect(createPopularRequest('mod', null)).toMatchObject({ source: 'all', query: '', limit: 20, offset: 0 })
    expect(createPopularRequest('mod', instance)).toMatchObject({ game_version: '1.21.1', loader_type: 'fabric' })
    expect(createPopularRequest('resourcepack', instance)).toMatchObject({ game_version: '1.21.1', loader_type: '' })
    await getPopularPage('mod', null, '')
    expect(globalCache.get('mod-search-state:mod')).toEqual({ query: 'fabric' })
  })

  it('五类资源逐项预热，单项失败仍继续处理其他分类', async () => {
    let active = 0
    let maximum = 0
    let callCount = 0
    mocks.search.mockImplementation(async () => {
      const callIndex = ++callCount
      active += 1
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 0))
      active -= 1
      if (callIndex === 1) throw new Error('temporary')
      return emptyResult
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const types: DownloadResourceType[] = ['mod', 'resourcepack', 'shaderpack', 'datapack', 'world']
      await prefetchPopularPages(types.map((type) => ({ type, instance: null, targetKey: '' })))
      expect(maximum).toBe(1)
      expect(mocks.search).toHaveBeenCalledTimes(5)
      expect(warning).toHaveBeenCalledTimes(1)
    } finally {
      warning.mockRestore()
    }
  })

  it('版本目录先发起，来源不可用时跳过存档预取', async () => {
    let finishCatalog!: (catalog: { all: never[] }) => void
    mocks.getCatalog.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCatalog = resolve
        })
    )
    mocks.sourceConfig.mockResolvedValue({ curseforge: { available: false } })
    const task = prefetchDownloadData()
    expect(mocks.search).not.toHaveBeenCalled()
    finishCatalog({ all: [] })
    await task
    expect(mocks.search).toHaveBeenCalledTimes(4)
    expect(mocks.search.mock.calls.map(([request]) => request.resource_type)).not.toContain('world')
  })
})
