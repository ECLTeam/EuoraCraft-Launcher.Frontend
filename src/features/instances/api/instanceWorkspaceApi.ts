import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { getCurrentLocale } from '@/i18n'
import type {
  SchematicAssetsBundle,
  SchematicChunkBatch,
  SchematicPreviewData,
  SchematicSessionData,
} from '@/types/api'
import type {
  GameOperation,
  GameResource,
  GameResourceType,
  InstanceTargetPayload,
  ScannedVersion,
  ScreenshotEntry,
  ServerEntry,
  ServerStatus,
  WorldEntry,
  WorldPatch,
} from '@/types/instances'
import type { ModItem } from '@/types/mods'
import { gamePathIdentity } from '@/utils/path'
export function workspaceTarget(version: ScannedVersion, versionIsolation?: boolean): InstanceTargetPayload {
  const target = { game_path: version.path, version_id: version.versionId }
  return versionIsolation === undefined ? target : { ...target, version_isolation: versionIsolation }
}

const call = async <T>(name: Parameters<typeof backend.command>[0], payload: object, message: string): Promise<T> =>
  unwrapResponse((await backend.command(name, payload as never)) as never, message) as T

type WorkspaceCacheSection = 'worlds' | 'screenshots' | 'servers'

const worldCache = new Map<string, WorldEntry[]>()
const screenshotCache = new Map<string, ScreenshotEntry[]>()
const serverCache = new Map<string, ServerEntry[]>()
const thumbnailCache = new Map<string, { path: string }>()
const pendingWorlds = new Map<string, Promise<WorldEntry[]>>()
const pendingScreenshots = new Map<string, Promise<ScreenshotEntry[]>>()
const pendingServers = new Map<string, Promise<ServerEntry[]>>()
const pendingThumbnails = new Map<string, Promise<{ path: string }>>()
const cacheRevisions = new Map<string, number>()

function workspaceCacheKey(target: InstanceTargetPayload): string {
  const gamePath = gamePathIdentity(target.game_path)
  return `${gamePath}\0${target.version_id}\0${target.version_isolation ? 'isolated' : 'shared'}`
}

function cloneEntries<T extends object>(items: T[]): T[] {
  return items.map((item) => ({ ...item }))
}

function cacheRevisionKey(section: WorkspaceCacheSection, key: string): string {
  return `${section}\0${key}`
}

function invalidateSection<T extends object>(
  section: WorkspaceCacheSection,
  key: string,
  cache: Map<string, T[]>,
  pending: Map<string, Promise<T[]>>
): void {
  const revisionKey = cacheRevisionKey(section, key)
  cacheRevisions.set(revisionKey, (cacheRevisions.get(revisionKey) ?? 0) + 1)
  cache.delete(key)
  pending.delete(key)
}

async function cachedEntries<T extends object>(
  section: WorkspaceCacheSection,
  cache: Map<string, T[]>,
  pending: Map<string, Promise<T[]>>,
  key: string,
  load: () => Promise<T[]>
): Promise<T[]> {
  const cached = cache.get(key)
  if (cached) return cloneEntries(cached)

  const revisionKey = cacheRevisionKey(section, key)
  const revision = cacheRevisions.get(revisionKey) ?? 0
  let request = pending.get(key)
  if (!request) {
    request = load().then((items) => {
      if ((cacheRevisions.get(revisionKey) ?? 0) === revision) cache.set(key, cloneEntries(items))
      return items
    })
    pending.set(key, request)
    const removePending = () => {
      if (pending.get(key) === request) pending.delete(key)
    }
    void request.then(removePending, removePending)
  }
  return request.then(cloneEntries)
}

async function cachedThumbnail(target: InstanceTargetPayload, screenshotId: string): Promise<{ path: string }> {
  const targetKey = workspaceCacheKey(target)
  const key = `${targetKey}\0${screenshotId}`
  const cached = thumbnailCache.get(key)
  if (cached) return { ...cached }

  const revisionKey = cacheRevisionKey('screenshots', targetKey)
  const revision = cacheRevisions.get(revisionKey) ?? 0
  let request = pendingThumbnails.get(key)
  if (!request) {
    request = call<{ path: string }>(
      'game_screenshot_thumbnail',
      { ...target, screenshot_id: screenshotId },
      '生成截图缩略图'
    ).then((thumbnail) => {
      if ((cacheRevisions.get(revisionKey) ?? 0) === revision) thumbnailCache.set(key, { ...thumbnail })
      return thumbnail
    })
    pendingThumbnails.set(key, request)
    const removePending = () => {
      if (pendingThumbnails.get(key) === request) pendingThumbnails.delete(key)
    }
    void request.then(removePending, removePending)
  }
  return request.then((thumbnail) => ({ ...thumbnail }))
}

function invalidateWorkspaceCache(target: InstanceTargetPayload, section?: WorkspaceCacheSection): void {
  const key = workspaceCacheKey(target)
  if (!section || section === 'worlds') invalidateSection('worlds', key, worldCache, pendingWorlds)
  if (!section || section === 'servers') invalidateSection('servers', key, serverCache, pendingServers)
  if (!section || section === 'screenshots') {
    invalidateSection('screenshots', key, screenshotCache, pendingScreenshots)
    const thumbnailPrefix = `${key}\0`
    for (const thumbnailKey of thumbnailCache.keys()) {
      if (thumbnailKey.startsWith(thumbnailPrefix)) thumbnailCache.delete(thumbnailKey)
    }
    for (const thumbnailKey of pendingThumbnails.keys()) {
      if (thumbnailKey.startsWith(thumbnailPrefix)) pendingThumbnails.delete(thumbnailKey)
    }
  }
}

function cachedWorlds(target: InstanceTargetPayload): Promise<WorldEntry[]> {
  return cachedEntries('worlds', worldCache, pendingWorlds, workspaceCacheKey(target), () =>
    call<WorldEntry[]>('game_world_list', target, '读取存档')
  )
}

async function patchWorld(target: InstanceTargetPayload, worldId: string, patch: WorldPatch): Promise<WorldEntry> {
  const world = await call<WorldEntry>('game_world_patch', { ...target, world_id: worldId, patch }, '修改存档')
  invalidateWorkspaceCache(target, 'worlds')
  return world
}

async function copyWorld(target: InstanceTargetPayload, worldId: string, newWorldId: string): Promise<GameOperation> {
  const operation = await call<GameOperation>(
    'game_world_copy',
    { ...target, world_id: worldId, new_world_id: newWorldId },
    '复制存档'
  )
  return operation
}

async function deleteWorld(target: InstanceTargetPayload, worldId: string): Promise<void> {
  await call<void>('game_world_delete', { ...target, world_id: worldId }, '删除存档')
  invalidateWorkspaceCache(target, 'worlds')
}

async function setWorldIcon(
  target: InstanceTargetPayload,
  worldId: string,
  sourcePath: string
): Promise<{ path: string }> {
  const result = await call<{ path: string }>(
    'game_world_icon_set',
    { ...target, world_id: worldId, source_path: sourcePath },
    '设置世界图标'
  )
  invalidateWorkspaceCache(target, 'worlds')
  return result
}

async function importWorld(target: InstanceTargetPayload, sourcePath: string): Promise<GameOperation> {
  const operation = await call<GameOperation>('game_world_import', { ...target, source_path: sourcePath }, '导入存档')
  return operation
}

function cachedScreenshots(target: InstanceTargetPayload): Promise<ScreenshotEntry[]> {
  return cachedEntries('screenshots', screenshotCache, pendingScreenshots, workspaceCacheKey(target), () =>
    call<ScreenshotEntry[]>('game_screenshot_list', target, '读取截图')
  )
}

async function deleteScreenshot(target: InstanceTargetPayload, screenshotId: string): Promise<void> {
  await call<void>('game_screenshot_delete', { ...target, screenshot_id: screenshotId }, '删除截图')
  invalidateWorkspaceCache(target, 'screenshots')
}

function cachedServers(target: InstanceTargetPayload): Promise<ServerEntry[]> {
  return cachedEntries('servers', serverCache, pendingServers, workspaceCacheKey(target), () =>
    call<ServerEntry[]>('game_server_list', target, '读取服务器')
  )
}

async function saveServer(
  target: InstanceTargetPayload,
  server: Partial<ServerEntry> & Pick<ServerEntry, 'name' | 'address'>
): Promise<ServerEntry> {
  const result = await call<ServerEntry>(
    'game_server_upsert',
    { ...target, server_id: server.id, name: server.name, address: server.address, favorite: server.favorite },
    '保存服务器'
  )
  invalidateWorkspaceCache(target, 'servers')
  return result
}

async function deleteServer(target: InstanceTargetPayload, serverId: string): Promise<void> {
  await call<void>('game_server_delete', { ...target, server_id: serverId }, '删除服务器')
  invalidateWorkspaceCache(target, 'servers')
}

export const instanceWorkspaceApi = {
  folders: (
    target: InstanceTargetPayload,
    folder: 'instance' | 'mods' | 'saves' | 'screenshots' | 'logs' | 'crash-reports'
  ) => call<{ path: string }>('game_instance_folder_open', { ...target, folder }, '打开实例目录'),
  mods: (target: InstanceTargetPayload) => call<ModItem[]>('game_instance_mods_list', target, '获取模组列表'),
  toggleMod: (target: InstanceTargetPayload, filename: string) =>
    call<{ enabled: boolean }>('game_instance_mod_toggle', { ...target, filename }, '切换模组'),
  addMod: (target: InstanceTargetPayload, sourcePath: string) =>
    call<{ filename: string }>('game_instance_mod_add', { ...target, source_path: sourcePath }, '添加模组'),
  removeMod: (target: InstanceTargetPayload, filename: string) =>
    call<void>('game_instance_mod_remove', { ...target, filename }, '删除模组'),
  modsFolder: (target: InstanceTargetPayload) =>
    call<{ path: string }>('game_instance_mods_folder_open', target, '打开模组目录'),
  worlds: cachedWorlds,
  patchWorld,
  copyWorld,
  deleteWorld,
  backupWorld: (target: InstanceTargetPayload, worldId: string) =>
    call<GameOperation>('game_world_backup_create', { ...target, world_id: worldId }, '备份存档'),
  worldBackups: (target: InstanceTargetPayload, worldId: string) =>
    call<Array<{ id: string; createdAt?: string; locked: boolean; automatic: boolean; size: number }>>(
      'game_world_backup_list',
      { ...target, world_id: worldId },
      '读取存档备份'
    ),
  restoreWorldBackup: (target: InstanceTargetPayload, worldId: string, backupId: string) =>
    call<GameOperation>(
      'game_world_backup_restore',
      { ...target, world_id: worldId, backup_id: backupId },
      '恢复存档备份'
    ),
  lockWorldBackup: (target: InstanceTargetPayload, worldId: string, backupId: string, locked: boolean) =>
    call('game_world_backup_lock', { ...target, world_id: worldId, backup_id: backupId, locked }, '锁定存档备份'),
  deleteWorldBackup: (target: InstanceTargetPayload, worldId: string, backupId: string) =>
    call<void>('game_world_backup_delete', { ...target, world_id: worldId, backup_id: backupId }, '删除存档备份'),
  setWorldIcon,
  launchWorld: (target: InstanceTargetPayload, worldId: string) =>
    call('game_launch', { ...target, quick_target: { type: 'world', world_id: worldId } }, '快速进入存档'),
  importWorld,
  exportWorld: (target: InstanceTargetPayload, worldId: string, outputPath: string) =>
    call<GameOperation>('game_world_export', { ...target, world_id: worldId, output_path: outputPath }, '导出存档'),
  screenshots: cachedScreenshots,
  thumbnail: cachedThumbnail,
  copyScreenshot: (target: InstanceTargetPayload, screenshotId: string) =>
    call<void>('game_screenshot_copy', { ...target, screenshot_id: screenshotId }, '复制截图'),
  saveScreenshot: (target: InstanceTargetPayload, screenshotId: string, outputPath: string) =>
    call<{ path: string }>(
      'game_screenshot_save_as',
      { ...target, screenshot_id: screenshotId, output_path: outputPath },
      '另存截图'
    ),
  deleteScreenshot,
  setCover: (target: InstanceTargetPayload, screenshotId: string) =>
    call('game_screenshot_set_cover', { ...target, screenshot_id: screenshotId }, '设置实例封面'),
  setBackground: (target: InstanceTargetPayload, screenshotId: string) =>
    call('game_screenshot_set_background', { ...target, screenshot_id: screenshotId }, '设置启动器背景'),
  servers: cachedServers,
  saveServer,
  deleteServer,
  invalidateCache: invalidateWorkspaceCache,
  serverStatuses: (addresses: string[]) =>
    call<ServerStatus[]>('game_server_status_refresh', { addresses }, '刷新服务器状态'),
  launchServer: (target: InstanceTargetPayload, address: string) =>
    call('game_launch', { ...target, quick_target: { type: 'server', address } }, '连接服务器'),
  resources: (target: InstanceTargetPayload, resourceType: GameResourceType, worldId?: string) =>
    call<GameResource[]>(
      'game_resource_list',
      { ...target, resource_type: resourceType, world_id: worldId },
      '读取资源'
    ),
  installResources: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    sourcePaths: string[],
    worldId?: string
  ) =>
    call<GameOperation>(
      'game_resource_install',
      { ...target, resource_type: resourceType, source_paths: sourcePaths, world_id: worldId },
      '安装资源'
    ),
  toggleResource: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    resourceId: string,
    enabled: boolean,
    worldId?: string
  ) =>
    call(
      'game_resource_toggle',
      { ...target, resource_type: resourceType, resource_id: resourceId, enabled, world_id: worldId },
      '切换资源状态'
    ),
  checkResourceUpdates: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    gameVersion: string,
    loader: string,
    worldId?: string
  ) =>
    call<Array<Record<string, unknown>>>(
      'game_resource_update_check',
      { ...target, resource_type: resourceType, game_version: gameVersion, loader, world_id: worldId },
      '检查资源更新'
    ),
  updateResource: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    resourceId: string,
    update: Record<string, unknown>,
    worldId?: string
  ) =>
    call<GameOperation>(
      'game_resource_update',
      { ...target, resource_type: resourceType, resource_id: resourceId, update, world_id: worldId },
      '更新资源'
    ),
  deleteResources: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    resourceIds: string[],
    worldId?: string
  ) =>
    call<{ deleted: string[]; failed: Array<{ resourceId: string; message: string }> }>(
      'game_resource_delete',
      { ...target, resource_type: resourceType, resource_ids: resourceIds, world_id: worldId },
      '删除资源'
    ),
  exportResourceManifest: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    outputPath: string,
    outputFormat: 'json' | 'csv',
    worldId?: string
  ) =>
    call<{ path: string }>(
      'game_resource_manifest_export',
      {
        ...target,
        resource_type: resourceType,
        output_path: outputPath,
        output_format: outputFormat,
        world_id: worldId,
      },
      '导出资源清单'
    ),
  chooseResourceFiles: async (resourceType: GameResourceType) =>
    unwrapResponse(
      await backend.command('select_files', { purpose: 'resource-files', resource_type: resourceType }),
      '选择资源文件'
    ).paths,
  checkFiles: (target: InstanceTargetPayload) => call('game_instance_files_check', target, '校验实例文件'),
  repairFiles: (target: InstanceTargetPayload) =>
    call<GameOperation>('game_instance_files_repair', target, '补全实例文件'),
  deleteInstance: (target: InstanceTargetPayload) => call<void>('game_instance_delete', target, '删除实例'),
  readOptions: (target: InstanceTargetPayload) =>
    call<{ path: string; options: GameOptionEntry[]; ignoredCount: number }>(
      'game_options_read',
      target,
      '读取游戏设置'
    ),
  patchOptions: (target: InstanceTargetPayload, patch: Record<string, number | string | boolean>) =>
    call<{ path: string; updated: number }>('game_options_patch', { ...target, patch }, '保存游戏设置'),
  schematicPreview: (target: InstanceTargetPayload, resourceId: string) =>
    call<SchematicPreviewData>(
      'game_schematic_preview',
      { ...target, resource_type: 'schematic', resource_id: resourceId },
      '预览原理图'
    ),
  schematicAssets: (target: InstanceTargetPayload, blocks: string[]) =>
    call<SchematicAssetsBundle>(
      'game_schematic_assets',
      { ...target, blocks, locale: getCurrentLocale() },
      '读取原理图方块纹理'
    ),
  exportSchematicMaterialManifest: (
    target: InstanceTargetPayload,
    sessionId: string,
    outputPath: string,
    outputFormat: 'json' | 'csv',
    missingBlocks: string[]
  ) =>
    call<{ path: string }>(
      'game_schematic_material_manifest_export',
      {
        ...target,
        session_id: sessionId,
        output_path: outputPath,
        output_format: outputFormat,
        locale: getCurrentLocale(),
        missing_blocks: missingBlocks,
      },
      '导出原理图材料清单'
    ),
  schematicSessionOpen: (target: InstanceTargetPayload, resourceId: string) =>
    call<SchematicSessionData>(
      'game_schematic_session_open',
      { ...target, resource_type: 'schematic', resource_id: resourceId },
      '打开原理图分块预览'
    ),
  schematicSessionChunks: (sessionId: string, coords: [number, number, number][]) =>
    call<SchematicChunkBatch>('game_schematic_session_chunks', { session_id: sessionId, coords }, '读取原理图区块'),
  schematicSessionClose: (sessionId: string) =>
    call<{ closed: boolean }>('game_schematic_session_close', { session_id: sessionId }, '关闭原理图分块预览'),
}

export interface GameOptionEntry {
  key: string
  value: number | string | boolean
  type: 'string' | 'int' | 'float' | 'bool'
  min?: number
  max?: number
}
