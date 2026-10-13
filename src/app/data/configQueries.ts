import { queryClient } from '@/app/queryClient'
import { queryKeys } from '@/app/queryKeys'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { parseSettingsSnapshot, type SettingsSection } from '@/features/settings/model/settingsSnapshot'
import { serializeMutation, waitForMutations } from './mutationCoordinator'
import { invalidateResource, readResource, setResourceSnapshot } from './refreshCoordinator'

export type SettingsSnapshot = Awaited<ReturnType<typeof settingsApi.load>>

/** 配置消费者共享读取；有效配置包含宿主的环境变量和启动参数覆盖。 */
export function configQuery(options: { force?: boolean } = {}): Promise<SettingsSnapshot> {
  return readResource({
    queryKey: queryKeys.config.all,
    load: () => settingsApi.load(),
    ...options,
  })
}

export function invalidateConfig(): Promise<void> {
  return invalidateResource(queryKeys.config.all)
}

/** 同一分区的读改写共享串行队列，失败只终止当前动作，不阻塞后续重试。 */
export function serializeConfigWrite<T>(section: string, action: () => Promise<T>): Promise<T> {
  return serializeMutation(['config-write', section], action)
}

export async function waitForConfigWrites(): Promise<void> {
  await waitForMutations(['config-write'])
}

/** 只有已验证的有效分区能直接应用，旧事件协议继续通过失效与重读回退。 */
export function acceptConfigSnapshot(payload: unknown): boolean {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('effective' in payload) ||
    payload.effective !== true ||
    !('section' in payload) ||
    !('data' in payload)
  )
    return false
  const section = payload.section
  if (
    section !== 'ui' &&
    section !== 'game' &&
    section !== 'launcher' &&
    section !== 'download' &&
    section !== 'connector'
  )
    return false
  const previous = queryClient.getQueryData<SettingsSnapshot>(queryKeys.config.all)
  if (!previous) return false
  const next = parseSettingsSnapshot({ ...previous, [section]: payload.data })
  setResourceSnapshot(queryKeys.config.all, next)
  return true
}

/** 兼容无快照的旧后端：仅在没有权威写入响应时要求一次配置重读。 */
export function confirmConfigWrite(payload: unknown): SettingsSnapshot | null {
  if (acceptConfigSnapshot(payload)) return queryClient.getQueryData<SettingsSnapshot>(queryKeys.config.all) ?? null
  void invalidateConfig()
  return null
}

export function setConfigSectionSnapshot(section: SettingsSection, data: unknown): void {
  acceptConfigSnapshot({ section, data, effective: true })
}
