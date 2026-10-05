import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import type { ScannedVersion } from '@/types/instances'
import { useInstanceStore } from './instanceStore'

const mocks = vi.hoisted(() => ({ getActiveVersion: vi.fn(), setActiveVersion: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    game: { active_path: '', minecraft_paths: [] },
    patchGame: vi.fn().mockResolvedValue(undefined),
  }),
}))
vi.mock('@/features/instances/api/instancePathConfigApi', () => ({ instancePathConfigApi: mocks }))
vi.mock('@/features/instances/api/instanceInstallApi', () => ({
  instanceInstallApi: { scan: vi.fn(), onVersionsChanged: vi.fn(() => vi.fn()) },
}))

describe('目录选择时序', () => {
  it('扫描已确认的同根目录别名时替换原实例，不累计重复卡片', async () => {
    const store = useInstanceStore()
    const version = {
      versionId: 'same',
      path: 'A',
      rootKey: 'canonical-root',
      instanceKey: 'canonical-root\0same',
    } as ScannedVersion
    vi.mocked(instanceInstallApi.scan)
      .mockResolvedValueOnce([version])
      .mockResolvedValueOnce([{ ...version, path: 'AliasA' }])
    await store.scanPath('A')
    await store.scanPath('AliasA')
    expect(store.scannedVersions).toHaveLength(1)
    expect(store.scannedVersions[0]?.path).toBe('AliasA')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  it('A 的迟到结果不能将最后选中的 B 切回 A', async () => {
    let finishA!: (value: string) => void
    mocks.getActiveVersion.mockImplementation((path: string) =>
      path === 'A'
        ? new Promise((resolve) => {
            finishA = resolve
          })
        : Promise.resolve('same')
    )
    const store = useInstanceStore()
    store.scannedVersions = ['A', 'B'].map((path) => ({
      path,
      versionId: 'same',
      primaryLoader: 'Fabric',
      isBroken: false,
    })) as ScannedVersion[]
    const first = store.switchPath('A')
    await store.switchPath('B')
    finishA('same')
    await first
    expect(store.currentGamePath).toBe('B')
    expect(mocks.setActiveVersion).toHaveBeenCalledTimes(1)
    expect(mocks.setActiveVersion).toHaveBeenCalledWith('B', 'same')
  })
})
