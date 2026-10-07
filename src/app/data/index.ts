// 全局启动数据层：跨视图共享的数据统一经 vue-query 读取，按 queryKey 去重与缓存。

import { queryClient } from '@/app/queryClient'
import { queryKeys } from '@/app/queryKeys'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { pluginHostApi } from '@/features/plugins/api/pluginHostApi'
import { aboutApi } from '@/features/settings/api/aboutApi'
import { settingsApi } from '@/features/settings/api/settingsApi'
import type { AccountListData } from '@/types/accounts'
import type { PluginRoute, PluginSlotItem, VueComponentDef, VueSlotItem } from '@/types/plugins'
import type { LauncherInfo } from '@/types/system'

// 挂载前读取窗口装饰信息时使用，避免后端无响应拖慢首屏渲染。
const LAUNCHER_INFO_TIMEOUT_MS = 3000

/** 插件注册表的完整快照，四个子命令必须来自同一次读取，避免渲染出不一致的中间状态。 */
export interface PluginRegistry {
  routes: PluginRoute[]
  slots: Record<string, PluginSlotItem[]>
  vueSlots: Record<string, VueSlotItem[]>
  vueComponents: Record<string, VueComponentDef>
}

/**
 * 一次读取全部启动器配置分区，配置域的所有消费者共享同一次请求与缓存。
 */
export function configQuery() {
  return queryClient.fetchQuery({
    queryKey: queryKeys.config.all,
    queryFn: () => settingsApi.load(),
  })
}

/**
 * 读取启动器运行信息（版本号与窗口装饰），窗口外壳与运行时共用同一份结果。
 */
export function launcherInfoQuery(): Promise<LauncherInfo | null> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.launcherInfo,
    queryFn: () => aboutApi.getLauncherInfo(LAUNCHER_INFO_TIMEOUT_MS),
  })
}

/**
 * 读取账户列表，应用层与插件状态层共享同一份缓存。
 */
export function accountsQuery(): Promise<AccountListData> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => accountsApi.list(),
  })
}

/**
 * 配置写入后失效缓存，避免后续读取拿到写入前的快照。
 */
export function invalidateConfig(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.config.root })
}

/**
 * 账户变更后失效缓存，下次读取会重新向后端确认。
 */
export function invalidateAccounts(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
}

/**
 * 用后端推送的账户快照直接更新缓存，避免收到变更事件后再发起一次读取。
 */
export function setAccountsSnapshot(data: AccountListData): void {
  queryClient.setQueryData(queryKeys.accounts, data)
}

/**
 * 一次读取插件注册表的全部内容，插件桥接的初始装载只触发一轮 IPC。
 */
export function pluginRegistryQuery(): Promise<PluginRegistry> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.pluginRegistry,
    queryFn: async () => {
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

/**
 * 插件注册表结构变化后失效缓存，后续读取会重新向后端确认。
 */
export function invalidatePluginRegistry(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.pluginRegistry })
}
