import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox, NSwitch } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginPackageSelection } from '@/types/plugins'
import PluginPackageInstallModal from './PluginPackageInstallModal.vue'

const mocks = vi.hoisted(() => ({ install: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/features/plugins/stores/pluginStore', () => ({ usePluginStore: () => ({ installPackage: mocks.install }) }))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: mocks.success, error: mocks.error }),
}))

const selection: PluginPackageSelection = {
  path: 'C:/demo.eclplugin',
  preflight: {
    package: {
      name: 'demo',
      version: '1.0.0',
      manifest_sha256: 'a'.repeat(64),
      file_count: 4,
      total_uncompressed_bytes: 1024,
    },
    target_tag: 'windows-x86_64-cp312',
    python_dependencies: ['example==1.0.0'],
    wheel_count: 1,
    has_target_lock: true,
    unverified_source: true,
    dependencies_ready: false,
  },
}

function mountModal() {
  return mount(PluginPackageInstallModal, {
    props: { visible: true, selection },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
}

describe('PluginPackageInstallModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('确认来源后可直接离线安装包内 wheels，不要求独立运行时', async () => {
    mocks.install.mockResolvedValue({ status: 'installed', message: '插件已安装，重启后生效' })
    const wrapper = mountModal()
    try {
      const installButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.install'))!
      expect(installButton.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).not.toContain('运行时')
      await wrapper.getComponent(NSwitch).vm.$emit('update:value', false)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(installButton.attributes('disabled')).toBeUndefined()
      await installButton.trigger('click')
      await flushPromises()
      expect(mocks.install).toHaveBeenCalledWith(selection, { allowNetwork: false })
      expect(mocks.success).toHaveBeenCalledWith('插件已安装，重启后生效')
      expect(wrapper.emitted('installed')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('更换归档后清除旧来源确认，安装失败不误报成功', async () => {
    mocks.install.mockRejectedValue(new Error('缺少离线 wheel'))
    const wrapper = mountModal()
    try {
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      await wrapper.setProps({ selection: { ...selection, path: 'C:/other.eclplugin' } })
      const installButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.install'))!
      expect(installButton.attributes('disabled')).toBeDefined()
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      await installButton.trigger('click')
      await flushPromises()
      expect(mocks.error).toHaveBeenCalledWith('缺少离线 wheel')
      expect(mocks.success).not.toHaveBeenCalled()
      expect(wrapper.emitted('installed')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
})
