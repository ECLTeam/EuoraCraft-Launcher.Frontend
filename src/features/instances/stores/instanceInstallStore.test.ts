import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { useInstanceInstallStore } from './instanceInstallStore'

vi.mock('@/features/instances/api/instanceInstallApi', () => ({
  instanceInstallApi: { getLoaderVersions: vi.fn(), getFabricApiVersions: vi.fn(), install: vi.fn() },
}))

describe('加载器选择请求', () => {
  it('重复安装提交明确跳过，保留首个提交状态直到回执', async () => {
    let finish!: (value: { taskId: string; versionId: string; versionName: string }) => void
    vi.mocked(instanceInstallApi.install).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const store = useInstanceInstallStore()
    const params = { version_id: '1.21', game_path: '/Games' }
    const pending = store.install('1.21', params)
    await expect(store.install('1.21', params)).resolves.toEqual({ status: 'skipped' })
    expect(store.isSubmittingInstall).toBe(true)
    expect(instanceInstallApi.install).toHaveBeenCalledOnce()
    finish({ taskId: 'install', versionId: '1.21', versionName: 'instance' })
    await expect(pending).resolves.toMatchObject({ status: 'success' })
    expect(store.isSubmittingInstall).toBe(false)
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    queryClient.clear()
    vi.clearAllMocks()
  })
  it('保留超过 20 个可选版本', async () => {
    const versions = Array.from({ length: 35 }, (_, index) => `0.${index}`)
    vi.mocked(instanceInstallApi.getLoaderVersions).mockResolvedValue(versions)
    const store = useInstanceInstallStore()
    await store.loadLoaderVersions('fabric', '1.21')
    expect(store.loaderVersions.fabric).toEqual(versions)
  })
  it('清空与空游戏版本使旧成功、失败和 loading 失效', async () => {
    let finish!: (versions: string[]) => void
    vi.mocked(instanceInstallApi.getLoaderVersions).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const store = useInstanceInstallStore()
    const pending = store.loadLoaderVersions('fabric', '1.21')
    store.clearLoaderVersions()
    finish(['old'])
    await pending
    expect(store.loaderVersions.fabric).toEqual([])
    expect(store.loaderVersionsLoading).toBe(false)
    let fail!: (error: Error) => void
    vi.mocked(instanceInstallApi.getFabricApiVersions).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        })
    )
    const stale = store.loadFabricApiVersions('1.21')
    await store.loadFabricApiVersions('')
    fail(new Error('old error'))
    await expect(stale).resolves.toBeNull()
    expect(store.fabricApiVersionsLoading).toBe(false)
  })
})
