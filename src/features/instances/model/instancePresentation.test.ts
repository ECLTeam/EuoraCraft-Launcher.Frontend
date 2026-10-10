import { describe, expect, it } from 'vitest'
import type { ScannedVersion } from '@/types/instances'
import { filterAndSortInstances } from './instancePresentation'

function version(id: string, patch: Partial<ScannedVersion> = {}): ScannedVersion {
  return {
    id,
    versionId: id,
    versionType: 'release',
    path: 'C:/Games/.minecraft',
    displayName: id,
    primaryLoader: 'Vanilla',
    vanillaName: id,
    hasForge: false,
    hasNeoForge: false,
    hasFabric: false,
    hasQuilt: false,
    jsonPath: `C:/Games/.minecraft/versions/${id}/${id}.json`,
    ...patch,
  }
}

describe('instancePresentation', () => {
  it('始终按置顶顺序、收藏、普通实例分组', () => {
    const result = filterAndSortInstances(
      [
        version('normal', { lastLaunchedAt: '2026-08-13T12:00:00Z' }),
        version('favorite', { favorite: true }),
        version('pin-b', { pinned: true, pinOrder: 2 }),
        version('pin-a', { pinned: true, pinOrder: 1 }),
      ],
      { query: '', showHidden: false, favoritesOnly: false, pinnedOnly: false, categoryId: '' },
      { key: 'lastLaunchedAt', direction: 'desc' }
    )

    expect(result.map((item) => item.versionId)).toEqual(['pin-a', 'pin-b', 'favorite', 'normal'])
  })

  it('最近启动降序时从未启动的实例按显示名称兜底', () => {
    const result = filterAndSortInstances(
      [
        version('b', { alias: '乙' }),
        version('a', { alias: '甲' }),
        version('recent', { lastLaunchedAt: '2026-08-13T12:00:00Z' }),
      ],
      { query: '', showHidden: false, favoritesOnly: false, pinnedOnly: false, categoryId: '' },
      { key: 'lastLaunchedAt', direction: 'desc' }
    )

    expect(result[0]?.versionId).toBe('recent')
    expect(result.slice(1).map((item) => item.alias)).toEqual(['甲', '乙'])
  })

  it('默认排除隐藏实例并搜索别名、描述、标签和加载器', () => {
    const values = [
      version('hidden', { hidden: true, alias: '隐藏' }),
      version('factory', { alias: '朋友服', description: '机械动力', tags: ['生存'], primaryLoader: 'NeoForge' }),
    ]
    const base = { showHidden: false, favoritesOnly: false, pinnedOnly: false, categoryId: '' }

    expect(filterAndSortInstances(values, { ...base, query: '' }, { key: 'name', direction: 'asc' })).toHaveLength(1)
    for (const query of ['朋友', '机械', '生存', 'neoforge']) {
      expect(filterAndSortInstances(values, { ...base, query }, { key: 'name', direction: 'asc' })[0]?.versionId).toBe(
        'factory'
      )
    }
  })
})
