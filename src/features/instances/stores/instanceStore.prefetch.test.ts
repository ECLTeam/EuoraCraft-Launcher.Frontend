import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useInstanceStore } from './instanceStore'

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  scan: vi.fn(),
  onVersionsChanged: vi.fn((_handler: (payload: { gamePath: string }) => void) => () => undefined),
}))

vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    load: mocks.loadSettings,
    game: { minecraft_paths: [] },
  }),
}))
vi.mock('@/features/instances/api/instanceInstallApi', () => ({
  instanceInstallApi: { scan: mocks.scan, onVersionsChanged: mocks.onVersionsChanged },
}))

describe('instanceStore 启动预取', () => {
  it('后台版本变更会触发强制全量刷新，而非复用路径旧请求', async () => {
    let changed!: (payload: { gamePath: string }) => void
    mocks.onVersionsChanged.mockImplementationOnce((handler) => {
      changed = handler
      return () => undefined
    })
    const store = useInstanceStore()
    await store.loadAll()
    changed({ gamePath: 'D:/Minecraft' })
    await vi.waitFor(() => expect(mocks.loadSettings).toHaveBeenCalledTimes(2))
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('首页和下载预取共用首次加载，完成后再次确保加载不会覆盖当前选择', async () => {
    let finish!: () => void
    mocks.loadSettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const store = useInstanceStore()
    const home = store.loadAll()
    const prefetch = store.ensureLoaded()
    expect(mocks.loadSettings).toHaveBeenCalledTimes(1)
    finish()
    await Promise.all([home, prefetch])
    await store.ensureLoaded()
    expect(mocks.loadSettings).toHaveBeenCalledTimes(1)
    expect(mocks.scan).not.toHaveBeenCalled()
  })
})
