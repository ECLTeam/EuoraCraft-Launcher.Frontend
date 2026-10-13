import { queryKeys } from '@/app/queryKeys'
import { pluginHostApi } from '@/features/plugins/api/pluginHostApi'
import type { PluginRoute, PluginSlotItem, VueComponentDef, VueSlotItem } from '@/types/plugins'
import { invalidateResource, readResource } from './refreshCoordinator'

export interface PluginRegistry {
  routes: PluginRoute[]
  slots: Record<string, PluginSlotItem[]>
  vueSlots: Record<string, VueSlotItem[]>
  vueComponents: Record<string, VueComponentDef>
}

/** 四个注册表子查询组成同一快照，刷新过程中收到新变更时重新取最终快照。 */
export function pluginRegistryQuery(): Promise<PluginRegistry> {
  return readResource({
    queryKey: queryKeys.pluginRegistry,
    load: async () => {
      const [routes, slots, vueSlots, vueComponents] = await Promise.all([
        pluginHostApi.getRoutes(),
        pluginHostApi.getSlots(),
        pluginHostApi.getVueSlots(),
        pluginHostApi.getVueComponents(),
      ])
      return { routes, slots, vueSlots, vueComponents }
    },
  })
}

export function invalidatePluginRegistry(): Promise<void> {
  return invalidateResource(queryKeys.pluginRegistry)
}
