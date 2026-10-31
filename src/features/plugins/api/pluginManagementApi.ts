import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import {
  pluginBusinessCapabilities,
  type PluginInfo,
  type PluginFileRecoveryChoice,
  type PluginInstanceProfileRecoveryChoice,
  type PluginPermissions,
  type PluginPermissionDecision,
  type PluginPackageInstallResult,
  type PluginPackagePreflight,
  type PluginPanelData,
  type PluginPanelDefinition,
  type PluginSettingsData,
  type PluginResourceQuery,
} from '@/types/plugins'
import { parseFileRecoveryPage, parseFileRecoveryReceipt } from './pluginFileRecoveryValidation'
import { parsePermissions, parsePermissionUpdate, parseResourcePage } from './pluginPermissionValidation'

export const pluginManagementApi = {
  async profileRecoveries(cursor?: string) {
    return parseFileRecoveryPage(
      assertSuccess(
        await backend.command('plugin_instance_profile_recoveries_list', {
          ...(cursor ? { cursor } : {}),
          limit: 50,
        }),
        '查询实例资料恢复'
      )
    )
  },

  async resolveProfileRecovery(choice: PluginInstanceProfileRecoveryChoice) {
    return parseFileRecoveryReceipt(
      assertSuccess(await backend.command('plugin_instance_profile_recovery_resolve', choice), '恢复实例原资料')
    )
  },

  async fileRecoveries(cursor?: string) {
    return parseFileRecoveryPage(
      assertSuccess(
        await backend.command('plugin_file_recoveries_list', {
          ...(cursor ? { cursor } : {}),
          limit: 50,
        }),
        '查询插件文件恢复'
      )
    )
  },

  async resolveFileRecovery(choice: PluginFileRecoveryChoice) {
    return parseFileRecoveryReceipt(
      assertSuccess(await backend.command('plugin_file_recovery_resolve', choice), '恢复插件私有文件')
    )
  },
  async permissions(installationId: string): Promise<PluginPermissions> {
    return parsePermissions(
      assertSuccess(
        await backend.command('plugin_permissions_get', { installation_id: installationId }),
        '读取插件权限'
      )
    )
  },

  async permissionResources(query: PluginResourceQuery) {
    const page = parseResourcePage(
      assertSuccess(await backend.command('plugin_permission_resources', query), '查询可审阅资源')
    )
    const isJava = query.capability === 'java.read' || query.capability === 'java.use'
    const isAccount = query.capability === 'accounts.read'
    if (page.items.some((item) => (item.kind === 'java_runtime') !== isJava || (item.kind === 'account') !== isAccount))
      throw new Error('PLUGIN_SCHEMA_INVALID')
    return page
  },

  async updatePermissions(
    view: PluginPermissions,
    decisions: PluginPermissionDecision[],
    resourceRevision?: number,
    javaResourceRevision?: number,
    accountResourceRevision?: number
  ) {
    return parsePermissionUpdate(
      assertSuccess(
        await backend.command('plugin_permissions_update', {
          installation_id: view.installation_id,
          content_digest: view.content_digest,
          expected_revision: view.revision,
          decisions,
          resource_revision: resourceRevision,
          java_resource_revision: javaResourceRevision,
          account_resource_revision: accountResourceRevision,
        }),
        '保存插件权限'
      )
    )
  },

  async list(): Promise<PluginInfo[]> {
    const plugins = assertSuccess(await backend.command('plugin_list'), '读取插件列表') ?? []
    for (const plugin of plugins) {
      if (
        plugin.installation_id &&
        (!Array.isArray(plugin.requested_permissions) ||
          plugin.requested_permissions.some(
            (permission) => !pluginBusinessCapabilities.some((capability) => capability === permission)
          ))
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

  async updateSetting(pluginName: string, key: string, value: unknown, expectedRevision?: number) {
    return assertSuccess(
      await backend.command('plugin_update_setting', {
        plugin_name: pluginName,
        key,
        value,
        ...(expectedRevision === undefined ? {} : { expected_revision: expectedRevision }),
      }),
      '更新插件设置'
    )
  },
}
