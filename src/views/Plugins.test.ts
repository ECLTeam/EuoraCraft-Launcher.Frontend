import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { NDropdown, NRadioGroup, NTooltip } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import { i18n } from '@/i18n'
import Plugins from './Plugins.vue'

describe('plugin management entry points', () => {
  it.each([
    ['error', 'PLUGIN_WORKER_EXECUTION_FAILED', 'plugins.errors.PLUGIN_WORKER_EXECUTION_FAILED'],
    ['error', 'PLUGIN_UNKNOWN_TEST_FAILURE', 'plugins.runtimeError'],
    ['disabled', 'PLUGIN_DISABLED_FOR_SESSION', 'plugins.errors.PLUGIN_DISABLED_FOR_SESSION'],
    ['disabled', 'PLUGIN_DEPENDENCY_DISABLED_FOR_SESSION', 'plugins.errors.PLUGIN_DEPENDENCY_DISABLED_FOR_SESSION'],
    ['enabled', null, null],
  ])('keeps %s reasons in the accessible status hint instead of the plugin identity', async (status, error, key) => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const store = usePluginStore(pinia)
    vi.mocked(store.start).mockResolvedValue()
    store.plugins = [
      {
        name: 'demo',
        title: 'Demo',
        version: '1',
        status: status!,
        error,
        description: 'Description',
        author: '',
        icon: '',
        dependencies: {},
        services: [],
        is_system: false,
      },
    ]
    const wrapper = mount(Plugins, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          PluginSettingsModal: true,
          PluginPanelModal: true,
          PluginPackageInstallModal: true,
          PluginSlotHost: true,
          Teleport: true,
        },
      },
    })
    try {
      await flushPromises()
      expect(wrapper.find('.plugin-error').exists()).toBe(false)
      if (!key) {
        expect(wrapper.find('[role="note"]').exists()).toBe(false)
        expect(wrapper.findComponent(NTooltip).exists()).toBe(false)
        return
      }
      const message = i18n.global.t(key)
      if (error?.includes('DISABLED_FOR_SESSION')) {
        for (const name of ['plugins.enable', 'plugins.reload']) {
          expect(wrapper.get(`button[aria-label="${i18n.global.t(name)}"]`).attributes('disabled')).toBeDefined()
        }
      }
      expect(wrapper.get('.plugin-identity').text()).not.toContain(message)
      const note = wrapper.get('[role="note"]')
      expect(note.attributes('tabindex')).toBe('0')
      const describedBy = note.attributes('aria-describedby')
      const description = wrapper
        .findAll('.plugin-status-description')
        .find((item) => item.attributes('id') === describedBy)!
      expect(description.text()).toBe(message)
      const hint = wrapper.getComponent(NTooltip)
      expect(hint.props('show')).toBe(false)
      await note.trigger('mouseenter')
      expect(hint.props('show')).toBe(true)
      await note.trigger('focus')
      await note.trigger('mouseleave')
      expect(hint.props('show')).toBe(true)
      await note.trigger('keydown', { key: 'Escape' })
      expect(hint.props('show')).toBe(false)
      await note.trigger('blur')
      await note.trigger('focus')
      expect(hint.props('show')).toBe(true)
      await note.trigger('blur')
      expect(hint.props('show')).toBe(false)
      await note.trigger('mouseenter')
      await wrapper.get('.plugins-search input').setValue('no matches')
      await wrapper.get('.plugins-search input').setValue('')
      expect(wrapper.getComponent(NTooltip).props('show')).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps settings and installation available without a development switch', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn })
    const store = usePluginStore(pinia)
    vi.mocked(store.start).mockResolvedValue()
    const wrapper = mount(Plugins, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          PluginSettingsModal: true,
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
      expect(store.openSettings).toHaveBeenCalledWith(null)
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
