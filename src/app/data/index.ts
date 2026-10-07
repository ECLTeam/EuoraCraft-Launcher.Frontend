// 全局启动数据层：跨视图共享的数据统一经 vue-query 读取，按 queryKey 去重与缓存。

import { queryClient } from '@/app/queryClient'
import { queryKeys } from '@/app/queryKeys'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { aboutApi } from '@/features/settings/api/aboutApi'
import { settingsApi } from '@/features/settings/api/settingsApi'
import type { AccountListData } from '@/types/accounts'
import type { LauncherInfo } from '@/types/system'

// 挂载前读取窗口装饰信息时使用，避免后端无响应拖慢首屏渲染。
const LAUNCHER_INFO_TIMEOUT_MS = 3000

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
