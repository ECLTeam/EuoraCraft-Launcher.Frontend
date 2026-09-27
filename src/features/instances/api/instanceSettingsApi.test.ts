import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({ success: true, data: {} })
    mocks.set.mockResolvedValue({ success: true })
    mocks.command.mockResolvedValue({ success: true, data: {} })
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

  it('版本设置文件为空时回退读取旧版 setting.json 配置', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: {
        'd:/games/.minecraft::1.20.1': {
          isolated: true,
          customMemory: false,
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
        },
      },
    })

    const result = await instanceSettingsApi.get({ versionId: '1.20.1', path: 'D:\\Games\\.minecraft' })

    expect(result).toMatchObject({ isolationMode: 'enabled', memory: 8192 })
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

    expect(mocks.set).toHaveBeenCalledWith('version_settings', {})
  })
})
