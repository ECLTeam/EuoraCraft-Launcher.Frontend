import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMockState } from '@/test/mockBackend'
import { pluginManagementApi } from './pluginManagementApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('pluginManagementApi 归档安装', () => {
  beforeEach(() => mocks.command.mockReset())

  it('使用专用文件过滤器，取消选择后不发送预检', async () => {
    mocks.command.mockResolvedValueOnce({ success: true, data: { path: '' } })

    await expect(pluginManagementApi.selectPackage()).resolves.toBeNull()

    expect(mocks.command).toHaveBeenCalledOnce()
    expect(mocks.command).toHaveBeenCalledWith('select_file', { purpose: 'plugin-package' })
  })

  it('预检后显式确认来源并透传网络与离线包选择', async () => {
    const preflight = {
      package: {
        name: 'demo',
        version: '1.0.0',
        manifest_sha256: 'a'.repeat(64),
        file_count: 2,
        total_uncompressed_bytes: 123,
      },
      target_tag: 'windows-x86_64-cp312',
      python_dependencies: [],
      wheel_count: 0,
      has_target_lock: false,
      unverified_source: true,
      runtime_ready: false,
    }
    mocks.command.mockResolvedValueOnce({ success: true, data: preflight })
    mocks.command.mockResolvedValueOnce({ success: true })

    await expect(pluginManagementApi.inspectPackage('C:/demo.eclplugin')).resolves.toEqual(preflight)
    await pluginManagementApi.installPackage('C:/demo.eclplugin', {
      allowNetwork: false,
      offlineRuntimePack: 'C:/runtime.zip',
    })

    expect(mocks.command).toHaveBeenNthCalledWith(1, 'plugin_package_inspect', {
      plugin_path: 'C:/demo.eclplugin',
    })
    expect(mocks.command).toHaveBeenNthCalledWith(2, 'plugin_install', {
      plugin_path: 'C:/demo.eclplugin',
      confirm_unverified_source: true,
      allow_network: false,
      offline_runtime_pack: 'C:/runtime.zip',
    })
  })
})
