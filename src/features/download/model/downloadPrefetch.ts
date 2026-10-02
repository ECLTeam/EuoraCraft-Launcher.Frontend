import { pinia } from '@/app/stores'
import { globalCache, CACHE_GROUPS, CACHE_KEYS } from '@/cache'
import { resolveInitialResourceTarget, instanceKey } from '@/composables/useResourceInstallTarget'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { modApi } from '@/features/mods/api/modApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { CommandPayloadMap } from '@/types/api'
import type { MinecraftVersionCatalog, ScannedVersion } from '@/types/instances'
import type { ModSearchResult, ModSourceConfig } from '@/types/mods'

export type DownloadResourceType = 'mod' | 'resourcepack' | 'shaderpack' | 'datapack' | 'modpack' | 'world'

const resourceTypes: DownloadResourceType[] = ['mod', 'resourcepack', 'shaderpack', 'datapack', 'world']
const catalogTtl = 10 * 60 * 1000
const popularTtl = 10 * 60 * 1000
const sourceConfigKey = 'download-source-config'
const pendingPopular = new Map<string, Promise<ModSearchResult>>()
let pendingSourceConfig: Promise<ModSourceConfig> | null = null

/** 与分类页默认热门列表一致的第一页请求，不预取用户搜索或详情。 */
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

function popularCacheKey(request: CommandPayloadMap['search_mods'], targetKey: string): string {
  return `download-popular:${JSON.stringify([targetKey, request])}`
}

/** 相同实例与筛选条件共享缓存和在途请求；强制刷新会在旧请求结束后重新请求。 */
export async function getPopularPage(
  resourceType: DownloadResourceType,
  instance: ScannedVersion | null,
  targetKey: string,
  force = false
): Promise<ModSearchResult> {
  const request = createPopularRequest(resourceType, instance)
  const key = popularCacheKey(request, targetKey)
  if (!force) {
    const pending = pendingPopular.get(key)
    if (pending) return pending
    const cached = globalCache.get<ModSearchResult>(key)
    if (cached) return cached
  } else {
    await pendingPopular.get(key)?.catch(() => undefined)
  }
  const pending = modApi.search({ ...request, refresh: force }).then((result) => {
    globalCache.set(key, result, { ttl: popularTtl, group: CACHE_GROUPS.API })
    return result
  })
  pendingPopular.set(key, pending)
  try {
    return await pending
  } finally {
    if (pendingPopular.get(key) === pending) pendingPopular.delete(key)
  }
}

/** 共享资源来源状态，避免每个分类页重复读取。 */
export async function getResourceSourceConfig(): Promise<ModSourceConfig> {
  const cached = globalCache.get<ModSourceConfig>(sourceConfigKey)
  if (cached) return cached
  if (pendingSourceConfig) return pendingSourceConfig
  const pending = modApi.sourceConfig().then((result) => {
    globalCache.set(sourceConfigKey, result, { ttl: popularTtl, group: CACHE_GROUPS.API })
    return result
  })
  pendingSourceConfig = pending
  try {
    return await pending
  } finally {
    if (pendingSourceConfig === pending) pendingSourceConfig = null
  }
}

/** 用现有持久缓存预取版本目录，目录请求与页面挂载时的同一 IPC 调用合并。 */
export async function prefetchVersionCatalog(): Promise<MinecraftVersionCatalog> {
  const cached = globalCache.get<MinecraftVersionCatalog>(CACHE_KEYS.VERSIONS)
  if (cached) return cached
  const catalog = await instanceInstallApi.getCatalog({ silent: true })
  globalCache.set(CACHE_KEYS.VERSIONS, catalog, {
    ttl: catalogTtl,
    group: CACHE_GROUPS.VERSION,
    persistent: true,
  })
  return catalog
}

/** 逐类预热双平台列表，最多占用两个平台请求，保留前台搜索容量。 */
export async function prefetchPopularPages(
  contexts: Array<{ type: DownloadResourceType; instance: ScannedVersion | null; targetKey: string }>
): Promise<void> {
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < contexts.length) {
      const context = contexts[nextIndex++]
      if (!context) return
      try {
        await getPopularPage(context.type, context.instance, context.targetKey)
      } catch (error) {
        console.warn(`[downloadPrefetch] ${context.type} 热门列表预取失败:`, error)
      }
    }
  }
  await worker()
}

/** 主窗口就绪后执行的低优先级后台预热，不向页面展示预取失败。 */
export async function prefetchDownloadData(): Promise<void> {
  try {
    await prefetchVersionCatalog()
  } catch (error) {
    console.warn('[downloadPrefetch] Minecraft 版本目录预取失败:', error)
  }

  const instanceStore = useInstanceStore(pinia)
  const settingsStore = useSettingsStore(pinia)
  try {
    await instanceStore.ensureLoaded()
  } catch (error) {
    console.warn('[downloadPrefetch] 安装目标读取失败:', error)
    return
  }

  const sourceConfig = await getResourceSourceConfig().catch((error) => {
    console.warn('[downloadPrefetch] 资源来源配置读取失败:', error)
    return null
  })
  const contexts = resourceTypes
    .filter((type) => type !== 'world' || sourceConfig?.curseforge.available !== false)
    .map((type) => {
      const instance = resolveInitialResourceTarget(
        instanceStore.scannedVersions,
        settingsStore.download.resourceInstallCache?.[type],
        instanceStore.selectedVersion,
        instanceStore.currentGamePath
      )
      return { type, instance, targetKey: instance ? instanceKey(instance) : '' }
    })
  await prefetchPopularPages(contexts)
}
