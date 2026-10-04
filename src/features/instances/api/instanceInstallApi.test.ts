import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMockState } from '@/test/mockBackend'
import { instanceInstallApi } from './instanceInstallApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('instanceInstallApi scan cache', () => {
  it('强制扫描完成后，迟到旧扫描不能重新写入缓存；普通并发调用合并', async () => {
    instanceInstallApi.invalidateScanCache()
    let finish!: (value: { success: boolean; data: never[] }) => void
    mocks.command.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const old = instanceInstallApi.scan(['D:/ScanRace'])
    const same = instanceInstallApi.scan(['D:/ScanRace'])
    mocks.command.mockResolvedValueOnce({ success: true, data: [{ versionId: 'new-version', path: 'D:/ScanRace' }] })
    const fresh = await instanceInstallApi.scan(['D:/ScanRace'], { force: true })
    finish({ success: true, data: [] })
    await Promise.all([old, same])
    expect(await instanceInstallApi.scan(['D:/ScanRace'])).toEqual(fresh)
    expect(fresh[0]?.versionId).toBe('new-version')
    expect(mocks.command).toHaveBeenCalledTimes(2)
  })
  beforeEach(() => {
    mocks.command.mockReset()
    instanceInstallApi.invalidateScanCache()
  })

  it('复用扫描结果，并在强制刷新或后端变更事件后重新请求', async () => {
    mocks.command.mockResolvedValue({
      success: true,
      data: [{ versionId: '1.21.1', path: 'D:\\Minecraft' }],
    })
    const changed = vi.fn()
    const stop = instanceInstallApi.onVersionsChanged(changed)

    await instanceInstallApi.scan(['D:\\Minecraft'])
    await instanceInstallApi.scan(['D:\\Minecraft'])
    expect(mocks.command).toHaveBeenCalledTimes(1)

    await instanceInstallApi.scan(['D:\\Minecraft'], { force: true })
    expect(mocks.command).toHaveBeenCalledTimes(2)
    expect(mocks.command).toHaveBeenLastCalledWith('game_scan', {
      paths: ['D:\\Minecraft'],
      force: true,
    })

    await instanceInstallApi.scan(['D:\\Minecraft'])
    expect(mocks.command).toHaveBeenCalledTimes(2)

    mocks.handlers['game:versions_changed']?.({ gamePath: 'D:/Minecraft' })
    expect(changed).toHaveBeenCalledWith({ gamePath: 'D:/Minecraft' })
    await instanceInstallApi.scan(['D:\\Minecraft'])
    expect(mocks.command).toHaveBeenCalledTimes(3)

    stop()
  })
})

describe('instanceInstallApi 版本目录请求', () => {
  beforeEach(() => mocks.command.mockReset())

  it('启动预取和页面请求共用在途 IPC，完成后仍允许手动刷新', async () => {
    let finish!: (value: { success: boolean; data: { all: never[] } }) => void
    mocks.command.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const prefetch = instanceInstallApi.getCatalog({ silent: true })
    const page = instanceInstallApi.getCatalog()
    expect(mocks.command).toHaveBeenCalledTimes(1)
    finish({ success: true, data: { all: [] } })
    expect(await prefetch).toEqual({ all: [] })
    expect(await page).toEqual({ all: [] })

    mocks.command.mockResolvedValueOnce({ success: true, data: { all: [] } })
    await instanceInstallApi.getCatalog()
    expect(mocks.command).toHaveBeenCalledTimes(2)
  })

  it('静默预取失败后允许页面重新请求', async () => {
    mocks.command.mockResolvedValueOnce({ success: false, message: '网络暂不可用' })
    await expect(instanceInstallApi.getCatalog({ silent: true })).rejects.toThrow('网络暂不可用')
    mocks.command.mockResolvedValueOnce({ success: true, data: { all: [] } })
    await expect(instanceInstallApi.getCatalog()).resolves.toEqual({ all: [] })
    expect(mocks.command).toHaveBeenCalledTimes(2)
  })
})
