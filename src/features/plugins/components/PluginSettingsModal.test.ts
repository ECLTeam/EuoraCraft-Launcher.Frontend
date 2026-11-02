import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NInput } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { i18n } from '@/i18n'
import type { PluginInfo } from '@/types/plugins'
import PluginSettingsModal from './PluginSettingsModal.vue'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSetting: vi.fn(),
  subscribeSettingsChanges: vi.fn(() => vi.fn()),
}))
vi.mock('@/features/plugins/stores/pluginStore', () => ({ usePluginStore: () => mocks }))
const plugin: PluginInfo = {
  name: 'demo',
  title: 'Demo',
  version: '1',
  description: '',
  author: '',
  icon: '',
  status: 'enabled',
  error: null,
  dependencies: {},
  services: [],
  is_system: false,
}

describe('plugin settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSettings.mockResolvedValue({
      schema: [{ key: 'greeting', type: 'string', default: 'hello' }],
      values: { greeting: 'hello' },
      revision: 0,
    })
  })
  it('submits the edited text on blur and keeps the confirmed value', async () => {
    mocks.updateSetting.mockImplementationOnce(async () => {
      mocks.getSettings.mockResolvedValueOnce({
        schema: [{ key: 'greeting', type: 'string', default: 'hello' }],
        values: { greeting: 'changed' },
        revision: 1,
      })
    })
    const wrapper = mount(PluginSettingsModal, {
      props: { visible: true, plugin, plugins: [plugin] },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    try {
      await flushPromises()
      const input = wrapper.get('input[aria-label="greeting"]')
      await input.trigger('focus')
      ;(input.element as HTMLInputElement).value = 'changed'
      await input.trigger('input')
      await flushPromises()
      await input.trigger('change')
      await input.trigger('blur')
      await flushPromises()
      expect(mocks.updateSetting).toHaveBeenCalledWith(
        'demo',
        'greeting',
        'changed',
        expect.objectContaining({ revision: 0 })
      )
      expect((input.element as HTMLInputElement).value).toBe('changed')
      expect(wrapper.text()).toContain(i18n.global.t('plugins.settingSaved'))
    } finally {
      wrapper.unmount()
    }
  })
  it('renders settings after loading and reports failure without showing saved', async () => {
    mocks.updateSetting.mockRejectedValue(new Error('revision conflict'))
    const wrapper = mount(NConfigProvider, {
      props: { themeOverrides: { common: { modalColor: 'var(--ecl-surface)', popoverColor: 'var(--ecl-surface)' } } },
      slots: { default: () => h(PluginSettingsModal, { visible: true, plugin, plugins: [plugin] }) },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    try {
      await flushPromises()
      const input = wrapper.findAllComponents(NInput).find((item) => item.props('value') === 'hello')!
      expect(input.props('value')).toBe('hello')
      await input.vm.$emit('change', 'changed')
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.settingSaveFailed'))
      expect(wrapper.text()).not.toContain(i18n.global.t('plugins.settingSaved'))
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps the selected plugin when filtering and discards a late response for another plugin', async () => {
    let resolveFirst!: (data: unknown) => void
    mocks.getSettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        })
    )
    mocks.getSettings.mockResolvedValueOnce({
      schema: [{ key: 'greeting', type: 'string', default: 'hello' }],
      values: { greeting: 'second' },
      revision: 0,
    })
    const second = { ...plugin, name: 'second', title: 'Second' }
    const wrapper = mount(PluginSettingsModal, {
      props: { visible: true, plugin, plugins: [plugin, second] },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    try {
      await flushPromises()
      await wrapper.findAll('.plugin-settings-choice')[1]!.trigger('click')
      await flushPromises()
      resolveFirst({ schema: [], values: { greeting: 'stale' }, revision: 0 })
      await flushPromises()
      expect((wrapper.get('input[aria-label="greeting"]').element as HTMLInputElement).value).toBe('second')
      expect(wrapper.get('.plugin-settings-heading').text()).toContain('Second')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an unavailable schema without enabling or executing the plugin', async () => {
    mocks.getSettings.mockResolvedValueOnce({ schema: [], values: {}, revision: 0, editable: false })
    const wrapper = mount(PluginSettingsModal, {
      props: { visible: true, plugin: { ...plugin, status: 'disabled' }, plugins: [{ ...plugin, status: 'disabled' }] },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.settingsUnavailable'))
      expect(mocks.updateSetting).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
})
