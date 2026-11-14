import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import type {
  PluginDirectoryPreflight,
  PluginInfo,
  PluginPackageInstallResult,
  PluginPackagePreflight,
  PluginPanelData,
  PluginPanelDefinition,
  PluginSettingsData,
} from '@/types/plugins'
import { parseDevelopment, parseSettings } from './pluginSettingsValidation'

export const pluginManagementApi = {
  async openDirectory(installationId: string) {
    assertSuccess(await backend.command('plugin_open_directory', { installation_id: installationId }), '打开插件目录')
  },
  async list(): Promise<PluginInfo[]> {
    const plugins = assertSuccess(await backend.command('plugin_list'), '读取插件列表') ?? []
    for (const plugin of plugins) {
      if (plugin.development) parseDevelopment({ enabled: true, items: [plugin.development] })
      if (
        (plugin.source !== undefined && !['directory', 'package'].includes(plugin.source)) ||
        (plugin.supports_hot_reload !== undefined && typeof plugin.supports_hot_reload !== 'boolean')
      )
        throw new Error('PLUGIN_SCHEMA_INVALID')
    }
    return plugins
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

  async selectDirectory(): Promise<string | null> {
    const selected = await backend.command('select_directory', { purpose: 'plugin-directory' })
    if (!selected.success) throw new Error(selected.message || '选择插件目录失败')
    return selected.data?.path || null
  },

  async inspectDirectory(path: string): Promise<PluginDirectoryPreflight> {
    return assertSuccess(await backend.command('plugin_directory_inspect', { plugin_path: path }), '预检插件目录')
  },

  async installDirectory(path: string, options: { allowNetwork: boolean }): Promise<PluginPackageInstallResult> {
    return (
      assertSuccess(
        await backend.command('plugin_install', {
          plugin_path: path,
          confirm_unverified_source: true,
          allow_network: options.allowNetwork,
        }),
        '安装插件目录'
      ) ?? { status: 'installed' }
    )
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

  onSettingsChanged(handler: () => void): () => void {
    return backend.on('plugin:settings_updated', handler)
  },

  async getSettings(pluginName: string): Promise<PluginSettingsData> {
    const result = await backend.command('plugin_get_settings', { plugin_name: pluginName })
    return parseSettings(assertSuccess(result, '读取插件设置'))
  },

  async getPanels(pluginName: string): Promise<PluginPanelDefinition[]> {
    const result = assertSuccess(
      await backend.command('plugin_panels_get', { plugin_name: pluginName }),
      '读取插件面板'
    ) as { panels?: PluginPanelDefinition[] } | undefined
    return Array.isArray(result?.panels) ? result.panels : []
  },

  async getPanelData(pluginName: string, key: string): Promise<PluginPanelData> {
    const result = assertSuccess(
      await backend.command('plugin_panel_data', { plugin_name: pluginName, key }),
      '读取面板数据'
    ) as Partial<PluginPanelData> | undefined
    return { lists: result?.lists ?? {}, tasks: result?.tasks ?? {} }
  },

  async runPanelAction(pluginName: string, command: string, args: Record<string, unknown>) {
    return assertSuccess(
      await backend.command('plugin_panel_action', { plugin_name: pluginName, command, args }),
      '执行面板动作'
    )
  },

  async updateSetting(pluginName: string, key: string, value: unknown, settings: PluginSettingsData) {
    if (
      !settings.content_digest ||
      !settings.schema_revision ||
      settings.revision === undefined ||
      settings.editable === false
    ) {
      throw new Error('PLUGIN_SETTING_SCHEMA_UNAVAILABLE')
    }
    return assertSuccess(
      await backend.command('plugin_update_setting', {
        plugin_name: pluginName,
        key,
        value,
        expected_revision: settings.revision,
        content_digest: settings.content_digest,
        schema_revision: settings.schema_revision,
      }),
      '更新插件设置'
    )
  },
}
