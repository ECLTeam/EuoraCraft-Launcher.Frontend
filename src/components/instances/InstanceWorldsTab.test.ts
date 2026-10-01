import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import type { ScannedVersion } from '@/types/instances'
import InstanceWorldsTab from './InstanceWorldsTab.vue'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}))

const { mocks } = mock.state!
const version: ScannedVersion = {
  id: '1.21.1',
  versionId: '1.21.1',
  versionType: 'release',
  path: 'D:/Games/.minecraft',
  displayName: '1.21.1',
  primaryLoader: 'Vanilla',
  vanillaName: '1.21.1',
  hasForge: false,
  hasNeoForge: false,
  hasFabric: false,
  hasQuilt: false,
  isBroken: false,
  jsonPath: 'D:/Games/.minecraft/versions/1.21.1/1.21.1.json',
}
const target = workspaceTarget(version)

async function mountWorlds() {
  const wrapper = mount(InstanceWorldsTab, {
    props: { version },
    global: { plugins: [createPinia(), i18n], stubs: { Teleport: true } },
  })
  await flushPromises()
  return wrapper
}

describe('InstanceWorldsTab toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.command.mockReset()
    instanceWorkspaceApi.invalidateCache(target)
    mocks.command.mockImplementation((command) => {
      if (command === 'game_world_list') return Promise.resolve({ success: true, data: [] })
      if (command === 'game_options_read') return Promise.resolve({ success: true, data: { options: [] } })
      if (command === 'game_instance_folder_open') return Promise.resolve({ success: true, data: { path: 'saves' } })
      if (command === 'select_file') return Promise.resolve({ success: true, data: { path: '' } })
      if (command === 'game_world_import') return Promise.resolve({ success: true, data: {} })
      throw new Error(`Unexpected command: ${command}`)
    })
  })

  it('辅助图标按钮保留可访问名称和提示，导入保留可见文字', async () => {
    const wrapper = await mountWorlds()
    for (const label of ['刷新', '游戏设置', '打开存档目录']) {
      const button = wrapper.get(`.worlds-toolbar button[aria-label="${label}"]`)
      expect(button.attributes('title')).toBe(label)
      expect(button.text()).toBe('')
      expect(button.find('svg').exists()).toBe(true)
    }
    expect(wrapper.get('.worlds-toolbar button[aria-label="导入存档"]').text()).toBe('导入')
  })

  it('刷新图标重新加载当前实例存档并保持加载期间的禁用状态', async () => {
    const wrapper = await mountWorlds()
    instanceWorkspaceApi.invalidateCache(target, 'worlds')
    let finish: ((response: { success: true; data: [] }) => void) | undefined
    mocks.command.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    const refresh = wrapper.get('.worlds-toolbar button[aria-label="刷新"]')

    await refresh.trigger('click')
    expect(mocks.command).toHaveBeenLastCalledWith('game_world_list', target)
    expect(refresh.classes()).toContain('n-button--loading')
    const requestCount = mocks.command.mock.calls.length
    await refresh.trigger('click')
    expect(mocks.command).toHaveBeenCalledTimes(requestCount)
    finish?.({ success: true, data: [] })
    await flushPromises()
    expect(refresh.classes()).not.toContain('n-button--loading')
  })

  it('游戏设置和打开目录图标仍操作当前实例', async () => {
    const wrapper = await mountWorlds()
    await wrapper.get('.worlds-toolbar button[aria-label="游戏设置"]').trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('game_options_read', target)

    await wrapper.get('.worlds-toolbar button[aria-label="打开存档目录"]').trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('game_instance_folder_open', { ...target, folder: 'saves' })
  })

  it.each(['D:/Exports/world.zip', ''])('导入按钮保留文件选择与取消行为：%s', async (path) => {
    const wrapper = await mountWorlds()
    mocks.command.mockResolvedValueOnce({ success: true, data: { path } })
    await wrapper.get('.worlds-toolbar button[aria-label="导入存档"]').trigger('click')
    await flushPromises()

    expect(mocks.command).toHaveBeenCalledWith('select_file', { purpose: 'world-import' })
    if (path) {
      expect(mocks.command).toHaveBeenCalledWith('game_world_import', { ...target, source_path: path })
    } else {
      expect(mocks.command).not.toHaveBeenCalledWith('game_world_import', expect.anything())
    }
  })
})
