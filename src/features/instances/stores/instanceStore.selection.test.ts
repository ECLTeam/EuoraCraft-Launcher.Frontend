import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('目录选择时序', () => {
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
