import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { NDropdown } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import { i18n } from '@/i18n'
import Plugins from './Plugins.vue'

describe('plugin management entry points', () => {
  it('keeps settings and installation available without a development switch', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const store = usePluginStore(pinia)
    vi.mocked(store.start).mockResolvedValue()
    const wrapper = mount(Plugins, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          PluginSettingsModal: true,
          PluginPermissionsModal: true,
          PluginPanelModal: true,
          PluginPackageInstallModal: true,
          PluginSlotHost: true,
        },
      },
    })
    try {
      await flushPromises()
      expect(store.start).toHaveBeenCalledOnce()
      expect(wrapper.find('[role="switch"]').exists()).toBe(false)
      const settings = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.settingsCenter'))!
      await settings.trigger('click')
      expect(wrapper.findComponent({ name: 'PluginSettingsModal' }).props('visible')).toBe(true)
      const dropdown = wrapper.getComponent(NDropdown)
      expect(dropdown.props('options')).toHaveLength(2)
    } finally {
      wrapper.unmount()
    }
    expect(store.stop).toHaveBeenCalledOnce()
  })
})
