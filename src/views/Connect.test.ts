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
const ToolsStub = { template: '<div class="stub-tools">工具子页</div>' }

function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      {
        path: '/connect',
        component: Connect,
        redirect: '/connect/room',
        children: [
          { path: 'room', name: 'connect-room', component: RoomStub },
          { path: 'tools', name: 'connect-tools', component: ToolsStub },
        ],
      },
    ],
  })
}

async function mountShell() {
  const router = createTestRouter()
  await router.push('/connect')
  await router.isReady()
  const wrapper = mount(Host, { global: { plugins: [i18n, router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('Connect shell', () => {
  beforeEach(() => {
    mocks.useConnector.mockReset().mockReturnValue({})
  })

  it('renders the in-page menu with both sub-pages', async () => {
    const { wrapper } = await mountShell()

    const menuItems = wrapper.findAll('.n-menu-item')
    expect(menuItems).toHaveLength(2)
    expect(menuItems[0]?.text()).toContain('联机')
    expect(menuItems[1]?.text()).toContain('工具')
  })

  it('lands on the room sub-page by default', async () => {
    const { wrapper, router } = await mountShell()

    expect(router.currentRoute.value.path).toBe('/connect/room')
    expect(wrapper.find('.stub-room').exists()).toBe(true)
    expect(wrapper.find('.stub-tools').exists()).toBe(false)
  })

  it('swaps the rendered sub-page when the menu target changes', async () => {
    const { wrapper, router } = await mountShell()

    await router.push('/connect/tools')
    await flushPromises()

    expect(wrapper.find('.stub-tools').exists()).toBe(true)
    expect(wrapper.find('.stub-room').exists()).toBe(false)
  })
})
