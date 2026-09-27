import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { i18n } from '@/i18n'
import Connect from './Connect.vue'

const mocks = vi.hoisted(() => ({ useConnector: vi.fn() }))

vi.mock('@/features/connect/composables/useConnector', () => ({
  useConnector: mocks.useConnector,
}))

// 与 App.vue 一致：外壳由路由渲染，测试挂载 RouterView 宿主避免直接挂载外壳导致自渲染
const Host = defineComponent({ template: '<RouterView />' })

const RoomStub = { template: '<div class="stub-room">联机子页</div>' }
const PluginsStub = { template: '<div class="stub-plugins">插件子页</div>' }
const ToolsStub = { template: '<div class="stub-tools">工具子页</div>' }

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/more',
        component: Connect,
        redirect: '/more/room',
        children: [
          { path: 'room', name: 'more-room', component: RoomStub },
          { path: 'plugins', name: 'more-plugins', component: PluginsStub },
          { path: 'tools', name: 'more-tools', component: ToolsStub },
        ],
      },
      { path: '/plugins', redirect: '/more/plugins' },
    ],
  })
}

async function mountShell() {
  const router = createTestRouter()
  await router.push('/more')
  await router.isReady()
  const wrapper = mount(Host, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('Connect shell', () => {
  beforeEach(() => {
    mocks.useConnector.mockReset().mockReturnValue({})
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

  it('redirects the legacy /plugins path to the more plugins sub-page', async () => {
    const { wrapper, router } = await mountShell()

    await router.push('/plugins')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/more/plugins')
    expect(wrapper.find('.stub-plugins').exists()).toBe(true)
  })

  it('swaps the rendered sub-page when the menu target changes', async () => {
    const { wrapper, router } = await mountShell()

    await router.push('/more/tools')
    await flushPromises()

    expect(wrapper.find('.stub-tools').exists()).toBe(true)
    expect(wrapper.find('.stub-room').exists()).toBe(false)
  })
})
