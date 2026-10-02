import { flushPromises, mount } from '@vue/test-utils'
import { NDropdown } from 'naive-ui'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import type { ScannedVersion, WorldEntry } from '@/types/instances'
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

describe('InstanceWorldsTab exact seeds', () => {
  let world: WorldEntry
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.command.mockReset()
    instanceWorkspaceApi.invalidateCache(target)
    world = { id: 'world', name: '测试世界', path: 'saves/world', seed: '-4172144997902289642', version: '1.20.1' }
    mocks.command.mockImplementation((command, payload) => {
      if (command === 'game_world_list') return Promise.resolve({ success: true, data: [world] })
      if (command === 'game_world_patch') {
        world = { ...world, ...(payload.patch.seed !== undefined ? { seed: payload.patch.seed } : {}) }
        return Promise.resolve({ success: true, data: world })
      }
      if (command === 'open_url') return Promise.resolve({ success: true, data: {} })
      throw new Error(`Unexpected command: ${command}`)
    })
  })

  async function openEditor() {
    const wrapper = await mountWorlds()
    await wrapper.get('button[title="难度与作弊"]').trigger('click')
    await flushPromises()
    const label = wrapper.findAll('.world-editor label').find((label) => label.text().includes('世界种子'))!
    return { wrapper, input: label.get('input') }
  }

  it('长种子编辑文本保留全部数位，保存其他字段不会提交种子', async () => {
    const { wrapper, input } = await openEditor()
    expect(input.element.value).toBe(world.seed)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存（自动备份）')!
      .trigger('click')
    await flushPromises()
    const patch = mocks.command.mock.calls.find(([command]) => command === 'game_world_patch')![1].patch
    expect(patch).not.toHaveProperty('seed')
    wrapper.unmount()
  })

  it.each(['-9223372036854775808', '9223372036854775807', '0'])('修改种子通过字符串精确传输：%s', async (seed) => {
    const { wrapper, input } = await openEditor()
    await input.setValue(seed)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存（自动备份）')!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith(
      'game_world_patch',
      expect.objectContaining({ patch: expect.objectContaining({ seed }) })
    )
    expect(wrapper.get('.world-card').text()).toContain(`种子 ${seed}`)
    wrapper.unmount()
  })

  it.each(['1e3', '1.5', '9223372036854775808', '-9223372036854775809', ''])(
    '非法种子不发送保存请求：%s',
    async (seed) => {
      const { wrapper, input } = await openEditor()
      await input.setValue(seed)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === '保存（自动备份）')!
        .trigger('click')
      await flushPromises()
      expect(mocks.command.mock.calls.some(([command]) => command === 'game_world_patch')).toBe(false)
      expect(wrapper.find('.world-editor').exists()).toBe(true)
      wrapper.unmount()
    }
  )

  it.each(['', 'None'])('未知种子统一占位且不能编辑或打开 Chunkbase：%s', async (seed) => {
    world.seed = seed
    const { wrapper, input } = await openEditor()
    expect(wrapper.get('.world-card').text()).toContain('种子 未知')
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.element.value).toBe('')
    expect(wrapper.get('button[title="Chunkbase"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('保存失败保留种子编辑文本和弹窗', async () => {
    const { wrapper, input } = await openEditor()
    await input.setValue('9223372036854775807')
    mocks.command.mockResolvedValueOnce({ success: false, message: '存档正在被占用' })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存（自动备份）')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('.world-editor').exists()).toBe(true)
    expect(input.element.value).toBe('9223372036854775807')
    wrapper.unmount()
  })
})

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

  it.each([
    ['world-import', 'D:/Exports/world.zip'],
    ['world-import-folder', 'D:/Exports/world'],
    ['world-import', ''],
    ['world-import-folder', ''],
  ])('两种存档导入入口与取消行为：%s %s', async (purpose, path) => {
    const wrapper = await mountWorlds()
    mocks.command.mockResolvedValueOnce({ success: true, data: { path } })
    wrapper.getComponent(NDropdown).vm.$emit('select', purpose)
    await flushPromises()

    expect(mocks.command).toHaveBeenCalledWith('select_file', { purpose })
    if (path) {
      expect(mocks.command).toHaveBeenCalledWith('game_world_import', { ...target, source_path: path })
    } else {
      expect(mocks.command).not.toHaveBeenCalledWith('game_world_import', expect.anything())
    }
  })

  it('导入菜单提供 ZIP 和文件夹选项，打开菜单不立即选择文件', async () => {
    const wrapper = await mountWorlds()
    expect(wrapper.getComponent(NDropdown).props('options')).toEqual([
      { label: 'ZIP 文件', key: 'world-import' },
      { label: '存档文件夹', key: 'world-import-folder' },
    ])
    await wrapper.get('.worlds-toolbar button[aria-label="导入存档"]').trigger('click')
    await flushPromises()
    expect(mocks.command).not.toHaveBeenCalledWith('select_file', expect.anything())
  })
})
