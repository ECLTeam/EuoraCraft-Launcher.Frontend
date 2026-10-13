import backend from '@/api/client'
import { invalidateResource, readResource } from '@/app/data/refreshCoordinator'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { parseWorlds, parseScreenshots, parseServers } from '@/features/instances/model/workspaceSnapshots'
import { getCurrentLocale } from '@/i18n'
import type { CommandPayloadMap, CommandResponseMap } from '@/types/api'
import type {
  GameOperation,
  GameResourceType,
  InstanceTargetPayload,
  ScannedVersion,
  ScreenshotEntry,
  ServerEntry,
  WorldEntry,
  WorldPatch,
} from '@/types/instances'
import { gamePathIdentity } from '@/utils/path'
export function workspaceTarget(version: ScannedVersion, versionIsolation?: boolean): InstanceTargetPayload {
  const target = { game_path: version.path, version_id: version.versionId }
  return versionIsolation === undefined ? target : { ...target, version_isolation: versionIsolation }
}

const call = async <K extends keyof CommandPayloadMap>(
  name: K,
  payload: CommandPayloadMap[K],
  message: string
): Promise<CommandResponseMap[K]> => unwrapResponse(await backend.command(name, payload), message)

type WorkspaceCacheSection = 'worlds' | 'screenshots' | 'servers' | 'mods' | 'resources'

function workspacePrefix(target: InstanceTargetPayload) {
  return [
    'workspace',
    gamePathIdentity(target.game_path),
    target.version_id,
    target.version_isolation ?? 'default',
  ] as const
}

function workspaceRead<T>(
  target: InstanceTargetPayload,
  section: WorkspaceCacheSection,
  load: () => Promise<T>,
  detail: readonly unknown[] = [],
  staleTime = Infinity
): Promise<T> {
  return readResource({ queryKey: [...workspacePrefix(target), section, ...detail], staleTime, load })
}

function cachedThumbnail(target: InstanceTargetPayload, screenshotId: string): Promise<{ path: string }> {
  return workspaceRead(
    target,
    'screenshots',
    () => call('game_screenshot_thumbnail', { ...target, screenshot_id: screenshotId }, '生成截图缩略图'),
    ['thumbnail', screenshotId]
  )
}

function invalidateWorkspaceCache(target: InstanceTargetPayload, section?: WorkspaceCacheSection): void {
  void invalidateResource(section ? [...workspacePrefix(target), section] : workspacePrefix(target), false)
}

function cachedWorlds(target: InstanceTargetPayload): Promise<WorldEntry[]> {
  return workspaceRead(target, 'worlds', async () => parseWorlds(await call('game_world_list', target, '读取存档')))
}

async function patchWorld(target: InstanceTargetPayload, worldId: string, patch: WorldPatch): Promise<WorldEntry> {
  const world = await call('game_world_patch', { ...target, world_id: worldId, patch }, '修改存档')
  invalidateWorkspaceCache(target, 'worlds')
  return world
}

async function copyWorld(target: InstanceTargetPayload, worldId: string, newWorldId: string): Promise<GameOperation> {
  const operation = await call(
    'game_world_copy',
    { ...target, world_id: worldId, new_world_id: newWorldId },
    '复制存档'
  )
  return operation
}

async function deleteWorld(target: InstanceTargetPayload, worldId: string): Promise<void> {
  await call('game_world_delete', { ...target, world_id: worldId }, '删除存档')
  invalidateWorkspaceCache(target, 'worlds')
}

async function setWorldIcon(
  target: InstanceTargetPayload,
  worldId: string,
  sourcePath: string
): Promise<{ path: string }> {
  const result = await call(
    'game_world_icon_set',
    { ...target, world_id: worldId, source_path: sourcePath },
    '设置世界图标'
  )
  invalidateWorkspaceCache(target, 'worlds')
  return result
}

async function importWorld(target: InstanceTargetPayload, sourcePath: string): Promise<GameOperation> {
  const operation = await call('game_world_import', { ...target, source_path: sourcePath }, '导入存档')
  return operation
}

function cachedScreenshots(target: InstanceTargetPayload): Promise<ScreenshotEntry[]> {
  return workspaceRead(target, 'screenshots', async () =>
    parseScreenshots(await call('game_screenshot_list', target, '读取截图'))
  )
}

async function deleteScreenshot(target: InstanceTargetPayload, screenshotId: string): Promise<void> {
  await call('game_screenshot_delete', { ...target, screenshot_id: screenshotId }, '删除截图')
  invalidateWorkspaceCache(target, 'screenshots')
}

function cachedServers(target: InstanceTargetPayload): Promise<ServerEntry[]> {
  return workspaceRead(target, 'servers', async () =>
    parseServers(await call('game_server_list', target, '读取服务器'))
  )
}

async function saveServer(
  target: InstanceTargetPayload,
  server: Partial<ServerEntry> & Pick<ServerEntry, 'name' | 'address'>
): Promise<ServerEntry> {
  const result = await call(
    'game_server_upsert',
    { ...target, server_id: server.id, name: server.name, address: server.address, favorite: server.favorite },
    '保存服务器'
  )
  invalidateWorkspaceCache(target, 'servers')
  return result
}

async function deleteServer(target: InstanceTargetPayload, serverId: string): Promise<void> {
  await call('game_server_delete', { ...target, server_id: serverId }, '删除服务器')
  invalidateWorkspaceCache(target, 'servers')
}

export const instanceWorkspaceApi = {
  folders: (
    target: InstanceTargetPayload,
    folder: 'instance' | 'mods' | 'saves' | 'screenshots' | 'logs' | 'crash-reports'
  ) => call('game_instance_folder_open', { ...target, folder }, '打开实例目录'),
  mods: (target: InstanceTargetPayload) =>
    workspaceRead(target, 'mods', () => call('game_instance_mods_list', target, '获取模组列表'), [], 0),
  toggleMod: (target: InstanceTargetPayload, filename: string) =>
    call('game_instance_mod_toggle', { ...target, filename }, '切换模组'),
  addMod: (target: InstanceTargetPayload, sourcePath: string) =>
    call('game_instance_mod_add', { ...target, source_path: sourcePath }, '添加模组'),
  removeMod: (target: InstanceTargetPayload, filename: string) =>
    call('game_instance_mod_remove', { ...target, filename }, '删除模组'),
  modsFolder: (target: InstanceTargetPayload) => call('game_instance_mods_folder_open', target, '打开模组目录'),
  worlds: cachedWorlds,
  patchWorld,
  copyWorld,
  deleteWorld,
  backupWorld: (target: InstanceTargetPayload, worldId: string) =>
    call('game_world_backup_create', { ...target, world_id: worldId }, '备份存档'),
  worldBackups: (target: InstanceTargetPayload, worldId: string) =>
    call('game_world_backup_list', { ...target, world_id: worldId }, '读取存档备份'),
  restoreWorldBackup: (target: InstanceTargetPayload, worldId: string, backupId: string) =>
    call('game_world_backup_restore', { ...target, world_id: worldId, backup_id: backupId }, '恢复存档备份'),
  lockWorldBackup: (target: InstanceTargetPayload, worldId: string, backupId: string, locked: boolean) =>
    call('game_world_backup_lock', { ...target, world_id: worldId, backup_id: backupId, locked }, '锁定存档备份'),
  deleteWorldBackup: (target: InstanceTargetPayload, worldId: string, backupId: string) =>
    call('game_world_backup_delete', { ...target, world_id: worldId, backup_id: backupId }, '删除存档备份'),
  setWorldIcon,
  launchWorld: (target: InstanceTargetPayload, worldId: string) =>
    call('game_launch', { ...target, quick_target: { type: 'world', world_id: worldId } }, '快速进入存档'),
  importWorld,
  exportWorld: (target: InstanceTargetPayload, worldId: string, outputPath: string) =>
    call('game_world_export', { ...target, world_id: worldId, output_path: outputPath }, '导出存档'),
  screenshots: cachedScreenshots,
  thumbnail: cachedThumbnail,
  copyScreenshot: (target: InstanceTargetPayload, screenshotId: string) =>
    call('game_screenshot_copy', { ...target, screenshot_id: screenshotId }, '复制截图'),
  saveScreenshot: (target: InstanceTargetPayload, screenshotId: string, outputPath: string) =>
    call('game_screenshot_save_as', { ...target, screenshot_id: screenshotId, output_path: outputPath }, '另存截图'),
  deleteScreenshot,
  setCover: (target: InstanceTargetPayload, screenshotId: string) =>
    call('game_screenshot_set_cover', { ...target, screenshot_id: screenshotId }, '设置实例封面'),
  setBackground: (target: InstanceTargetPayload, screenshotId: string) =>
    call('game_screenshot_set_background', { ...target, screenshot_id: screenshotId }, '设置启动器背景'),
  servers: cachedServers,
  saveServer,
  deleteServer,
  invalidateCache: invalidateWorkspaceCache,
  serverStatuses: (addresses: string[]) => call('game_server_status_refresh', { addresses }, '刷新服务器状态'),
  launchServer: async (target: InstanceTargetPayload, address: string): Promise<void> => {
    await call('game_launch', { ...target, quick_target: { type: 'server', address } }, '连接服务器')
  },
  resources: (target: InstanceTargetPayload, resourceType: GameResourceType, worldId?: string) =>
    workspaceRead(
      target,
      'resources',
      () => call('game_resource_list', { ...target, resource_type: resourceType, world_id: worldId }, '读取资源'),
      [resourceType, worldId ?? null],
      0
    ),
  installResources: (
    target: InstanceTargetPayload,
    resourceType: GameResourceType,
    sourcePaths: string[],
    worldId?: string
  ) =>
    call(
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
    call(
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
    call(
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
    call(
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
    call(
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
  repairFiles: (target: InstanceTargetPayload) => call('game_instance_files_repair', target, '补全实例文件'),
  deleteInstance: (target: InstanceTargetPayload) => call('game_instance_delete', target, '删除实例'),
  readOptions: (target: InstanceTargetPayload) => call('game_options_read', target, '读取游戏设置'),
  patchOptions: (target: InstanceTargetPayload, patch: Record<string, number | string | boolean>) =>
    call('game_options_patch', { ...target, patch }, '保存游戏设置'),
  schematicPreview: (target: InstanceTargetPayload, resourceId: string) =>
    call('game_schematic_preview', { ...target, resource_type: 'schematic', resource_id: resourceId }, '预览原理图'),
  schematicAssets: (target: InstanceTargetPayload, blocks: string[]) =>
    call('game_schematic_assets', { ...target, blocks, locale: getCurrentLocale() }, '读取原理图方块纹理'),
  exportSchematicMaterialManifest: (
    target: InstanceTargetPayload,
    sessionId: string,
    outputPath: string,
    outputFormat: 'json' | 'csv',
    missingBlocks: string[]
  ) =>
    call(
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
    call(
      'game_schematic_session_open',
      { ...target, resource_type: 'schematic', resource_id: resourceId },
      '打开原理图分块预览'
    ),
  schematicSessionChunks: (sessionId: string, coords: [number, number, number][]) =>
    call('game_schematic_session_chunks', { session_id: sessionId, coords }, '读取原理图区块'),
  schematicSessionClose: (sessionId: string) =>
    call('game_schematic_session_close', { session_id: sessionId }, '关闭原理图分块预览'),
}

export interface GameOptionEntry {
  key: string
  value: number | string | boolean
  type: 'string' | 'int' | 'float' | 'bool'
  min?: number
  max?: number
}
