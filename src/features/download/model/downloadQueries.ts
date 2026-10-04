import { modApi } from '@/features/mods/api/modApi'
import type { CommandPayloadMap } from '@/types/api'
import type { ScannedVersion } from '@/types/instances'
import type { ModSearchResult, ModSourceConfig } from '@/types/mods'

export type DownloadResourceType = 'mod' | 'resourcepack' | 'shaderpack' | 'datapack' | 'modpack' | 'world'

const pendingPopular = new Map<string, { promise: Promise<ModSearchResult>; forced: boolean }>()
let pendingSourceConfig: Promise<ModSourceConfig> | null = null

/** 分类页按需查询第一页；不在启动时扫描分类，网络结果缓存由后端搜索服务管理。 */
export function createPopularRequest(
  resourceType: DownloadResourceType,
  instance: ScannedVersion | null
): CommandPayloadMap['search_mods'] {
  return {
    query: '',
    source: resourceType === 'world' ? 'curseforge' : 'all',
    game_version: instance?.vanillaName ?? '',
    loader_type: resourceType === 'mod' ? (instance?.primaryLoader ?? '') : '',
    resource_type: resourceType,
    limit: 20,
    offset: 0,
    sort: '',
  }
}

/** 前端仅合并正在进行的查询，刷新请求等旧查询结束后由后端重建会话。 */
export async function getPopularPage(
  resourceType: DownloadResourceType,
  instance: ScannedVersion | null,
  targetKey: string,
  force = false
): Promise<ModSearchResult> {
  const request = createPopularRequest(resourceType, instance)
  const key = JSON.stringify([targetKey, request])
  const existing = pendingPopular.get(key)
  if (existing && (!force || existing.forced)) return existing.promise
  if (force && existing) {
    await existing.promise.catch(() => undefined)
    const newer = pendingPopular.get(key)
    if (newer?.forced) return newer.promise
  }
  const pending = modApi.search({ ...request, refresh: force })
  pendingPopular.set(key, { promise: pending, forced: force })
  try {
    return await pending
  } finally {
    if (pendingPopular.get(key)?.promise === pending) pendingPopular.delete(key)
  }
}

/** 来源配置在页面使用时读取，避免前端有效期遮蔽后端配置变化。 */
export async function getResourceSourceConfig(): Promise<ModSourceConfig> {
  if (pendingSourceConfig) return pendingSourceConfig
  const pending = modApi.sourceConfig()
  pendingSourceConfig = pending
  try {
    return await pending
  } finally {
    if (pendingSourceConfig === pending) pendingSourceConfig = null
  }
}
