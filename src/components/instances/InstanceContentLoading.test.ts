import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NCheckbox, NEmpty, NSelect } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UiLoading from '@/components/ui/Loading.vue'
import { instanceWorkspaceApi } from '@/features/instances/api/instanceWorkspaceApi'
import { i18n } from '@/i18n'
import type { GameResource, GameResourceType, ScannedVersion, ScreenshotEntry, ServerEntry } from '@/types/instances'
import InstanceContentState from './InstanceContentState.vue'
import InstanceDetailModsTab from './InstanceDetailModsTab.vue'
import InstanceResourcesTab from './InstanceResourcesTab.vue'
import InstanceScreenshotsTab from './InstanceScreenshotsTab.vue'
import InstanceServersTab from './InstanceServersTab.vue'
import InstanceWorldsTab from './InstanceWorldsTab.vue'
import type { Component } from 'vue'

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  const backend = createMockBackend().backend
  return { ...backend, default: { ...backend.default, file: { toUrl: vi.fn().mockResolvedValue('thumbnail.png') } } }
})
const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => messages }))

const version: ScannedVersion = {
  id: '1.21.1',
  versionId: '1.21.1',
  versionType: 'release',
  path: 'D:/Games/.minecraft',
  displayName: '1.21.1',
  primaryLoader: 'Fabric',
  vanillaName: '1.21.1',
  hasForge: false,
  hasNeoForge: false,
  hasFabric: true,
  hasQuilt: false,
  isBroken: false,
  jsonPath: 'D:/Games/.minecraft/versions/1.21.1/1.21.1.json',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const cases: Array<{
  name: string
  component: Component
  method: 'mods' | 'resources' | 'worlds' | 'servers' | 'screenshots'
  resourceType?: GameResourceType
}> = [
  { name: '模组', component: InstanceDetailModsTab, method: 'mods' },
  ...(['resourcepack', 'shaderpack', 'datapack', 'schematic'] as const).map((resourceType) => ({
    name: resourceType,
    component: InstanceResourcesTab,
    method: 'resources' as const,
    resourceType,
  })),
  { name: '存档', component: InstanceWorldsTab, method: 'worlds' },
  { name: '服务器', component: InstanceServersTab, method: 'servers' },
  { name: '截图', component: InstanceScreenshotsTab, method: 'screenshots' },
]
let wrappers: VueWrapper[] = []
function mountTab(component: Component, extraProps: Record<string, unknown> = {}) {
  const wrapper = mount(component, {
    props: { version, ...extraProps },
    global: {
      plugins: [createPinia(), i18n],
      stubs: { Teleport: true, ConfirmDialog: true, SchematicPreviewModal: true },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
function expectLoading(wrapper: VueWrapper) {
  const content = wrapper.getComponent(InstanceContentState)
  expect(content.findComponent(NEmpty).exists()).toBe(false)
  expect(wrapper.find('.ui-loading--overlay').exists()).toBe(false)
  expect(wrapper.getComponent(UiLoading).props('mode')).toBe('block')
  expect(wrapper.find('.mods-empty, .mod-list-row, .resource-row, .world-card, .server-row, .shot-card').exists()).toBe(
    false
  )
}

describe('实例管理内容状态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(instanceWorkspaceApi, 'mods').mockResolvedValue([])
    vi.spyOn(instanceWorkspaceApi, 'resources').mockResolvedValue([])
    vi.spyOn(instanceWorkspaceApi, 'worlds').mockResolvedValue([])
    vi.spyOn(instanceWorkspaceApi, 'servers').mockResolvedValue([])
    vi.spyOn(instanceWorkspaceApi, 'screenshots').mockResolvedValue([])
    vi.spyOn(instanceWorkspaceApi, 'serverStatuses').mockResolvedValue([])
    vi.spyOn(instanceWorkspaceApi, 'readOptions').mockResolvedValue({
      path: 'options.txt',
      options: [],
      ignoredCount: 0,
    })
  })
  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers = []
    vi.restoreAllMocks()
  })

  it.each(cases)('$name 首次慢请求期间不显示空提示，完成后显示标准空箱', async (entry) => {
    const request = deferred<never[]>()
    vi.spyOn(instanceWorkspaceApi, entry.method).mockReturnValueOnce(request.promise)
    const wrapper = mountTab(
      entry.component,
      entry.resourceType
        ? {
            initialType: entry.resourceType,
            allowedTypes: [entry.resourceType],
            worldOptions: [{ label: '测试存档', value: 'world' }],
          }
        : {}
    )
    if (entry.resourceType === 'datapack') {
      wrapper.getComponent(NSelect).vm.$emit('update:value', 'world')
    }
    await flushPromises()
    expectLoading(wrapper)
    request.resolve([])
    await flushPromises()
    expect(wrapper.findComponent(UiLoading).exists()).toBe(false)
    expect(wrapper.find('.n-empty__icon svg').exists()).toBe(true)
    expect(wrapper.find('.mods-empty').exists()).toBe(false)
  })

  it('资源刷新隐藏旧列表但保留搜索和管理选择，失败后恢复并显示原错误', async () => {
    const resource: GameResource = {
      id: 'test.zip',
      name: '测试包',
      type: 'resourcepack',
      path: 'test.zip',
      enabled: true,
      size: 10,
      modifiedAt: '',
      source: 'local',
    }
    vi.spyOn(instanceWorkspaceApi, 'resources').mockResolvedValue([resource])
    const wrapper = mountTab(InstanceResourcesTab, { initialType: 'resourcepack', allowedTypes: ['resourcepack'] })
    await flushPromises()
    await wrapper.get('input').setValue('测试')
    await wrapper.get('button[title="管理"]').trigger('click')
    wrapper.get('.resource-table').getComponent(NCheckbox).vm.$emit('update:checked', true)
    await flushPromises()
    const request = deferred<GameResource[]>()
    vi.spyOn(instanceWorkspaceApi, 'resources').mockReturnValueOnce(request.promise)
    await wrapper.get('button[title="刷新"]').trigger('click')
    expectLoading(wrapper)
    expect(wrapper.get('input').element.value).toBe('测试')
    request.reject(new Error('读取失败'))
    await flushPromises()
    expect(messages.error).toHaveBeenCalledWith('读取失败')
    expect(wrapper.find('.resource-row').exists()).toBe(true)
    expect(wrapper.get('.resource-table').getComponent(NCheckbox).props('checked')).toBe(true)
    await wrapper.get('input').setValue('不存在')
    expect(wrapper.findComponent(NEmpty).exists()).toBe(true)
    expect(wrapper.find('.resource-row').exists()).toBe(false)
  })

  it('无模组和不支持模组使用相同空箱，添加模组事件仍可触发', async () => {
    const wrapper = mountTab(InstanceDetailModsTab)
    await flushPromises()
    await wrapper.get('.n-empty__extra button').trigger('click')
    expect(wrapper.emitted('openOnlineSearch')).toHaveLength(1)
    const icon = wrapper.get('.n-empty__icon svg').html()
    await wrapper.setProps({ version: { ...version, primaryLoader: 'Vanilla', hasFabric: false } })
    await flushPromises()
    expect(wrapper.get('.n-empty__icon svg').html()).toBe(icon)
    expect(wrapper.find('.n-empty__extra').exists()).toBe(false)
    expect(wrapper.findComponent(UiLoading).exists()).toBe(false)
  })

  it('游戏设置读取期间不出现空提示，完成后才显示空箱', async () => {
    const wrapper = mountTab(InstanceWorldsTab)
    await flushPromises()
    const request = deferred<Awaited<ReturnType<typeof instanceWorkspaceApi.readOptions>>>()
    vi.spyOn(instanceWorkspaceApi, 'readOptions').mockReturnValueOnce(request.promise)
    await wrapper.get('button[aria-label="游戏设置"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('没有检测到可编辑的游戏设置')
    expect(wrapper.find('.ui-loading--block').exists()).toBe(true)
    request.resolve({ path: 'options.txt', options: [], ignoredCount: 0 })
    await flushPromises()
    expect(wrapper.text()).toContain('没有检测到可编辑的游戏设置')
    expect(wrapper.findComponent(UiLoading).exists()).toBe(false)
  })

  it('服务器状态探测保留已加载列表，不触发整页加载', async () => {
    const server: ServerEntry = {
      id: 'server',
      name: '测试服务器',
      address: 'localhost:25565',
      favorite: false,
      order: 0,
    }
    vi.spyOn(instanceWorkspaceApi, 'servers').mockResolvedValue([server])
    const request = deferred<never[]>()
    vi.spyOn(instanceWorkspaceApi, 'serverStatuses').mockReturnValueOnce(request.promise)
    const wrapper = mountTab(InstanceServersTab)
    await flushPromises()
    expect(wrapper.find('.server-row').exists()).toBe(true)
    expect(wrapper.findComponent(UiLoading).exists()).toBe(false)
    expect(wrapper.get('button[aria-label="刷新状态"]').classes()).toContain('n-button--loading')
    request.resolve([])
    await flushPromises()
  })

  it('截图缩略图生成完成前保持加载，不提前显示截图', async () => {
    const shot: ScreenshotEntry = {
      id: 'shot.png',
      name: 'shot.png',
      path: 'shot.png',
      width: 800,
      height: 600,
      size: 100,
      modifiedAt: '',
      dateGroup: '2026-10-02',
    }
    vi.spyOn(instanceWorkspaceApi, 'screenshots').mockResolvedValue([shot])
    const request = deferred<{ path: string }>()
    vi.spyOn(instanceWorkspaceApi, 'thumbnail').mockReturnValueOnce(request.promise)
    const wrapper = mountTab(InstanceScreenshotsTab)
    await flushPromises()
    expectLoading(wrapper)
    request.resolve({ path: 'thumbnail.png' })
    await flushPromises()
    expect(wrapper.find('.shot-card').exists()).toBe(true)
    expect(wrapper.findComponent(UiLoading).exists()).toBe(false)
  })
})
