import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NCheckbox, NSelect, NSwitch } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import type { GameResource, GameResourceType, ScannedVersion } from '@/types/instances'
import InstanceResourcesTab from './InstanceResourcesTab.vue'
const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
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
const imageUrl = 'data:image/png;base64,aWNvbg=='
let items: GameResource[]
let wrappers: VueWrapper[] = []

function resource(id: string, iconData?: string | null): GameResource {
  return {
    id,
    name: id,
    type: 'resourcepack',
    path: `${version.path}/resourcepacks/${id}`,
    enabled: true,
    size: 100,
    modifiedAt: '',
    source: 'local',
    iconData,
  }
}

async function mountResources(initialType: GameResourceType = 'resourcepack', allowSwitching = false) {
  const wrapper = mount(InstanceResourcesTab, {
    props: {
      version,
      initialType,
      worldOptions: [{ label: '存档', value: 'world' }],
      allowedTypes: allowSwitching ? ['resourcepack', 'shaderpack'] : [initialType],
    },
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        SchematicPreviewModal: true,
        Modal: true,
        ConfirmDialog: {
          props: ['visible', 'content'],
          emits: ['confirm'],
          template:
            '<div v-if="visible" class="test-confirm"><p>{{ content }}</p><button @click="$emit(\'confirm\')">确认删除</button></div>',
        },
      },
    },
  })
  await flushPromises()
  if (initialType === 'datapack') {
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'world')
    await flushPromises()
  }
  wrappers.push(wrapper)
  return wrapper
}

describe('InstanceResourcesTab resourcepack icons and deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items = [resource('actual.zip', imageUrl), resource('fallback.zip', null)]
    mocks.command.mockReset()
    mocks.command.mockImplementation((command) => {
      if (command === 'game_resource_list') return Promise.resolve({ success: true, data: items })
      if (command === 'game_resource_delete')
        return Promise.resolve({ success: true, data: { deleted: ['actual.zip', 'fallback.zip'], failed: [] } })
      if (command === 'game_resource_toggle') return Promise.resolve({ success: true, data: { enabled: false } })
      throw new Error(`Unexpected command: ${command}`)
    })
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
  })

  it('显示包内图标，缺失图标时显示默认图标', async () => {
    const wrapper = await mountResources()
    const rows = wrapper.findAll('.resource-row')
    expect(rows[0]!.get('.resource-icon img').attributes('src')).toBe(imageUrl)
    expect(rows[1]!.find('.resource-icon img').exists()).toBe(false)
    expect(rows[1]!.find('.resource-icon svg').exists()).toBe(true)
  })

  it('图片加载失败后回退，刷新后允许重新显示图标', async () => {
    const wrapper = await mountResources()
    await wrapper.get('.resource-icon img').trigger('error')
    expect(wrapper.find('.resource-icon img').exists()).toBe(false)
    expect(wrapper.get('.resource-row').find('.resource-icon svg').exists()).toBe(true)

    items = [resource('actual.zip', `${imageUrl}new`)]
    await wrapper.get('button[title="刷新"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('.resource-icon img').attributes('src')).toBe(`${imageUrl}new`)
  })

  it('移除资源包复选框与批量删除入口，逐项删除仍需确认', async () => {
    const wrapper = await mountResources()
    expect(wrapper.findComponent(NCheckbox).exists()).toBe(false)
    expect(wrapper.find('.toolbar-actions button[title="删除"]').exists()).toBe(false)
    await wrapper.get('.resource-row .resource-actions button').trigger('click')
    expect(wrapper.get('.test-confirm').text()).toContain('确定删除 1 个资源？')
    expect(mocks.command).not.toHaveBeenCalledWith('game_resource_delete', expect.anything())
    await wrapper.get('.test-confirm button').trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('game_resource_delete', {
      ...target,
      resource_type: 'resourcepack',
      resource_ids: ['actual.zip'],
      world_id: undefined,
    })
    expect(wrapper.find('.test-confirm').exists()).toBe(false)
  })

  it('搜索后保留对应资源的头像', async () => {
    const wrapper = await mountResources()
    await wrapper.get('input').setValue('fallback')
    expect(wrapper.findAll('.resource-row')).toHaveLength(1)
    expect(wrapper.get('.resource-copy').text()).toContain('fallback.zip')
    expect(wrapper.find('.resource-icon img').exists()).toBe(false)
  })

  it('资源包启停继续调用原接口', async () => {
    const wrapper = await mountResources()
    wrapper.findAllComponents(NSwitch)[0]!.vm.$emit('update:value', false)
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('game_resource_toggle', {
      ...target,
      resource_type: 'resourcepack',
      resource_id: 'actual.zip',
      enabled: false,
      world_id: undefined,
    })
    expect(wrapper.findAllComponents(NSwitch)[0]!.props('value')).toBe(false)
  })

  it.each(['resourcepack', 'shaderpack', 'datapack', 'schematic'] as const)(
    '资源类型 %s 仅在管理模式中显示选择及批量删除',
    async (type) => {
      const wrapper = await mountResources(type)
      expect(wrapper.findComponent(NCheckbox).exists()).toBe(false)
      await wrapper.get('button[title="管理"]').trigger('click')
      const checkboxes = wrapper.get('.resource-table').findAllComponents(NCheckbox)
      expect(checkboxes).toHaveLength(2)
      checkboxes[0]!.vm.$emit('update:checked', true)
      checkboxes[1]!.vm.$emit('update:checked', true)
      await flushPromises()
      await wrapper.get('.toolbar-actions button[title="删除"]').trigger('click')
      await wrapper.get('.test-confirm button').trigger('click')
      await flushPromises()
      expect(mocks.command).toHaveBeenCalledWith('game_resource_delete', {
        ...target,
        resource_type: type,
        resource_ids: ['actual.zip', 'fallback.zip'],
        world_id: type === 'datapack' ? 'world' : undefined,
      })
    }
  )

  it('切换资源类型清理选择，返回后不能删除旧选择', async () => {
    const wrapper = await mountResources('shaderpack', true)
    await wrapper.get('button[title="管理"]').trigger('click')
    wrapper.get('.resource-table').findAllComponents(NCheckbox)[0]!.vm.$emit('update:checked', true)
    await flushPromises()
    expect(wrapper.get('.toolbar-actions button[title="删除"]').attributes('disabled')).toBeUndefined()

    await wrapper.findAll('.resource-tabs button')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(NCheckbox).exists()).toBe(false)
    await wrapper.findAll('.resource-tabs button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(NCheckbox).exists()).toBe(false)
    expect(wrapper.find('.toolbar-actions button[title="删除"]').exists()).toBe(false)
  })
  it('完成管理清空选择，全选只覆盖当前结果', async () => {
    const wrapper = await mountResources()
    await wrapper.get('button[title="管理"]').trigger('click')
    await wrapper.get('input').setValue('actual')
    wrapper.get('.resource-management-bar').getComponent(NCheckbox).vm.$emit('update:checked', true)
    await flushPromises()
    expect(wrapper.get('.resource-management-bar').text()).toContain('1')
    await wrapper.get('button[title="完成"]').trigger('click')
    await wrapper.get('button[title="管理"]').trigger('click')
    expect(wrapper.get('.resource-table').getComponent(NCheckbox).props('checked')).toBe(false)
  })
  it('在线搜索发出资源类型和目标，原理图不提供无支持搜索', async () => {
    const wrapper = await mountResources('datapack')
    await wrapper.get('input').setValue('test')
    await wrapper.get('button[title="在线搜索"]').trigger('click')
    expect(wrapper.emitted('openOnlineSearch')).toEqual([[{ type: 'datapack', worldId: 'world', query: 'test' }]])
    const schematic = await mountResources('schematic')
    expect(schematic.find('button[title="在线搜索"]').exists()).toBe(false)
  })
  it('部分删除失败保留失败项选择', async () => {
    const wrapper = await mountResources()
    await wrapper.get('button[title="管理"]').trigger('click')
    wrapper.get('.resource-management-bar').getComponent(NCheckbox).vm.$emit('update:checked', true)
    mocks.command.mockImplementation((command) => {
      if (command === 'game_resource_delete') {
        items = [resource('fallback.zip')]
        return Promise.resolve({
          success: true,
          data: { deleted: ['actual.zip'], failed: [{ resourceId: 'fallback.zip', message: 'busy' }] },
        })
      }
      return Promise.resolve({ success: true, data: items })
    })
    await flushPromises()
    await wrapper.get('.toolbar-actions button[title="删除"]').trigger('click')
    await wrapper.get('.test-confirm button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.resource-table').getComponent(NCheckbox).props('checked')).toBe(true)
  })
})
