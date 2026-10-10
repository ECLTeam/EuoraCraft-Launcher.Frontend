import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { registerTrayItem, useTrayItems } from '@/composables/useTrayItems'
import { i18n } from '@/i18n'
import SideBar from './SideBar.vue'
import TitleBarTray from './TitleBarTray.vue'

vi.mock('@/composables/useTheme', async () => {
  const { ref } = await import('vue')
  return { useTheme: () => ({ sidebarCollapsed: ref(true), setSidebarCollapsed: vi.fn() }) }
})
vi.mock('@/composables/useTopNav', async () => {
  const { ref } = await import('vue')
  return { useTopNav: () => ({ topNavEnabled: ref(true) }) }
})
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => ({ warning: vi.fn() }) }))
vi.mock('@/composables/usePluginBridge', async () => {
  const { ref } = await import('vue')
  return { pluginRoutes: ref([]) }
})
vi.mock('@/features/plugins/api/pluginHostApi', () => ({
  pluginHostApi: { notifySidebarState: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('@/plugin-sdk/state', () => ({ setSidebarState: vi.fn() }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  setActivePinia(createPinia())
  useTrayItems().items.value = []
  i18n.global.locale.value = 'zh-CN'
})

async function render(component: typeof SideBar | typeof TitleBarTray, debugMode = ref(true)) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings/about', component: { template: '<div />' } }],
  })
  await router.push('/settings/about')
  const wrapper = mount(component, {
    global: {
      plugins: [i18n, router],
      provide: { devMode: debugMode, agreementAccepted: ref(true) },
      stubs: { PluginSlotHost: true, UiIcon: true },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

it.each([true, false])('调试模式 %s 时均完全移除侧栏底部按钮区域', async (enabled) => {
  const { wrapper } = await render(SideBar, ref(enabled))
  expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
  expect(wrapper.find('[title="调试"]').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('文档')
})

it('顶部托盘只保留插件项，移除文档和调试内置入口', async () => {
  const action = vi.fn()
  registerTrayItem({ id: 'plugin-test', icon: 'plugin', label: '插件工具', action })
  const { wrapper } = await render(TitleBarTray)
  expect(useTrayItems().items.value.map((item) => item.id)).toEqual(['plugin-test'])
  await wrapper.get('.titlebar-tray-btn').trigger('click')
  await wrapper.get('.tray-menu-item').trigger('click')
  expect(action).toHaveBeenCalledOnce()
})
