import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SideBar from '@/components/layout/SideBar.vue'
import { useTheme } from '@/composables/useTheme'

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
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
  useRouter: () => ({ push: vi.fn().mockResolvedValue(undefined) }),
}))

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
