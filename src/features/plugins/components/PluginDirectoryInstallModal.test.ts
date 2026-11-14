import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginDirectorySelection } from '@/types/plugins'
import PluginDirectoryInstallModal from './PluginDirectoryInstallModal.vue'

const mocks = vi.hoisted(() => ({ install: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/features/plugins/stores/pluginStore', () => ({
  usePluginStore: () => ({ installDirectory: mocks.install }),
}))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: mocks.success, error: mocks.error }),
}))

const selection: PluginDirectorySelection = {
  path: 'C:/demo',
  preflight: {
    name: 'demo',
    version: '1.0.0',
    entry_point: 'main:Plugin',
    source_path: 'C:/demo',
    target_tag: 'windows-x86_64-cp311',
    python_dependencies: ['example==1.0.0'],
    wheel_count: 2,
    has_target_lock: true,
    dependencies_ready: false,
  },
}

function mountModal() {
  return mount(PluginDirectoryInstallModal, {
    props: { visible: true, selection },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
}

describe('PluginDirectoryInstallModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('展示来源目录并要求确认后才能安装', async () => {
    mocks.install.mockResolvedValue({ status: 'installed', message: '插件已安装，重启后生效' })
    const wrapper = mountModal()
    try {
      expect(wrapper.text()).toContain(i18n.global.t('plugins.directorySource'))
      expect(wrapper.text()).toContain('C:/demo')
      expect(wrapper.text()).toContain(i18n.global.t('plugins.directoryUnverifiedWarning'))

      const installButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.install'))!
      expect(installButton.attributes('disabled')).toBeDefined()

      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(installButton.attributes('disabled')).toBeUndefined()
      await installButton.trigger('click')
      await flushPromises()
      expect(mocks.install).toHaveBeenCalledWith(selection, { allowNetwork: true })
      expect(mocks.success).toHaveBeenCalledWith('插件已安装，重启后生效')
      expect(wrapper.emitted('installed')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('更换目录后重新要求确认来源', async () => {
    const wrapper = mountModal()
    try {
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      await wrapper.setProps({ selection: { ...selection, path: 'C:/other' } })

      const installButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.install'))!
      expect(installButton.attributes('disabled')).toBeDefined()

      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      await installButton.trigger('click')
      await flushPromises()
      expect(mocks.install).toHaveBeenCalledWith(expect.objectContaining({ path: 'C:/other' }), { allowNetwork: true })
    } finally {
      wrapper.unmount()
    }
  })
})
