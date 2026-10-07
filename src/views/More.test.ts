/* eslint-disable vue/one-component-per-file -- 测试挂载用辅助组件 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, onMounted } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { useConnector } from '@/features/connect/composables/useConnector'
import { useConnectorContext } from '@/features/connect/connectorContext'
import { i18n } from '@/i18n'
import More from './More.vue'

const mocks = vi.hoisted(() => ({ status: vi.fn(), easyTierStatus: vi.fn() }))
vi.mock('@/features/connect/api/connectorApi', () => ({ connectorApi: mocks }))

// 与 App.vue 一致：外壳由路由渲染，测试挂载 RouterView 宿主避免直接挂载外壳导致自渲染
const Host = defineComponent({ template: '<RouterView />' })

const RoomStub = defineComponent({
  setup() {
    const session = useConnectorContext()
    onMounted(() => void session.initialize())
  },
  template: '<div class="stub-room">联机子页</div>',
})
const PluginsStub = { template: '<div class="stub-plugins">插件子页</div>' }
const ToolsStub = { template: '<div class="stub-tools">工具子页</div>' }

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/more',
        component: More,
        redirect: '/more/room',
        children: [
          { path: 'room', name: 'more-room', component: RoomStub },
          { path: 'plugins', name: 'more-plugins', component: PluginsStub },
          { path: 'tools', name: 'more-tools', component: ToolsStub },
        ],
      },
    ],
  })
}

async function mountShell(path = '/more') {
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(Host, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('More shell', () => {
  beforeEach(() => {
    useConnector().dispose()
    mocks.status.mockReset().mockResolvedValue({
      mode: 'idle',
      roomCode: null,
      mcHost: null,
      mcPort: null,
      gameInfo: null,
      players: [],
      nodes: [],
      error: null,
    })
    mocks.easyTierStatus
      .mockReset()
      .mockResolvedValue({ installed: false, status: 'missing', progress: 0, speed: 0, error: null })
  })

  it('直接进入工具或插件不初始化联机，首次进入房间后跨外壳导航复用会话', async () => {
    const { wrapper, router } = await mountShell('/more/tools')
    expect(mocks.status).not.toHaveBeenCalled()
    await router.push('/more/plugins')
    await flushPromises()
    expect(mocks.easyTierStatus).not.toHaveBeenCalled()
    await router.push('/more/room')
    await flushPromises()
    expect(mocks.status).toHaveBeenCalledOnce()
    await router.push('/')
    await flushPromises()
    await router.push('/more/room')
    await flushPromises()
    expect(mocks.status).toHaveBeenCalledOnce()
    wrapper.unmount()
    useConnector().dispose()
  })

  it('renders the in-page menu with all three sub-pages', async () => {
    const { wrapper } = await mountShell()

    const menuItems = wrapper.findAll('.n-menu-item')
    expect(menuItems).toHaveLength(3)
    expect(menuItems[0]?.text()).toContain('联机')
    expect(menuItems[1]?.text()).toContain('插件')
    expect(menuItems[2]?.text()).toContain('工具')
  })

  it('lands on the room sub-page by default', async () => {
    const { wrapper, router } = await mountShell()

    expect(router.currentRoute.value.path).toBe('/more/room')
    expect(wrapper.find('.stub-room').exists()).toBe(true)
    expect(wrapper.find('.stub-tools').exists()).toBe(false)
  })

  it('renders the plugins sub-page when the menu target changes', async () => {
    const { wrapper, router } = await mountShell()

    await router.push('/more/plugins')
    await flushPromises()

    expect(wrapper.find('.stub-plugins').exists()).toBe(true)
    expect(wrapper.find('.stub-room').exists()).toBe(false)
  })

  it('swaps the rendered sub-page when the menu target changes', async () => {
    const { wrapper, router } = await mountShell()

    await router.push('/more/tools')
    await flushPromises()

    expect(wrapper.find('.stub-tools').exists()).toBe(true)
    expect(wrapper.find('.stub-room').exists()).toBe(false)
  })
})
