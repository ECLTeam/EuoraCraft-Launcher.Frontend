import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NInput } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { i18n } from '@/i18n'
import type { PluginInfo } from '@/types/plugins'
import PluginSettingsModal from './PluginSettingsModal.vue'

const mocks = vi.hoisted(() => ({ getSettings: vi.fn(), updateSetting: vi.fn() }))
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
    mocks.updateSetting.mockResolvedValue(undefined)
    const wrapper = mount(PluginSettingsModal, {
      props: { visible: true, plugin },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    try {
      await flushPromises()
      const input = wrapper.get('input')
      await input.trigger('focus')
      ;(input.element as HTMLInputElement).value = 'changed'
      await input.trigger('input')
      await flushPromises()
      await input.trigger('change')
      await input.trigger('blur')
      await flushPromises()
      expect(mocks.updateSetting).toHaveBeenCalledWith('demo', 'greeting', 'changed')
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
      slots: { default: () => h(PluginSettingsModal, { visible: true, plugin }) },
      global: { plugins: [i18n], stubs: { Teleport: true } },
    })
    try {
      await flushPromises()
      expect(wrapper.getComponent(NInput).props('value')).toBe('hello')
      await wrapper.getComponent(NInput).vm.$emit('change', 'changed')
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.settingSaveFailed'))
      expect(wrapper.text()).not.toContain(i18n.global.t('plugins.settingSaved'))
    } finally {
      wrapper.unmount()
    }
  })
})
