import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMockState } from '@/test/mockBackend'
import { instancePathConfigApi } from './instancePathConfigApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('instancePathConfigApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    instancePathConfigApi.invalidateActiveVersionCache()
    mocks.command.mockResolvedValue({ success: true, data: { activeVersion: '26.2-Forge' } })
  })

  it('caches a successful active version read for the normalized path', async () => {
    await expect(instancePathConfigApi.getActiveVersion('D:\\mc\\Launcher\\.minecraft')).resolves.toBe('26.2-Forge')
    await expect(instancePathConfigApi.getActiveVersion('d:/mc/Launcher/.minecraft/')).resolves.toBe('26.2-Forge')

    expect(mocks.command).toHaveBeenCalledTimes(1)
    expect(mocks.command).toHaveBeenCalledWith('game_config_get', { game_path: 'D:\\mc\\Launcher\\.minecraft' })
  })

  it('coalesces concurrent reads and allows a failed read to retry', async () => {
    let resolveRead: ((value: unknown) => void) | undefined
    mocks.command.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve
        })
    )

    const first = instancePathConfigApi.getActiveVersion('D:/mc/Launcher/.minecraft')
    const second = instancePathConfigApi.getActiveVersion('d:\\mc\\Launcher\\.minecraft\\')
    await Promise.resolve()

    expect(mocks.command).toHaveBeenCalledTimes(1)
    resolveRead?.({ success: true, data: { activeVersion: '26.2-Fabric' } })
    await expect(Promise.all([first, second])).resolves.toEqual(['26.2-Fabric', '26.2-Fabric'])

    mocks.command.mockRejectedValueOnce(new Error('IPC unavailable'))
    instancePathConfigApi.invalidateActiveVersionCache('D:/mc/Launcher/.minecraft')
    await expect(instancePathConfigApi.getActiveVersion('D:/mc/Launcher/.minecraft')).rejects.toThrow('IPC unavailable')

    mocks.command.mockResolvedValueOnce({ success: true, data: { activeVersion: '26.2-NeoForge' } })
    await expect(instancePathConfigApi.getActiveVersion('D:/mc/Launcher/.minecraft')).resolves.toBe('26.2-NeoForge')
  })

  it('caches an empty active version and refreshes it only when forced', async () => {
    mocks.command.mockResolvedValueOnce({ success: true, data: {} })
    mocks.command.mockResolvedValueOnce({ success: true, data: { activeVersion: '26.2-Quilt' } })

    await expect(instancePathConfigApi.getActiveVersion('D:/mc/Empty/.minecraft')).resolves.toBeNull()
    await expect(instancePathConfigApi.getActiveVersion('D:/mc/Empty/.minecraft')).resolves.toBeNull()
    expect(mocks.command).toHaveBeenCalledTimes(1)

    await expect(instancePathConfigApi.getActiveVersion('D:/mc/Empty/.minecraft', { force: true })).resolves.toBe(
      '26.2-Quilt'
    )
    expect(mocks.command).toHaveBeenCalledTimes(2)
  })

  it('updates the read cache after a successful configuration write', async () => {
    await instancePathConfigApi.getActiveVersion('D:/mc/Other/.minecraft')
    mocks.command.mockResolvedValueOnce({ success: true, data: { activeVersion: '26.2-Fabric' } })

    await instancePathConfigApi.patchConfig('D:/mc/Other/.minecraft', { activeVersion: '26.2-Fabric' })
    await expect(instancePathConfigApi.getActiveVersion('D:/mc/Other/.minecraft')).resolves.toBe('26.2-Fabric')

    expect(mocks.command).toHaveBeenCalledTimes(2)
  })

  it('coalesces duplicate active version writes for the same normalized path', async () => {
    let resolveWrite: ((value: unknown) => void) | undefined
    mocks.command.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve
        })
    )

    const first = instancePathConfigApi.setActiveVersion('D:\\mc\\HMCL\\.minecraft', '26.2-Forge')
    const second = instancePathConfigApi.setActiveVersion('d:/mc/HMCL/.minecraft/', '26.2-Forge')
    await Promise.resolve()

    expect(mocks.command).toHaveBeenCalledTimes(1)
    resolveWrite?.({ success: true, data: { activeVersion: '26.2-Forge' } })
    await Promise.all([first, second])
  })

  it('skips a write when the backend read already confirmed the same version', async () => {
    await instancePathConfigApi.getActiveVersion('D:/mc/Other/.minecraft')
    await instancePathConfigApi.setActiveVersion('D:/mc/Other/.minecraft', '26.2-Forge')

    expect(mocks.command).toHaveBeenCalledTimes(1)
    expect(mocks.command).toHaveBeenCalledWith('game_config_get', { game_path: 'D:/mc/Other/.minecraft' })
  })
})
