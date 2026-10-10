import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMockState } from '@/test/mockBackend'
import { gameHomeApi } from './gameHomeApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('gameHomeApi announcements', () => {
  beforeEach(() => mocks.command.mockReset())

  it('通过新命令读取公告数组', async () => {
    const announcements = [{ id: 'notice', title: '公告', date: '', content: '正文' }]
    mocks.command.mockResolvedValue({ success: true, data: announcements })

    await expect(gameHomeApi.getAnnouncements()).resolves.toEqual(announcements)
    expect(mocks.command).toHaveBeenCalledWith('launcher_announcements_get')
  })

  it('将成功的空数组作为无公告状态', async () => {
    mocks.command.mockResolvedValue({ success: true, data: [] })

    await expect(gameHomeApi.getAnnouncements()).resolves.toEqual([])
  })

  it('保留公告请求失败，避免伪装成正常空状态', async () => {
    mocks.command.mockResolvedValue({ success: false, message: '公告读取失败' })

    await expect(gameHomeApi.getAnnouncements()).rejects.toThrow('公告读取失败')
  })
})
