import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import { i18n } from '@/i18n'
import PluginSettingsHost from './PluginSettingsHost.vue'

vi.mock('@/features/plugins/api/pluginManagementApi', () => ({
  pluginManagementApi: { onStatusChanged: vi.fn(() => vi.fn()) },
}))

describe('shared plugin settings host', () => {
  it('opens outside the plugins page and releases its status subscription when closed', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const store = usePluginStore(pinia)
    const wrapper = mount(PluginSettingsHost, {
      global: { plugins: [pinia, i18n], stubs: { PluginSettingsModal: true, PluginPermissionsModal: true } },
    })
    try {
      expect(pluginManagementApi.onStatusChanged).not.toHaveBeenCalled()
      store.settingsModalVisible = true
      await flushPromises()
      expect(wrapper.getComponent({ name: 'PluginSettingsModal' }).props('visible')).toBe(true)
      const release = vi.mocked(pluginManagementApi.onStatusChanged).mock.results[0]!.value
      store.settingsModalVisible = false
      await flushPromises()
      expect(release).toHaveBeenCalledOnce()
    } finally {
      wrapper.unmount()
    }
  })
})
