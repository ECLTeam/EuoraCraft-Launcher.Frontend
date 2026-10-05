import type { LaunchPhase, CrashAnalysisResult } from '@/types/instances'
/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface UserAgreement {
  accepted: boolean
  uuid: string
}

// ═══════════════════════════════════════════════════════════════════
//  启动器信息 / 密钥环
// ═══════════════════════════════════════════════════════════════════

export interface LauncherInfo {
  version: string
  version_type: string
  debug: boolean
  active_window_chrome?: 'custom' | 'system_shadow' | 'native'
  system_shadow_supported?: boolean
}

/** 版本检测结果：status 为 disabled=通道禁用 / up_to_date=已最新 / update_available=有新版本 / error=检测失败 */
export interface UpdateCheckResult {
  status: 'disabled' | 'up_to_date' | 'update_available' | 'error'
  current_version: string
  /** 检测通道：alpha=预发布禁用 / beta=测试版 / release=正式版 */
  channel: 'alpha' | 'beta' | 'release'
  latest_version: string | null
  latest_url: string | null
  latest_notes: string | null
  /** 检测失败等补充信息 */
  message: string | null
}

/** 启动器自动更新是否允许（打包运行且通道在 beta / rc / release 白名单内） */
export interface UpdateStatus {
  enabled: boolean
}

/** 下载并落盘更新结果 */
export interface UpdateDownloadResult {
  version: string
  target: string
  new_binary: string
  downloaded: boolean
}

/** 自动更新下载进度事件 */
export interface UpdateProgressEvent {
  phase: 'download' | 'complete'
  name: string
  received: number
  total: number
}

/** 触发重启完成更新的结果 */
export interface UpdateApplyResult {
  version: string
  restarting: boolean
}

export interface DebugMaintenanceResult {
  action: 'reset_launcher_data' | 'clear_plugins'
  restart_required: boolean
  targets: string[]
}

// ═══════════════════════════════════════════════════════════════════
//  页信息卡
// ═══════════════════════════════════════════════════════════════════

export interface InfoCardData {
  mode: InfoCardMode
  tip_title?: string
  announcement_title?: string
  tips: string[]
  announcements: InfoCardAnnouncement[]
  welcome?: InfoCardWelcome | null
  interval?: number
}

// ═══════════════════════════════════════════════════════════════════
//  文件 / 图片
// ═══════════════════════════════════════════════════════════════════

export interface FsEntry {
  name: string
  is_dir: boolean
  size: number
  mtime: number
}

export interface FileContent {
  content: string
  size: number
}

export interface PathInfo {
  exists: boolean
  is_dir: boolean
  is_file: boolean
}

// ═══════════════════════════════════════════════════════════════════
//  Mod / 资源
// ═══════════════════════════════════════════════════════════════════

export interface LaunchProgress {
  phase: LaunchPhase
  message: string
  percent?: number
  done?: number
  total?: number
  errorCode?: string
}

// ═══════════════════════════════════════════════════════════════════
//  事件映射
// ═══════════════════════════════════════════════════════════════════

export interface LauncherErrorEvent {
  error_id: string
  title: string
  message: string
  detail?: string
  kind?: 'game_crash'
  crash?: CrashAnalysisResult
}

export interface TerminalLogEntry {
  time: string
  level: string
  logger: string
  filename: string
  lineno: number
  message: string
}

// ═══════════════════════════════════════════════════════════════════
//  子进程实例
// ═══════════════════════════════════════════════════════════════════

/** 后端登记的一个子进程实例（由插件经 ProcessService 启动） */
export interface ProcessInstance {
  id: string
  name: string
  type: string
  pid: number | null
  /** 是否开启标准输入管道（可交互） */
  stdin: boolean
  running: boolean
  /** 该实例最近输出行（环形，最多 BUFFER_LIMIT 条，旧在前新在后） */
  lines: string[]
}

/** 终端会话记录，生命周期独立于后端存活进程快照。 */
export interface TerminalSession extends Omit<ProcessInstance, 'id' | 'running' | 'lines'> {
  readonly processId: string
  isRunning: boolean
  state: 'unknown' | 'running' | 'stopped'
}

/** 实时推送的某实例单行输出 */

export type LauncherPopupLevel = 'info' | 'warning' | 'critical'

/** 弹窗来源决定优先级可用区段：插件被限制在低区段，高区段保留给启动器。 */
export type LauncherPopupSource = 'launcher' | 'plugin'

export interface LauncherPopupEvent {
  id: string
  title: string
  content: string
  level?: LauncherPopupLevel
  dismissible?: boolean
  cacheable?: boolean
  /** 显示优先级，数值越大越先展示；插件来源会被钳制到低区段。 */
  priority?: number
  /** 事件来源，插件事件无法占用启动器保留的高优先级区段。 */
  source?: LauncherPopupSource
  /** 严重错误事件的扩展字段（由错误弹窗渲染），普通公告无需提供。 */
  errorId?: string
  detail?: string
  kind?: 'game_crash'
  crash?: CrashAnalysisResult
  /** @deprecated 使用 cacheable；保留用于兼容已有后端事件。 */
  once?: boolean
}

export type InfoCardMode = 'auto' | 'rotate' | 'announcement_first' | 'tip_only' | 'announcement_only'

export interface InfoCardAnnouncement {
  id?: string
  title: string
  date: string
  content: string
  locales?: Record<string, InfoCardAnnouncementTranslation>
}

export interface InfoCardAnnouncementTranslation {
  title: string
  content: string
}

export interface InfoCardWelcome {
  title: string
  content: string
  imageUrl?: string
}
export interface ImageSaveAsPayload {
  data_url?: string
  url?: string
  path?: string
}

export interface ProcessLogEntry {
  instanceId: string
  name: string
  type: string
  line: string
}
