import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMockState } from '@/test/mockBackend'
import { registerGamePathIdentity } from '@/utils/path'
import { instanceWorkspaceApi } from './instanceWorkspaceApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!
const target = { game_path: 'D:/Minecraft', version_id: '1.21.1' }

describe('instanceWorkspaceApi cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    instanceWorkspaceApi.invalidateCache(target)
  })

  it('reuses normalized world lists, clones cached entries, and invalidates after a mutation', async () => {
    registerGamePathIdentity('D:/Minecraft', 'D:/Minecraft')
    registerGamePathIdentity('d:\\minecraft\\', 'D:/Minecraft')
    mocks.command.mockImplementation((name) => {
      if (name === 'game_world_list') {
        return Promise.resolve({ success: true, data: [{ id: 'survival', name: '生存', path: 'saves/survival' }] })
      }
      if (name === 'game_world_delete') return Promise.resolve({ success: true })
      throw new Error(`unexpected command: ${name}`)
    })

    const first = await instanceWorkspaceApi.worlds(target)
    first[0]!.name = '已修改的本地副本'
    const second = await instanceWorkspaceApi.worlds({ game_path: 'd:\\minecraft\\', version_id: '1.21.1' })

    expect(second[0]!.name).toBe('生存')
    expect(mocks.command).toHaveBeenCalledTimes(1)

    await instanceWorkspaceApi.deleteWorld(target, 'survival')
    await instanceWorkspaceApi.worlds(target)
    expect(mocks.command).toHaveBeenCalledTimes(3)
  })

  it('caches screenshot lists and generated thumbnail paths per instance', async () => {
    mocks.command.mockImplementation((name) => {
      if (name === 'game_screenshot_list') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'shot-1',
              name: 'shot.png',
              path: 'screenshots/shot.png',
              width: 1280,
              height: 720,
              size: 1024,
              modifiedAt: '2026-09-19T00:00:00Z',
              dateGroup: '2026-09-19',
            },
          ],
        })
      }
      if (name === 'game_screenshot_thumbnail')
        return Promise.resolve({ success: true, data: { path: 'cache/shot-1.png' } })
      throw new Error(`unexpected command: ${name}`)
    })

    await instanceWorkspaceApi.screenshots(target)
    await instanceWorkspaceApi.screenshots(target)
    await instanceWorkspaceApi.thumbnail(target, 'shot-1')
    await instanceWorkspaceApi.thumbnail(target, 'shot-1')

    expect(mocks.command).toHaveBeenCalledTimes(2)
  })

  it('invalidates the server list after saving a server', async () => {
    mocks.command.mockImplementation((name) => {
      if (name === 'game_server_list') {
        return Promise.resolve({
          success: true,
          data: [{ id: 'local', name: '本地', address: 'localhost', favorite: false, order: 0 }],
        })
      }
      if (name === 'game_server_upsert') {
        return Promise.resolve({
          success: true,
          data: { id: 'local', name: '本地', address: 'localhost', favorite: false, order: 0 },
        })
      }
      throw new Error(`unexpected command: ${name}`)
    })

    await instanceWorkspaceApi.servers(target)
    await instanceWorkspaceApi.saveServer(target, { name: '本地', address: 'localhost' })
    await instanceWorkspaceApi.servers(target)

    expect(mocks.command).toHaveBeenCalledTimes(3)
  })
})
