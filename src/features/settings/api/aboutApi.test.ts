import { beforeEach, describe, expect, it, vi } from 'vitest'
import backend from '@/api/client'
import type { BackendMockState } from '@/test/mockBackend'
import { aboutApi } from './aboutApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { backend: backendMock, mocks } = mock.state!

describe('aboutApi', () => {
  beforeEach(() => {
    mocks.command.mockReset()
    backendMock.default.runtime.isDesktop = true
  })

  it('桌面模式通过 launcher_info 获取启动器版本', async () => {
    mocks.command.mockResolvedValue({
      success: true,
      data: { version: '1.4.2-alpha.3+20260906', version_type: 'alpha', debug: true },
    })

    await expect(aboutApi.getLauncherInfo()).resolves.toEqual({
      version: '1.4.2-alpha.3+20260906',
      version_type: 'alpha',
      debug: true,
    })
    expect(backend.command).toHaveBeenCalledWith('launcher_info', undefined, undefined)
  })

  it('非桌面模式不会调用 IPC', async () => {
    backendMock.default.runtime.isDesktop = false

    await expect(aboutApi.getLauncherInfo()).resolves.toBeNull()
    expect(backend.command).not.toHaveBeenCalled()
  })

  it('IPC 获取失败时不显示伪造版本', async () => {
    mocks.command.mockResolvedValue({ success: false, message: 'unavailable' })

    await expect(aboutApi.getLauncherInfo()).resolves.toBeNull()
  })
})
