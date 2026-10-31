import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useRoute } from 'vue-router'
import SideBar from '@/components/layout/SideBar.vue'
import { pluginRoutes } from '@/composables/usePluginBridge'
import { useTheme } from '@/composables/useTheme'
import type * as VueI18nModule from 'vue-i18n'

const mocks = vi.hoisted(() => ({
  notifySidebarState: vi.fn().mockResolvedValue(undefined),
  setSidebarState: vi.fn(),
}))

vi.mock('@/features/plugins/api/pluginHostApi', () => ({ pluginHostApi: mocks }))
vi.mock('@/plugin-sdk/state', () => ({ setSidebarState: mocks.setSidebarState }))
vi.mock('@/composables/usePluginBridge', async () => {
  const { ref } = await import('vue')
  return { pluginRoutes: ref([]) }
})
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => ({ warning: vi.fn() }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof VueI18nModule>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  const route = reactive({ path: '/' })
  return { useRoute: () => route, useRouter: () => ({ push: vi.fn().mockResolvedValue(undefined) }) }
})

describe('侧栏插件状态通知', () => {
  it('通知初始化状态和点击后的变化，同值操作不重复通知', async () => {
    const theme = useTheme()
    theme.setSidebarCollapsed(false)
    const wrapper = mount(SideBar, { global: { stubs: { UiIcon: true, PluginSlotHost: true } } })
    try {
      expect(mocks.setSidebarState).toHaveBeenCalledExactlyOnceWith(false)
      expect(mocks.notifySidebarState).toHaveBeenCalledExactlyOnceWith(false)

      await wrapper.get('.sidebar-toggle').trigger('click')
      expect(wrapper.get('.sidebar').classes()).toContain('collapsed')
      expect(mocks.setSidebarState).toHaveBeenLastCalledWith(true)
      expect(mocks.notifySidebarState).toHaveBeenLastCalledWith(true)
      expect(localStorage.getItem('euoracraft-sidebar-collapsed')).toBe('true')

      theme.setSidebarCollapsed(true)
      await nextTick()
      expect(mocks.notifySidebarState).toHaveBeenCalledTimes(2)
      expect(mocks.setSidebarState).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })
})

describe('侧栏激活位置', () => {
  it('切换内置和插件菜单，折叠或目标消失时隐藏，展开后恢复', async () => {
    const route = useRoute()
    const theme = useTheme()
    theme.setSidebarCollapsed(false)
    pluginRoutes.value = [{ plugin: 'example', path: '/page', title: 'Example' }]
    route.path = '/'
    const top = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.path?.startsWith('/plugin/') ? 120 : 20
    })
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40)
    const wrapper = mount(SideBar, { global: { stubs: { UiIcon: true, PluginSlotHost: true } } })
    const flush = async () => {
      await nextTick()
      await nextTick()
      await nextTick()
    }
    try {
      await flush()
      const background = wrapper.get<HTMLElement>('.sidebar-active-bg').element
      const indicator = wrapper.get<HTMLElement>('.sidebar-active-indicator').element
      expect(background.style.top).toBe('20px')
      expect(indicator.style.top).toBe('29px')
      route.path = '/versions'
      route.path = '/plugin/example/page'
      await flush()
      expect(background.style.top).toBe('120px')
      expect(indicator.style.top).toBe('129px')
      expect(indicator.style.opacity).toBe('1')
      theme.setSidebarCollapsed(true)
      await flush()
      expect(background.style.opacity).toBe('0')
      expect(indicator.style.opacity).toBe('0')
      theme.setSidebarCollapsed(false)
      await flush()
      expect(background.style.top).toBe('120px')
      expect(indicator.style.opacity).toBe('1')
      pluginRoutes.value = []
      await flush()
      expect(background.style.opacity).toBe('0')
      expect(indicator.style.opacity).toBe('0')
    } finally {
      wrapper.unmount()
      top.mockRestore()
      height.mockRestore()
      pluginRoutes.value = []
      route.path = '/'
    }
  })
})
