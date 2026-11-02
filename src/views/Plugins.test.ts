import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { NDropdown, NRadioGroup } from 'naive-ui'
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
      const settings = wrapper.get(`button[aria-label="${i18n.global.t('plugins.settingsCenter')}"]`)
      expect(settings.text()).toBe('')
      expect(settings.attributes('title')).toBe(i18n.global.t('plugins.settingsCenter'))
      expect(wrapper.get('.plugins-search input').attributes('aria-label')).toBe(i18n.global.t('plugins.searchPlugins'))
      await settings.trigger('click')
      expect(wrapper.findComponent({ name: 'PluginSettingsModal' }).props('visible')).toBe(true)
      const dropdown = wrapper.getComponent(NDropdown)
      expect(dropdown.props('options')).toHaveLength(2)
      expect(dropdown.text()).toContain(i18n.global.t('plugins.install'))
      dropdown.vm.$emit('select', 'package')
      await flushPromises()
      expect(store.selectPackage).toHaveBeenCalledOnce()
      dropdown.vm.$emit('select', 'directory')
      await flushPromises()
      expect(store.install).toHaveBeenCalledOnce()
    } finally {
      wrapper.unmount()
    }
    expect(store.stop).toHaveBeenCalledOnce()
  })

  it('keeps search and all three status filters working in the toolbar', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const store = usePluginStore(pinia)
    vi.mocked(store.start).mockResolvedValue()
    const base = {
      version: '1',
      description: '',
      author: '',
      icon: '',
      error: null,
      dependencies: {},
      services: [],
      is_system: false,
    }
    store.plugins = [
      { ...base, name: 'first', title: 'First', status: 'enabled' },
      { ...base, name: 'second', title: 'Second', status: 'disabled' },
    ]
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
      expect(wrapper.findAll('.plugin-row')).toHaveLength(2)
      wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'enabled')
      await flushPromises()
      expect(wrapper.findAll('.plugin-row')).toHaveLength(1)
      expect(wrapper.get('.plugin-row').text()).toContain('First')
      wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'disabled')
      await flushPromises()
      expect(wrapper.get('.plugin-row').text()).toContain('Second')
      wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'all')
      await flushPromises()
      const search = wrapper.get('.plugins-search input')
      await search.setValue('first')
      expect(wrapper.findAll('.plugin-row')).toHaveLength(1)
      expect(wrapper.get('.plugin-row').text()).toContain('First')
      await search.setValue('')
      expect(wrapper.findAll('.plugin-row')).toHaveLength(2)
    } finally {
      wrapper.unmount()
    }
  })
})
