import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import type {
  PluginInfo,
  PluginPackageInstallResult,
  PluginPackagePreflight,
  PluginSettingsData,
} from '@/types/plugins'

export const pluginManagementApi = {
  async list(): Promise<PluginInfo[]> {
    return assertSuccess(await backend.command('plugin_list'), '读取插件列表') ?? []
  },

  async enable(pluginName: string): Promise<void> {
    assertSuccess(await backend.command('plugin_enable', { plugin_name: pluginName }), '启用插件')
  },

  async disable(pluginName: string): Promise<void> {
    assertSuccess(await backend.command('plugin_disable', { plugin_name: pluginName }), '禁用插件')
  },

  async reload(pluginName: string): Promise<void> {
    assertSuccess(await backend.command('plugin_reload', { plugin_name: pluginName }), '重载插件')
  },

  async unload(pluginName: string): Promise<void> {
    assertSuccess(await backend.command('plugin_unload', { plugin_name: pluginName }), '卸载插件')
  },

  async installFromDirectory(): Promise<boolean> {
    const selected = await backend.command('select_directory')
    if (!selected.success) throw new Error(selected.message || '选择插件目录失败')
    if (!selected.data?.path) return false
    assertSuccess(await backend.command('plugin_install', { plugin_path: selected.data.path }), '安装插件')
    return true
  },

  async selectPackage(): Promise<string | null> {
    const selected = await backend.command('select_file', { purpose: 'plugin-package' })
    if (!selected.success) throw new Error(selected.message || '选择插件包失败')
    return selected.data?.path || null
  },

  async inspectPackage(path: string): Promise<PluginPackagePreflight> {
    return assertSuccess(await backend.command('plugin_package_inspect', { plugin_path: path }), '预检插件包')
  },

  async installPackage(path: string, options: { allowNetwork: boolean }): Promise<PluginPackageInstallResult> {
    return (
      assertSuccess(
        await backend.command('plugin_install', {
          plugin_path: path,
          confirm_unverified_source: true,
          allow_network: options.allowNetwork,
        }),
        '安装插件包'
      ) ?? { status: 'installed' }
    )
  },

  onStatusChanged(handler: () => void): () => void {
    return backend.on('plugin:status_changed', handler)
  },

  async getSettings(pluginName: string): Promise<PluginSettingsData> {
    const result = await backend.command('plugin_get_settings', { plugin_name: pluginName })
    return assertSuccess(result, '读取插件设置')
  },

  async updateSetting(pluginName: string, key: string, value: unknown): Promise<void> {
    assertSuccess(
      await backend.command('plugin_update_setting', { plugin_name: pluginName, key, value }),
      '更新插件设置'
    )
  },
}
