import { nonEmpty, object, optional, picklist, pipe, string } from 'valibot'
import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import { assertParams } from '@/app/validation'
import type { SelectResult } from '@/types/accounts'
import type { CommandPayloadMap } from '@/types/api'
import type { InstallVersionResult, MinecraftVersionCatalog, ScannedVersion } from '@/types/instances'
import { gamePathIdentity, normalizeGamePath, registerGamePathIdentity } from '@/utils/path'

export type InstallableLoader = 'fabric' | 'forge' | 'neoforge' | 'quilt'
export type VersionsChangedHandler = (payload: { gamePath: string }) => void

const scanCache = new Map<string, ScannedVersion[]>()
const scanGenerations = new Map<string, number>()
const pendingScans = new Map<string, { generation: number; promise: Promise<void> }>()
let catalogRequest: Promise<MinecraftVersionCatalog> | null = null
const versionsChangedHandlers = new Set<VersionsChangedHandler>()
let isListeningForVersionChanges = false
let scanRequestCounter = 0
const latestRequestByRootKey = new Map<string, number>()

function cloneVersions(versions: ScannedVersion[]): ScannedVersion[] {
  return versions.map((version) => ({ ...version }))
}

function invalidateScanCache(path?: string): void {
  const cachedKeys = new Set([...scanCache.keys(), ...pendingScans.keys(), ...scanGenerations.keys()])
  const keys = path
    ? new Set([
        normalizeGamePath(path),
        ...[...cachedKeys].filter((key) => gamePathIdentity(key) === gamePathIdentity(path)),
      ])
    : cachedKeys
  for (const key of keys) {
    scanGenerations.set(key, (scanGenerations.get(key) ?? 0) + 1)
    scanCache.delete(key)
  }
}

function ensureVersionChangeListener(): void {
  if (isListeningForVersionChanges) return
  isListeningForVersionChanges = true
  backend.on('game:versions_changed', (payload) => {
    invalidateScanCache(payload.gamePath)
    versionsChangedHandlers.forEach((handler) => handler(payload))
  })
}

export const instanceInstallApi = {
  getCatalog(options: { silent?: boolean } = {}): Promise<MinecraftVersionCatalog> {
    if (catalogRequest) return catalogRequest
    const request = backend
      .command('game_versions', { classified: true })
      .then((response) => {
        if (options.silent) {
          if (!response.success) throw new Error(response.message || '获取实例列表失败')
          return response.data as MinecraftVersionCatalog
        }
        return assertSuccess(response, '获取实例列表') as MinecraftVersionCatalog
      })
      .finally(() => {
        if (catalogRequest === request) catalogRequest = null
      })
    catalogRequest = request
    return request
  },

  async getLoaderVersions(loader: InstallableLoader, gameVersion: string): Promise<string[]> {
    assertParams(
      object({
        loader: pipe(string(), nonEmpty('加载器不能为空')),
        gameVersion: pipe(string(), nonEmpty('游戏版本不能为空')),
      }),
      { loader, gameVersion },
      '获取加载器版本'
    )

    return assertSuccess(
      await backend.command('game_loader_versions', { loader, game_version: gameVersion }),
      `获取 ${loader} 版本`
    )
  },

  async getFabricApiVersions(gameVersion: string): Promise<string[]> {
    assertParams(
      object({ gameVersion: pipe(string(), nonEmpty('游戏版本不能为空')) }),
      { gameVersion },
      '获取 Fabric API 版本'
    )

    return assertSuccess(
      await backend.command('game_fabric_api_versions', { loader: 'fabric', game_version: gameVersion }),
      '获取 Fabric API 版本'
    )
  },

  async scan(paths: string[], options: { force?: boolean } = {}): Promise<ScannedVersion[]> {
    ensureVersionChangeListener()
    const requestedPaths = [...new Set(paths.filter((path) => path.trim()))]
    if (options.force) requestedPaths.forEach((path) => invalidateScanCache(path))

    const waiting: Promise<void>[] = []
    const supersededRootByPath = new Map<string, string>()
    const missingPaths = requestedPaths.filter((path) => {
      const key = normalizeGamePath(path)
      if (scanCache.has(key)) return false
      const pending = pendingScans.get(key)
      if (pending && pending.generation === (scanGenerations.get(key) ?? 0)) {
        waiting.push(pending.promise)
        return false
      }
      return true
    })
    if (missingPaths.length > 0) {
      const requestId = ++scanRequestCounter
      const generations = new Map(
        missingPaths.map((path) => {
          const key = normalizeGamePath(path)
          return [key, scanGenerations.get(key) ?? 0] as const
        })
      )
      const request = (async () => {
        const scanned =
          assertSuccess(
            await backend.command('game_scan', { paths: missingPaths, force: options.force || undefined }),
            '扫描本地实例'
          ) ?? []
        const snapshots = new Map([...generations.keys()].map((key) => [key, [] as ScannedVersion[]]))
        scanned.forEach((version) => {
          const fallbackPath = missingPaths.length === 1 ? (missingPaths[0] ?? '') : ''
          const key = normalizeGamePath(version.path || fallbackPath)
          const affectedKeys = missingPaths
            .map(normalizeGamePath)
            .filter(
              (candidate) =>
                candidate === key || version.rootAliases?.some((alias) => normalizeGamePath(alias) === candidate)
            )
          if (!affectedKeys.some((candidate) => (scanGenerations.get(candidate) ?? 0) === generations.get(candidate)))
            return
          const rootKey = version.rootKey ?? gamePathIdentity(version.path || fallbackPath)
          if ((latestRequestByRootKey.get(rootKey) ?? 0) > requestId) {
            affectedKeys.forEach((candidate) => {
              if ((scanGenerations.get(candidate) ?? 0) !== generations.get(candidate)) return
              supersededRootByPath.set(candidate, rootKey)
              registerGamePathIdentity(candidate, rootKey)
            })
            return
          }
          latestRequestByRootKey.set(rootKey, requestId)
          if (version.rootKey) {
            registerGamePathIdentity(version.path, version.rootKey)
            version.rootAliases?.forEach((alias) => registerGamePathIdentity(alias, version.rootKey!))
          }
          snapshots
            .get(key)
            ?.push({ ...version, instanceDirectoryName: version.versionId, minecraftVersion: version.vanillaName })
        })
        for (const path of missingPaths) {
          const key = normalizeGamePath(path)
          if (snapshots.get(key)?.length) continue
          const matchingVersions = scanned.filter(
            (version) =>
              version.rootKey &&
              (latestRequestByRootKey.get(version.rootKey) ?? 0) <= requestId &&
              version.rootAliases?.some((alias) => normalizeGamePath(alias) === key)
          )
          snapshots.set(
            key,
            matchingVersions.map((version) => ({
              ...version,
              path,
              instanceDirectoryName: version.versionId,
              minecraftVersion: version.vanillaName,
            }))
          )
        }
        for (const [key, snapshot] of snapshots) {
          if ((scanGenerations.get(key) ?? 0) === generations.get(key)) scanCache.set(key, snapshot)
        }
      })()
      for (const [key, generation] of generations) pendingScans.set(key, { generation, promise: request })
      const cleanup = () => {
        for (const key of generations.keys()) if (pendingScans.get(key)?.promise === request) pendingScans.delete(key)
      }
      void request.then(cleanup, cleanup)
      waiting.push(request)
    }
    await Promise.all(waiting)

    return requestedPaths.flatMap((path) => {
      const cached = scanCache.get(normalizeGamePath(path))
      if (cached?.length) return cloneVersions(cached)
      const rootKey = supersededRootByPath.get(normalizeGamePath(path))
      if (!rootKey) return []
      const shared = [...scanCache.values()].find((versions) => versions.some((version) => version.rootKey === rootKey))
      return shared ? cloneVersions(shared).map((version) => ({ ...version, path })) : []
    })
  },

  invalidateScanCache,

  onVersionsChanged(handler: VersionsChangedHandler): () => void {
    ensureVersionChangeListener()
    versionsChangedHandlers.add(handler)
    return () => versionsChangedHandlers.delete(handler)
  },

  async exists(path: string): Promise<boolean> {
    const result = await backend.command('fs_exists', { path })
    return assertSuccess(result, '检查实例目录').exists
  },

  async install(params: CommandPayloadMap['game_install']): Promise<InstallVersionResult> {
    assertParams(
      object({
        version_id: pipe(string(), nonEmpty('版本 ID 不能为空')),
        game_path: pipe(string(), nonEmpty('游戏路径不能为空')),
        version_name: optional(string()),
        loader_type: optional(picklist(['fabric', 'forge', 'neoforge', 'quilt'], '无效的加载器类型')),
        loader_version: optional(string()),
        fabric_api_version: optional(string()),
      }),
      params,
      '安装实例'
    )

    const result = assertSuccess(await backend.command('game_install', params), '安装实例')
    if (params.game_path) invalidateScanCache(params.game_path)
    return result
  },

  async uninstall(versionId: string, gamePath: string): Promise<void> {
    assertParams(
      object({
        versionId: pipe(string(), nonEmpty('版本 ID 不能为空')),
        gamePath: pipe(string(), nonEmpty('游戏路径不能为空')),
      }),
      { versionId, gamePath },
      '卸载实例'
    )

    assertSuccess(await backend.command('game_uninstall', { version_id: versionId, game_path: gamePath }), '卸载实例')
    invalidateScanCache(gamePath)
  },

  async selectDirectory(): Promise<SelectResult | null> {
    return assertSuccess(await backend.command('select_directory'), '选择目录') ?? null
  },

  async openFolder(path: string): Promise<void> {
    assertSuccess(await backend.command('open_folder', { path }), '打开目录')
  },
}
