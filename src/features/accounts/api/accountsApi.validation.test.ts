import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMockState } from '@/test/mockBackend'
import { accountsApi } from './accountsApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('accountsApi validation', () => {
  beforeEach(() => {
    mocks.command.mockReset()
  })

  it('离线账户用户名为空时校验失败，不发起 IPC', async () => {
    mocks.command.mockResolvedValue({ success: true, data: {} })
    await expect(accountsApi.addOffline('')).rejects.toThrow(/用户名不能为空/)
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('离线账户 UUID 留空时通过校验，交由后端按用户名派生', async () => {
    mocks.command.mockResolvedValue({ success: true, data: { id: 'offline:uuid' } })

    await accountsApi.addOffline('Steve')

    expect(mocks.command).toHaveBeenCalledWith('accounts_add_offline', {
      username: 'Steve',
      uuid: undefined,
      skin: undefined,
    })
  })

  it('预览离线 UUID 时用户名必填', async () => {
    mocks.command.mockResolvedValue({ success: true, data: {} })

    await expect(accountsApi.previewOfflineUuid('')).rejects.toThrow(/用户名不能为空/)
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('外置登录缺少邮箱时校验失败，不发起 IPC', async () => {
    mocks.command.mockResolvedValue({ success: true, data: {} })
    await expect(accountsApi.addAuthlib('https://auth.example.com', '', 'pass')).rejects.toThrow(/邮箱不能为空/)
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('外置登录服务器地址为空时校验失败，不发起 IPC', async () => {
    mocks.command.mockResolvedValue({ success: true, data: 'ok' })
    await expect(accountsApi.resolveAuthlibServer('')).rejects.toThrow(/服务器地址不能为空/)
    expect(mocks.command).not.toHaveBeenCalled()
  })
})
