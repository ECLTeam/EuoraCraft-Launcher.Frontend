import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NDropdown, type DropdownOption } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UiIcon from '@/components/ui/Icon.vue'
import { instanceProfileApi } from '@/features/instances/api/instanceProfileApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { i18n } from '@/i18n'
import type { ScannedVersion } from '@/types/instances'
import InstalledInstanceList from './InstalledInstanceList.vue'
import InstanceListToolbar from './InstanceListToolbar.vue'

enableAutoUnmount(afterEach)

vi.mock('@/features/instances/api/instanceProfileApi', () => ({
  targetFromVersion: (version: ScannedVersion) => ({ gamePath: version.path, versionId: version.versionId }),
  instanceProfileApi: {
    categories: vi.fn().mockResolvedValue([]),
    patch: vi.fn().mockResolvedValue({}),
    setPinOrder: vi.fn().mockResolvedValue(undefined),
  },
}))

const versions: ScannedVersion[] = [
  {
    id: 'fabric-1.21.1',
    versionId: 'Fabric 1.21.1',
    versionType: 'release',
    path: 'C:\\Games\\.minecraft',
    displayName: '生存服',
    primaryLoader: 'Fabric',
    vanillaName: '1.21.1',
    hasForge: false,
    hasNeoForge: false,
    hasFabric: true,
    hasQuilt: false,
    jsonPath: 'C:\\Games\\.minecraft\\versions\\fabric.json',
  },
  {
    id: 'vanilla-1.20.1',
    versionId: '1.20.1',
    versionType: 'release',
    path: 'C:\\Games\\.minecraft',
    displayName: '原版',
    primaryLoader: 'Vanilla',
    vanillaName: '1.20.1',
    hasForge: false,
    hasNeoForge: false,
    hasFabric: false,
    hasQuilt: false,
    jsonPath: 'C:\\Games\\.minecraft\\versions\\1.20.1.json',
  },
]

function mountVersionList(searchQuery = '', items = structuredClone(versions), pinia = createPinia()) {
  vi.spyOn(useSettingsStore(pinia), 'patchUi').mockResolvedValue(undefined)
  return mount(InstalledInstanceList, {
    global: {
      plugins: [i18n, pinia],
      components: { UiIcon },
    },
    props: {
      versions: items,
      selectedPathIndex: 0,
      pathCount: 1,
      pathName: '主目录',
      pathLocation: 'C:\\Games\\.minecraft',
      loading: false,
      refreshLoading: false,
      searchQuery,
      selectedVersion: '',
    },
  })
}

describe('InstalledInstanceList', () => {
  beforeEach(() => vi.clearAllMocks())
  it('顶部使用筛选和排序入口替代平铺控件', () => {
    const wrapper = mountVersionList()
    expect(wrapper.find('.filter-toggle').exists()).toBe(true)
    expect(wrapper.find('.sort-toggle').exists()).toBe(true)
    expect(wrapper.find('.toolbar-select').exists()).toBe(false)
  })
  it('按版本名称过滤列表', async () => {
    const wrapper = mountVersionList('fabric')
    // 默认视图为列表；切到卡片视图以断言卡片数量按筛选收敛
    await wrapper.get('[title="卡片视图"]').trigger('click')

    expect(wrapper.findAll('.instance-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('Fabric 1.21.1')
    expect(wrapper.text()).not.toContain('1.20.1')
  })

  it('将启动操作作为版本事件抛出', async () => {
    const wrapper = mountVersionList()

    await wrapper.get('[title="卡片视图"]').trigger('click')
    await wrapper.get('.play-button').trigger('click')

    expect(wrapper.emitted('launch')).toEqual([[versions[0]]])
  })

  it('列表合并版本信息并保留完整名称与标签提示', () => {
    const items = structuredClone(versions)
    Object.assign(items[0]!, { loaderVersion: '0.16.9', tags: ['生存', '建筑', '朋友'], favorite: true, pinned: true })
    const wrapper = mountVersionList('', items)
    const row = wrapper.get('.table-row')

    expect(wrapper.find('.table-header').exists()).toBe(false)
    expect(row.get('.instance-name').text()).toBe('生存服')
    expect(row.get('.instance-name').attributes('title')).toContain('Fabric 1.21.1')
    expect(row.get('.instance-meta').text()).toBe('Minecraft 1.21.1 · Fabric v0.16.9')
    expect(row.get('.instance-labels').attributes('title')).toContain('#朋友')
    expect(row.findAll('.tag-badge').map((tag) => tag.text())).toEqual(['#生存', '#建筑', '+1'])
    expect(row.find('[aria-label="已收藏"]').exists()).toBe(true)
    expect(row.find('[aria-label="已置顶"]').exists()).toBe(true)
    expect(wrapper.findAll('.quick-launch-button')).toHaveLength(2)
    expect(row.findAll('button')).toHaveLength(3)
  })

  it('列表启动、详情与更多操作不触发行选择', async () => {
    const wrapper = mountVersionList()
    const row = wrapper.get('.table-row')
    await row.get('.quick-launch-button').trigger('click')
    await row.get('[title="详情与设置"]').trigger('click')
    await row.get('[title="更多操作"]').trigger('click')
    expect(wrapper.emitted('launch')).toEqual([[versions[0]]])
    expect(wrapper.emitted('detail')).toEqual([[versions[0]]])
    expect(wrapper.emitted('selectVersion')).toBeUndefined()
    await row.trigger('click')
    expect(wrapper.emitted('selectVersion')).toEqual([[versions[0]]])
  })

  it.each(['release', 'Release', 'snapshot', 'Snapshot'])('辅助信息识别后端 %s 类型', (versionType) => {
    const items = structuredClone(versions)
    // IPC 运行时存在首字母大写的类型值，测试真实边界形态。
    Object.assign(items[0]!, { versionType })
    const wrapper = mountVersionList('', items)
    const metadata = wrapper.get('.instance-meta').text()
    expect(metadata).toBe(`Minecraft 1.21.1 · Fabric${versionType.toLowerCase() === 'snapshot' ? ' · 快照版' : ''}`)
  })

  it.each(['favorite', 'pinned', 'hidden'] as const)('更多菜单更新 %s 并允许取消', async (field) => {
    const items = structuredClone(versions)
    const wrapper = mountVersionList('', items)
    for (const value of [true, false]) {
      if (!value && field === 'hidden') wrapper.getComponent(InstanceListToolbar).vm.$emit('update:showHidden', true)
      await flushPromises()
      await wrapper.get('.table-row [title="更多操作"]').trigger('click')
      wrapper.getComponent(NDropdown).vm.$emit('select', field)
      await flushPromises()
      expect(instanceProfileApi.patch).toHaveBeenLastCalledWith(
        { gamePath: versions[0]!.path, versionId: versions[0]!.versionId },
        { [field]: value }
      )
      expect(items[0]![field]).toBe(value)
    }
  })

  it('更多菜单删除复用原删除事件', async () => {
    const wrapper = mountVersionList()
    await wrapper.get('.table-row [title="更多操作"]').trigger('click')
    wrapper.getComponent(NDropdown).vm.$emit('select', 'delete')
    await flushPromises()
    expect(wrapper.emitted('remove')).toEqual([[versions[0]]])
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('更多菜单保留实例工作台、资源管理和文件夹入口', async () => {
    const wrapper = mountVersionList()
    await wrapper.get('.table-row [title="更多操作"]').trigger('click')
    const dropdown = wrapper.getComponent(NDropdown)
    const options = dropdown.props('options')! as DropdownOption[]
    const resources = options.find((option) => option.key === 'manage')!
    expect(resources.children?.map((option) => option.key)).toContain('mods')
    expect(options.find((option) => option.key === 'folders')?.children).toHaveLength(6)
    for (const action of ['overview', 'mods', 'folder-instance', 'profile']) {
      dropdown.vm.$emit('select', action)
      await flushPromises()
    }
    expect(wrapper.emitted('action')).toEqual(
      ['overview', 'mods', 'folder-instance', 'profile'].map((action) => [action, versions[0]])
    )
    await wrapper.findAll('.table-row')[1]!.get('[title="更多操作"]').trigger('click')
    expect(
      (dropdown.props('options')! as DropdownOption[])
        .find((option) => option.key === 'manage')
        ?.children?.map((option) => option.key)
    ).not.toContain('mods')
  })

  it('更多按钮以按钮边缘定位，右键以鼠标位置定位', async () => {
    const wrapper = mountVersionList()
    const row = wrapper.get('.table-row')
    const button = row.get('[title="更多操作"]')
    vi.spyOn(button.element, 'getBoundingClientRect').mockReturnValue({ left: 320, bottom: 180 } as DOMRect)
    await button.trigger('click', { clientX: 333, clientY: 170 })
    expect(wrapper.getComponent(NDropdown).props()).toMatchObject({ x: 320, y: 180, show: true })
    await row.trigger('contextmenu', { clientX: 200, clientY: 140 })
    expect(wrapper.getComponent(NDropdown).props()).toMatchObject({ x: 200, y: 140, show: true })
  })

  it('旧健康标记不隐藏实例启动入口，详情和菜单保持可用', async () => {
    const items = structuredClone(versions)
    Object.assign(items[0]!, { isBroken: true })
    const wrapper = mountVersionList('', items)
    const row = wrapper.get('.table-row')
    expect(row.find('.quick-launch-button').exists()).toBe(true)
    await row.get('.quick-launch-button').trigger('click')
    expect(wrapper.emitted('launch')?.[0]).toEqual([items[0]])
    expect(row.find('[title="详情与设置"]').exists()).toBe(true)
    expect(row.find('[title="更多操作"]').exists()).toBe(true)
  })

  it('工具栏组合筛选保持交集，视图切换保留筛选状态', async () => {
    const items = structuredClone(versions)
    items[0]!.favorite = true
    items[0]!.pinned = true
    items[0]!.categoryId = 'modded'
    const wrapper = mountVersionList('', items)
    const toolbar = wrapper.getComponent(InstanceListToolbar)
    toolbar.vm.$emit('update:favoritesOnly', true)
    toolbar.vm.$emit('update:pinnedOnly', true)
    toolbar.vm.$emit('update:categoryId', 'modded')
    await flushPromises()
    expect(wrapper.findAll('.table-row')).toHaveLength(1)
    expect(toolbar.get('.filter-count').text()).toBe('3')
    await wrapper.get('[title="卡片视图"]').trigger('click')
    expect(wrapper.findAll('.instance-card')).toHaveLength(1)
    expect(toolbar.get('.filter-count').text()).toBe('3')
  })

  it('排序方向更新顺序并与视图一同持久化', async () => {
    const pinia = createPinia()
    const wrapper = mountVersionList('', structuredClone(versions), pinia)
    const toolbar = wrapper.getComponent(InstanceListToolbar)
    const store = useSettingsStore(pinia)
    const save = vi.spyOn(store, 'patchUi').mockResolvedValue(undefined)
    toolbar.vm.$emit('sort', 'gameVersion', 'asc')
    await flushPromises()
    expect(wrapper.findAll('.instance-name').map((name) => name.text())).toEqual(['原版', '生存服'])
    expect(save).toHaveBeenLastCalledWith({
      instanceManager: { viewMode: 'list', sortKey: 'gameVersion', sortDirection: 'asc' },
    })
    toolbar.vm.$emit('sort', 'gameVersion', 'desc')
    await flushPromises()
    expect(wrapper.findAll('.instance-name').map((name) => name.text())).toEqual(['生存服', '原版'])
  })

  it('搜索、刷新、安装与分类管理继续接回父组件', async () => {
    const wrapper = mountVersionList()
    const toolbar = wrapper.getComponent(InstanceListToolbar)
    toolbar.vm.$emit('update:searchQuery', 'fabric')
    toolbar.vm.$emit('refresh')
    toolbar.vm.$emit('install')
    toolbar.vm.$emit('manageCategories')
    await flushPromises()
    expect(wrapper.emitted('update:searchQuery')).toEqual([['fabric']])
    expect(wrapper.emitted('refresh')).toEqual([[]])
    expect(wrapper.emitted('install')).toEqual([[]])
    expect(wrapper.findComponent({ name: 'InstanceCategoryManager' }).props('visible')).toBe(true)
  })
})
