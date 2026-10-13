import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import type { BackendMockState } from '@/test/mockBackend'
import { instanceSettingsApi } from './instanceSettingsApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('instanceSettingsApi', () => {
  beforeEach(() => {
    queryClient.clear()
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ success: true, data: {} })
    mocks.set.mockResolvedValue({ success: true })
    mocks.command.mockResolvedValue({ success: true, data: {} })
  })

  it('保存独立设置后，迟到的有效设置读取必须重新取得最新结果', async () => {
    const target = { versionId: 'fixture', path: 'C:/Minecraft' }
    let finish!: (value: unknown) => void
    mocks.command.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const reading = instanceSettingsApi.effective(target)
    mocks.command.mockResolvedValueOnce({ success: true, data: {} })
    await instanceSettingsApi.save(target, { memory: 6144 })
    mocks.command.mockResolvedValueOnce({ success: true, data: { memory: 6144 } })
    finish({ success: true, data: { memory: 4096 } })
    expect(await reading).toEqual({ memory: 6144 })
    expect(mocks.command).toHaveBeenCalledTimes(3)
  })

  it('将独立设置保存到版本自己的设置文件', async () => {
    await instanceSettingsApi.save(
      { versionId: '1.21.5', path: 'D:\\Games\\.minecraft' },
      {
        isolationMode: 'enabled',
        customMemory: true,
        memory: 6144,
        customJava: false,
        javaPath: '',
        jvmArgs: '-XX:+UseG1GC',
        gameArgs: '',
        wrapperCommand: '',
        postExitCommand: '',
        envVars: '',
        windowTitle: '',
        launcherVisibility: 'inherit',
      }
    )

    expect(mocks.command).toHaveBeenCalledWith('game_version_settings_set', {
      game_path: 'D:\\Games\\.minecraft',
      version_id: '1.21.5',
      data: expect.objectContaining({
        isolationMode: 'enabled',
        memory: 6144,
        jvmArgs: '-XX:+UseG1GC',
      }),
    })
  })

  it('从版本自己的设置文件读取该版本独立设置', async () => {
    mocks.command.mockResolvedValue({
      success: true,
      data: {
        isolated: true,
        customMemory: true,
        memory: 6144,
        customJava: false,
        javaPath: '',
        jvmArgs: '',
        gameArgs: '',
        wrapperCommand: '',
        postExitCommand: '',
        envVars: '',
        windowTitle: '',
        launcherVisibility: 'inherit',
      },
    })

    const result = await instanceSettingsApi.get({ versionId: '1.21.5', path: 'D:\\Games\\.minecraft' })

    expect(mocks.command).toHaveBeenCalledWith('game_version_settings_get', {
      game_path: 'D:\\Games\\.minecraft',
      version_id: '1.21.5',
    })
    expect(result).toMatchObject({ isolationMode: 'enabled', customMemory: true, memory: 6144 })
  })

  it('接受后端已消除歧义的历史覆盖，不读取全局旧分区', async () => {
    mocks.command.mockResolvedValue({ success: true, data: { isolated: true, memory: 8192 } })
    expect(await instanceSettingsApi.get({ versionId: '1.20.1', path: 'D:/Game' })).toMatchObject({
      isolationMode: 'enabled',
      memory: 8192,
    })
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('读取不存在的版本设置时返回默认值', async () => {
    const result = await instanceSettingsApi.get({ versionId: '1.20.1', path: 'Showcase/.minecraft' })

    expect(result).toMatchObject({
      isolationMode: 'inherit',
      customMemory: false,
      memory: 4096,
      customJava: false,
    })
  })

  it('保存后清除 setting.json 中的旧版该版本配置', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: {
        'd:/games/.minecraft::1.20.1': {
          isolationMode: 'disabled',
          customMemory: false,
          memory: 4096,
          customJava: false,
          javaPath: '',
          jvmArgs: '',
          gameArgs: '',
          wrapperCommand: '',
          postExitCommand: '',
          envVars: '',
          windowTitle: '',
          launcherVisibility: 'inherit',
        },
      },
    })

    await instanceSettingsApi.save(
      { versionId: '1.20.1', path: 'D:\\Games\\.minecraft' },
      {
        isolationMode: 'enabled',
        customMemory: true,
        memory: 8192,
        customJava: false,
        javaPath: '',
        jvmArgs: '',
        gameArgs: '',
        wrapperCommand: '',
        postExitCommand: '',
        envVars: '',
        windowTitle: '',
        launcherVisibility: 'inherit',
      }
    )

    expect(mocks.set).not.toHaveBeenCalled()
  })
})
