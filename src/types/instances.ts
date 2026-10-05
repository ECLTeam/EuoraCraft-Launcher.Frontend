export type InstallPhase = 'install' | 'download' | 'done' | 'error'
/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface JavaInstallation {
  path: string
  version: string
  major_version: number
  java_type: string
  arch: string
  sources: string[]
}

// ═══════════════════════════════════════════════════════════════════
//  Minecraft 版本
// ═══════════════════════════════════════════════════════════════════

export type MinecraftVersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha' | 'april_fools' | 'all'

export interface MinecraftVersion {
  id: string
  type: MinecraftVersionType
  releaseTime: string
  time: string
  url: string
}

export interface MinecraftVersionItem {
  id: string
  type: MinecraftVersionType
  releaseTime: string
}

export interface MinecraftVersionCatalog {
  all: MinecraftVersionItem[]
  release: MinecraftVersionItem[]
  snapshot: MinecraftVersionItem[]
  april_fools: MinecraftVersionItem[]
  old_beta: MinecraftVersionItem[]
  old_alpha: MinecraftVersionItem[]
}

export type LoaderType = 'Vanilla' | 'Forge' | 'NeoForge' | 'Fabric' | 'Quilt' | 'OptiFine'

export type InstanceExternalSource = string
export type InstanceSortKey = 'lastLaunchedAt' | 'totalRunDurationSeconds' | 'launchCount' | 'name' | 'gameVersion'

export interface InstanceIconConfig {
  type: 'builtin' | 'loader' | 'local' | 'external' | 'data'
  value: string
  source?: string
}

export interface InstanceCategory {
  id: string
  name: string
  color: string
  order: number
  builtin: boolean
}

export interface InstanceExternalSourceOption {
  source: string
  title: string
  plugin: string
}

export interface InstanceProfile {
  schemaVersion: number
  alias?: string
  description?: string
  favorite?: boolean
  pinned?: boolean
  hidden?: boolean
  categoryId?: string
  tags?: string[]
  icon?: InstanceIconConfig
  cover?: InstanceIconConfig
  pinOrder?: number
  preferredExternalSource?: InstanceExternalSource
}

export interface ScannedVersion {
  /** 后端规范目录身份，旧后端缺失时在 API 边界使用保守路径键。 */
  rootKey?: string
  instanceKey?: string
  instanceDirectoryName?: string
  minecraftVersion?: string
  id: string
  versionId: string
  /** 后端解析得到的原版版本类型，前端不再根据版本名称猜测 */
  versionType: Exclude<MinecraftVersionType, 'all'>
  path: string
  displayName: string
  primaryLoader: string
  loaderVersion?: string
  vanillaName: string
  requiredJava?: number | null
  hasForge: boolean
  hasNeoForge: boolean
  hasFabric: boolean
  hasQuilt: boolean
  hasOptiFine?: boolean
  isBroken: boolean
  jsonPath: string
  sourceName?: string
  alias?: string
  description?: string
  favorite?: boolean
  pinned?: boolean
  hidden?: boolean
  categoryId?: string
  tags?: string[]
  icon?: InstanceIconConfig
  cover?: InstanceIconConfig
  pinOrder?: number
  fieldSources?: Record<string, string>
  profileOverrides?: string[]
  preferredExternalSource?: InstanceExternalSource
  availableSources?: string[]
  externalSourceOptions?: InstanceExternalSourceOption[]
  sourceWarnings?: string[]
  launchCount?: number
  lastRunDurationSeconds?: number
  totalRunDurationSeconds?: number
  lastLaunchedAt?: string | null
}

// ═══════════════════════════════════════════════════════════════════
//  实例
// ═══════════════════════════════════════════════════════════════════

export interface GameInstance {
  id: string
  name: string
  type: string
  isRunning: boolean
  pid?: number | null
  version?: string
  versionId: string
  loader?: string | null
  gamePath: string
}

// ================================================================
//  联机
// ================================================================

export interface VersionRunStats {
  launchCount: number
  lastRunDurationSeconds: number
  totalRunDurationSeconds: number
  lastLaunchedAt?: string | null
  externalSnapshots?: Record<string, Record<string, unknown>>
}

export interface InstanceTargetPayload {
  game_path: string
  version_id: string
  version_isolation?: boolean
}

/** 兼容旧游戏 IPC 类型；生产领域使用 ApplicationOperation。 */
export type { ApplicationOperation as GameOperation } from '@/types/operations'

export interface WorldEntry {
  id: string
  name: string
  path: string
  iconPath?: string | null
  gameMode?: string
  gameModeId?: number
  difficulty?: string
  difficultyId?: number
  difficultyLocked?: boolean
  allowCommands?: boolean
  version?: string
  seed?: string
  seedEditable?: boolean
  seedError?: string | null
  spawn?: { x: number; y: number; z: number }
  weather?: { raining: boolean; thundering: boolean }
  lastPlayedAt?: string | null
  modifiedAt?: string
  createdAt?: string
  error?: string
}

export interface WorldPatch {
  difficulty?: number
  gameMode?: number
  allowCommands?: boolean
  difficultyLocked?: boolean
  raining?: boolean
  thundering?: boolean
  seed?: string
  spawn?: { x: number; y: number; z: number }
}

export interface ScreenshotEntry {
  id: string
  name: string
  path: string
  width: number
  height: number
  size: number
  modifiedAt: string
  dateGroup: string
  thumbnailUrl?: string
}

export interface ServerEntry {
  id: string
  name: string
  address: string
  icon?: string | null
  favorite: boolean
  order: number
}

export interface ServerStatus {
  address: string
  online: boolean
  latency?: number
  playersOnline?: number
  playersMax?: number
  version?: string
  protocol?: number
  motd?: string
  icon?: string | null
  error?: string
}

export type GameResourceType = 'mod' | 'resourcepack' | 'shaderpack' | 'datapack' | 'schematic'

export interface GameResource {
  id: string
  type: GameResourceType
  path: string
  name: string
  iconData?: string | null
  version?: string
  loader?: string
  enabled: boolean
  size: number
  modifiedAt: string
  sha512?: string | null
  source: string
  sourceProjectId?: string | null
  duplicateHash?: boolean
  duplicateProjectId?: boolean
  missingDependencies?: string[]
}

export type CrashConfidence = 'certain' | 'likely' | 'possible'

export interface CrashReason {
  code: string
  confidence: CrashConfidence
  evidence: string[]
  parameters: Record<string, unknown>
  /** 归因到的可疑 Mod（显示名或文件名），由 Mod 索引反查得出 */
  mods?: string[]
  /** 堆栈候选包名（未映射到 Mod 时） */
  packages?: string[]
}

export interface CrashCandidateFile {
  path: string
  name: string
  size: number
  mtime: number
}

export interface CrashAnalysisResult {
  reportId: string
  versionId: string
  exitCode?: number | null
  detectedBy: string[]
  reasons: CrashReason[]
  sourceFiles: string[]
  hasOutput: boolean
}

export interface GameInstancesChangedEvent {
  action: 'started' | 'exited' | 'stopped'
  instanceId: string
  versionId: string
  gamePath: string
}

export interface InstallVersionResult {
  taskId: string
  versionId: string
  versionName: string
}

export interface LaunchInstanceResult {
  instanceId: string
  versionId: string
  gamePath: string
}

// ═══════════════════════════════════════════════════════════════════
//  账户
// ═══════════════════════════════════════════════════════════════════

export interface InstallProgress {
  phase: InstallPhase
  task_id?: string
  /** 任务显示名（供未预先创建任务时前端自动建条目，如启动期补下载） */
  name?: string
  done?: number
  total?: number
  /** 进度模式：'bytes' 表示 done/total 为字节数，'files' 表示文件数 */
  progress_type?: 'bytes' | 'files'
  /** 下载文件总数 */
  total_files?: number
  /** 已下载文件数 */
  downloaded_files?: number
  /** 当前下载速度，字节/秒 */
  speed?: number
  message: string
  subtask?: string
  errorCode?: string
}

export type DownloadProgress = InstallProgress

export type LaunchPhase =
  | 'preparing'
  | 'account'
  | 'microsoft_token'
  | 'authlib_token'
  | 'offline_account'
  | 'account_ready'
  | 'authlib'
  | 'checking'
  | 'files_checked'
  | 'building_args'
  | 'args_built'
  | 'natives_done'
  | 'about_to_launch'
  | 'launching'
  | 'downloading'
  | 'launched'
  | 'error'

export interface LaunchProgress {
  phase: LaunchPhase
  message: string
  percent?: number
  done?: number
  total?: number
  errorCode?: string
}
