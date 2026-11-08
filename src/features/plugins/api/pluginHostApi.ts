import backend from '@/api/client'
import type { BackendEventName, BackendEvents } from '@/types/api'
import type { PluginRoute, PluginSlotItem, VueComponentDef, VueSlotItem } from '@/types/plugins'

export const pluginHostApi = {
  async getRoutes(pluginId?: string): Promise<PluginRoute[]> {
    const result = await backend.command('plugin_get_routes', { plugin_id: pluginId })
    if (!result.success) throw new Error(result.message || '读取插件路由失败')
    return result.data ?? []
  },

  async getSlots(): Promise<Record<string, PluginSlotItem[]>> {
    const result = await backend.command('plugin_get_slots')
    if (!result.success) throw new Error(result.message || '读取插件插槽失败')
    return result.data ?? {}
  },

  async getVueSlots(): Promise<Record<string, VueSlotItem[]>> {
    const result = await backend.command('plugin_get_vue_slots')
    if (!result.success) throw new Error(result.message || '读取插件 Vue 插槽失败')
    return result.data ?? {}
  },

  async getVueComponents(): Promise<Record<string, VueComponentDef>> {
    const result = await backend.command('plugin_get_vue_components')
    if (!result.success) throw new Error(result.message || '读取插件 Vue 组件失败')
    return result.data ?? {}
  },

  callCommand(command: string, params?: Record<string, unknown>) {
    return backend.command('plugin_call_command', { command, params })
  },

  queryCommand(command: string, params?: Record<string, unknown>) {
    return backend.command('plugin_query_command', { command, params })
  },

  async notifySidebarState(collapsed: boolean): Promise<void> {
    const result = await backend.command('plugin_notify_sidebar_state', { collapsed })
    if (!result.success) throw new Error(result.message || '通知插件侧栏状态失败')
  },

  subscribe<E extends BackendEventName>(event: E, handler: (payload: BackendEvents[E]) => void): () => void {
    return backend.on(event, handler)
  },
}
