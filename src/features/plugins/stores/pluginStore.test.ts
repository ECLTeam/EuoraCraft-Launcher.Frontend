import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import { usePluginStore } from './pluginStore'

vi.mock('@/features/plugins/api/pluginManagementApi', () => ({
  pluginManagementApi: {
    list: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    reload: vi.fn(),
    unload: vi.fn(),
    installFromDirectory: vi.fn(),
    selectPackage: vi.fn(),
    inspectPackage: vi.fn(),
    installPackage: vi.fn(),
    onStatusChanged: vi.fn(() => vi.fn()),
  },
}))

const plugin = {
  name: 'demo',
  title: 'Demo',
  version: '1.0.0',
  description: '',
  author: '',
  icon: '',
  status: 'enabled',
  error: null,
  dependencies: {},
  services: [],
  is_system: false,
}

describe('pluginStore', () => {
  it('同一插件的重复或冲突动作返回 skipped，不产生第二次执行', async () => {
    let finish!: () => void
    vi.mocked(pluginManagementApi.reload).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const store = usePluginStore()
    const first = store.reload('demo')
    await expect(store.reload('demo')).resolves.toEqual({ status: 'skipped' })
    await expect(store.toggle(plugin)).resolves.toEqual({ status: 'skipped' })
    expect(pluginManagementApi.disable).not.toHaveBeenCalled()
    finish()
    await expect(first).resolves.toEqual({ status: 'success', value: undefined })
  })
  it('插件变更发生在旧列表加载期间时，丢弃旧结果并完成后续刷新', async () => {
    let finish!: (value: Array<typeof plugin>) => void
    vi.mocked(pluginManagementApi.list).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    vi.mocked(pluginManagementApi.list).mockResolvedValue([{ ...plugin, status: 'disabled' }])
    const store = usePluginStore()
    const loading = store.load()
    const changing = store.toggle(plugin)
    await Promise.resolve()
    finish([plugin])
    await Promise.all([loading, changing])
    expect(pluginManagementApi.list).toHaveBeenCalledTimes(2)
    expect(store.plugins[0]?.status).toBe('disabled')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(pluginManagementApi.list).mockResolvedValue([plugin])
  })

  it('按当前状态选择启用或禁用动作', async () => {
    const store = usePluginStore()
    await store.toggle(plugin)

    expect(pluginManagementApi.disable).toHaveBeenCalledWith('demo')
    expect(pluginManagementApi.list).toHaveBeenCalledOnce()
  })

  it('路由重新进入时复用插件列表，并在状态事件后刷新', async () => {
    vi.useFakeTimers()
    const listeners: Array<() => void> = []
    vi.mocked(pluginManagementApi.onStatusChanged).mockImplementation((handler) => {
      listeners.push(handler)
      return vi.fn()
    })
    const store = usePluginStore()

    try {
      await store.start()
      await store.start()
      expect(pluginManagementApi.list).toHaveBeenCalledOnce()

      listeners[0]?.()
      await vi.advanceTimersByTimeAsync(150)
      expect(pluginManagementApi.list).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('重载期间暴露插件级操作状态并在结束后清理', async () => {
    let finishReload: (() => void) | undefined
    vi.mocked(pluginManagementApi.reload).mockImplementation(
      () => new Promise<void>((resolve) => (finishReload = resolve))
    )
    const store = usePluginStore()
    const pending = store.reload('demo')

    expect(store.reloadingPlugins).toEqual(['demo'])
    finishReload?.()
    await pending
    expect(store.reloadingPlugins).toEqual([])
  })

  it('取消安装目录选择时不刷新插件列表', async () => {
    vi.mocked(pluginManagementApi.installFromDirectory).mockResolvedValue(false)
    const store = usePluginStore()

    await expect(store.install()).resolves.toBe(false)

    expect(pluginManagementApi.list).not.toHaveBeenCalled()
  })

  it('目录安装成功后重新读取列表', async () => {
    vi.mocked(pluginManagementApi.installFromDirectory).mockResolvedValue(true)
    const store = usePluginStore()

    await expect(store.install()).resolves.toBe(true)

    expect(pluginManagementApi.list).toHaveBeenCalledOnce()
  })

  it('取消插件包选择时不预检，确认后安装并刷新列表', async () => {
    const preflight = {
      package: {
        name: 'demo',
        version: '1.0.0',
        manifest_sha256: 'a'.repeat(64),
        file_count: 2,
        total_uncompressed_bytes: 123,
      },
      target_tag: 'windows-x86_64-cp312',
      python_dependencies: ['example>=1'],
      wheel_count: 1,
      has_target_lock: true,
      unverified_source: true,
      dependencies_ready: false,
    }
    const store = usePluginStore()
    vi.mocked(pluginManagementApi.selectPackage).mockResolvedValueOnce(null)
    await expect(store.selectPackage()).resolves.toBeNull()
    expect(pluginManagementApi.inspectPackage).not.toHaveBeenCalled()

    vi.mocked(pluginManagementApi.selectPackage).mockResolvedValueOnce('C:/demo.eclplugin')
    vi.mocked(pluginManagementApi.inspectPackage).mockResolvedValueOnce(preflight)
    const selection = await store.selectPackage()
    expect(selection).toEqual({ path: 'C:/demo.eclplugin', preflight })
    expect(pluginManagementApi.installPackage).not.toHaveBeenCalled()

    vi.mocked(pluginManagementApi.installPackage).mockResolvedValue({ status: 'installed', message: '待重启' })
    await expect(store.installPackage(selection!, { allowNetwork: false })).resolves.toEqual({
      status: 'installed',
      message: '待重启',
    })
    expect(pluginManagementApi.installPackage).toHaveBeenCalledWith('C:/demo.eclplugin', {
      allowNetwork: false,
    })
    expect(pluginManagementApi.list).toHaveBeenCalledOnce()
  })
})
