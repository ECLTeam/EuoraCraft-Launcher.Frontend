import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import { i18n } from '@/i18n'
import type { PluginBusinessCapability, PluginInfo } from '@/types/plugins'
import Plugins from './Plugins.vue'

const basicPlugin: PluginInfo = {
  name: 'demo',
  title: 'Demo',
  version: '1',
  status: 'review_required',
  error: null,
  description: '',
  author: '',
  icon: '',
  dependencies: {},
  services: [],
  is_system: false,
  installation_id: 'a'.repeat(32),
  requested_permissions: [],
  review_required: true,
  required_satisfied: false,
}

function mountPlugins(plugin: PluginInfo) {
  const pinia = createTestingPinia({ createSpy: vi.fn })
  const store = usePluginStore(pinia)
  vi.mocked(store.start).mockResolvedValue()
  vi.mocked(store.enableBasic).mockResolvedValue({ status: 'success', value: undefined })
  vi.mocked(store.toggle).mockResolvedValue({ status: 'success', value: undefined })
  store.plugins = [plugin]
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
  return { wrapper, store }
}

describe('plugin permission entry', () => {
  it.each(['review_required', 'enabled'])('hides empty permission entry for a %s plugin', async (status) => {
    const { wrapper } = mountPlugins({ ...basicPlugin, status })
    try {
      await flushPromises()
      const buttons = wrapper.findAll('.plugin-actions button')
      expect(buttons.some((button) => button.attributes('aria-label') === i18n.global.t('plugins.permissions'))).toBe(
        false
      )
    } finally {
      wrapper.unmount()
    }
  })

  it.each([false, true])('keeps permission review and revocation available when reviewed=%s', async (reviewed) => {
    const requested: PluginBusinessCapability[] = ['network.read']
    const { wrapper } = mountPlugins({
      ...basicPlugin,
      requested_permissions: requested,
      status: reviewed ? 'enabled' : 'review_required',
      review_required: !reviewed,
      required_satisfied: reviewed,
    })
    try {
      await flushPromises()
      const button = wrapper
        .findAll('.plugin-actions button')
        .find((item) => item.attributes('aria-label') === i18n.global.t('plugins.permissions'))!
      expect(button).toBeDefined()
      await button.trigger('click')
      expect(wrapper.getComponent({ name: 'PluginPermissionsModal' }).props('visible')).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it.each([false, true])(
    'only opens enable confirmation when extra permissions are requested=%s',
    async (requested) => {
      const { wrapper, store } = mountPlugins({
        ...basicPlugin,
        requested_permissions: requested ? ['network.read'] : [],
      })
      try {
        await flushPromises()
        await wrapper
          .findAll('.plugin-actions button')
          .find((button) => button.attributes('aria-label') === i18n.global.t('plugins.enable'))!
          .trigger('click')
        await flushPromises()
        expect(wrapper.getComponent({ name: 'PluginPermissionsModal' }).props('visible')).toBe(requested)
        expect(store.enableBasic).toHaveBeenCalledTimes(requested ? 0 : 1)
        expect(store.toggle).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
      }
    }
  )

  it('disables a basic plugin without opening permission confirmation', async () => {
    const { wrapper, store } = mountPlugins({ ...basicPlugin, status: 'enabled' })
    try {
      await flushPromises()
      await wrapper
        .findAll('.plugin-actions button')
        .find((button) => button.attributes('aria-label') === i18n.global.t('plugins.disable'))!
        .trigger('click')
      await flushPromises()
      expect(store.toggle).toHaveBeenCalledOnce()
      expect(store.enableBasic).not.toHaveBeenCalled()
      expect(wrapper.getComponent({ name: 'PluginPermissionsModal' }).props('visible')).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps every icon-only action named and updates the enable action with plugin status', async () => {
    const { wrapper, store } = mountPlugins({
      ...basicPlugin,
      status: 'enabled',
      requested_permissions: ['network.read'],
    })
    try {
      await flushPromises()
      const actions = ['permissions', 'panel', 'settings', 'disable', 'reload', 'unload']
      expect(wrapper.findAll('.plugin-actions button')).toHaveLength(actions.length)
      for (const action of actions) {
        const name = i18n.global.t(`plugins.${action}`)
        const button = wrapper.get(`.plugin-actions button[aria-label="${name}"]`)
        expect(button.text()).toBe('')
        expect(button.attributes('title')).toBe(name)
        expect(button.find('svg').exists()).toBe(true)
      }
      expect(wrapper.find('.plugin-actions .icon-stop').exists()).toBe(true)
      store.plugins = [{ ...basicPlugin, status: 'disabled' }]
      await flushPromises()
      const enable = wrapper.get(`.plugin-actions button[aria-label="${i18n.global.t('plugins.enable')}"]`)
      expect(enable.attributes('title')).toBe(i18n.global.t('plugins.enable'))
      expect(enable.find('.icon-play').exists()).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
