import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instanceWorkspaceApi } from '@/features/instances/api/instanceWorkspaceApi'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import type { ScannedVersion, ServerEntry, ServerStatus } from '@/types/instances'
import InstanceServersTab from './InstanceServersTab.vue'

const backendState = vi.hoisted<{ state?: BackendMockState }>(() => ({}))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  backendState.state = createMockBackend()
  return backendState.state.backend
})

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))
const version = { path: 'D:/Games/.minecraft', versionId: 'demo' } as ScannedVersion
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP9sAAAAASUVORK5CYII='
let rows: ServerEntry[]
let statusRows: ServerStatus[]
let wrapper: VueWrapper | undefined

async function openServers() {
  wrapper = mount(InstanceServersTab, {
    props: { version },
    global: { plugins: [createPinia(), i18n], stubs: { Teleport: true } },
  })
  await flushPromises()
  return wrapper
}

describe('InstanceServersTab unified rows', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    rows = [{ id: 'server', name: '测试服务器', address: '[2001:db8::1]:25565', favorite: true, order: 0, icon: png }]
    statusRows = [
      {
        address: rows[0]!.address,
        online: true,
        playersOnline: 5,
        playersMax: 20,
        latency: 30,
        version: '1.20.1',
        motd: '测试 MOTD',
      },
    ]
    vi.spyOn(instanceWorkspaceApi, 'servers').mockImplementation(async () => rows)
    vi.spyOn(instanceWorkspaceApi, 'serverStatuses').mockImplementation(async () => statusRows)
    vi.spyOn(instanceWorkspaceApi, 'launchServer').mockResolvedValue(undefined)
    vi.spyOn(instanceWorkspaceApi, 'saveServer').mockResolvedValue(rows[0]!)
    vi.spyOn(instanceWorkspaceApi, 'deleteServer').mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })
  afterEach(() => wrapper?.unmount())

  it('展示本地图标、地址、收藏、在线状态和指标', async () => {
    const wrapper = await openServers()
    const row = wrapper.get('.server-row')
    expect(row.get('.server-icon img').attributes('src')).toBe(`data:image/png;base64,${png}`)
    expect(row.text()).toContain('在线')
    expect(row.text()).toContain('5/20')
    expect(row.get('.server-address').attributes('title')).toBe(rows[0]!.address)
    expect(row.get('.server-fav').text()).toContain('★')
  })

  it('查询图标优先，损坏后回退本地图标，再回退内置图标', async () => {
    statusRows[0]!.icon = png.replace('P8/x8', 'P8/y8')
    const wrapper = await openServers()
    const queried = wrapper.get('.server-icon img')
    expect(queried.attributes('src')).toContain('P8/y8')
    await queried.trigger('error')
    expect(wrapper.get('.server-icon img').attributes('src')).toBe(`data:image/png;base64,${png}`)
    await wrapper.get('.server-icon img').trigger('error')
    expect(wrapper.find('.server-icon img').exists()).toBe(false)
    expect(wrapper.find('.server-icon svg').exists()).toBe(true)
  })

  it.each([
    'https://example.com/icon.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'not PNG',
    `iVBORw0KGgo${'A'.repeat(400000)}`,
  ])('非法图标只显示现有图标回退', async (icon) => {
    rows[0]!.icon = icon
    const wrapper = await openServers()
    expect(wrapper.find('.server-icon img').exists()).toBe(false)
  })

  it('离线不显示过时的在线指标', async () => {
    statusRows[0] = { address: rows[0]!.address, online: false, error: '无法连接' }
    const wrapper = await openServers()
    expect(wrapper.get('.server-status').text()).toContain('离线')
    expect(wrapper.get('.server-motd').text()).toBe('无法连接')
    expect(wrapper.find('.server-badges').exists()).toBe(false)
  })

  it('查询期间显示查询中，完成后更新状态，保持现有行', async () => {
    const wrapper = await openServers()
    let finish!: (statuses: ServerStatus[]) => void
    vi.mocked(instanceWorkspaceApi.serverStatuses).mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    await wrapper.get('button[aria-label="刷新状态"]').trigger('click')
    expect(wrapper.get('.server-status').text()).toContain('查询中')
    expect(wrapper.find('.server-badges').exists()).toBe(false)
    finish([])
    await flushPromises()
    expect(wrapper.find('.server-row').exists()).toBe(true)
  })

  it('连接、复制地址和搜索保持原目标', async () => {
    const wrapper = await openServers()
    await wrapper.get('button[aria-label="启动并连接"]').trigger('click')
    await wrapper.get('button[aria-label="复制地址"]').trigger('click')
    expect(instanceWorkspaceApi.launchServer).toHaveBeenCalledWith(
      { game_path: version.path, version_id: version.versionId },
      rows[0]!.address
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rows[0]!.address)
    await wrapper.get('.servers-toolbar input').setValue('不匹配')
    expect(wrapper.find('.server-row').exists()).toBe(false)
    await wrapper.get('.servers-toolbar input').setValue('测试 MOTD')
    expect(wrapper.find('.server-row').exists()).toBe(true)
  })

  // jsdom 渲染 273 行本身即接近默认 5s 上限，全量并发跑套件时必然超时；本用例只校验分批与去重，放宽超时不降低断言强度。
  it('大量服务器按接口上限分批查询，重复地址只查询一次', async () => {
    rows = Array.from({ length: 272 }, (_, index) => ({
      ...rows[0]!,
      id: String(index),
      address: `localhost:${10000 + index}`,
    }))
    rows.push({ ...rows[0]!, id: 'duplicate' })
    await openServers()
    const batches = vi.mocked(instanceWorkspaceApi.serverStatuses).mock.calls.map(([addresses]) => addresses)
    expect(batches.map((batch) => batch.length)).toEqual([64, 64, 64, 64, 16])
    expect(new Set(batches.flat()).size).toBe(272)
  }, 20000)

  it('刷新列表重新读取后端，外部新增记录不会被旧缓存遮住', async () => {
    vi.mocked(instanceWorkspaceApi.servers).mockRestore()
    instanceWorkspaceApi.invalidateCache({ game_path: version.path, version_id: version.versionId }, 'servers')
    const command = backendState.state!.mocks.command
    command.mockReset()
    command.mockImplementation(async () => ({ success: true, data: rows }))
    const wrapper = await openServers()
    expect(wrapper.findAll('.server-row')).toHaveLength(1)
    rows = [...rows, { ...rows[0]!, id: 'added', name: '外部新增服务器' }]
    await wrapper.get('button[aria-label="刷新列表"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.server-row')).toHaveLength(2)
    expect(command.mock.calls.filter(([name]) => name === 'game_server_list')).toHaveLength(2)
  })
})
