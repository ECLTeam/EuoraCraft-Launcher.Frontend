import type { InstanceSortKey } from '@/types/instances'

export interface ConnectorConfig {
  mode: 'automatic' | 'append' | 'custom'
  nodes: string[]
}
/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface LauncherConfig {
  debug?: boolean
  /** 控制台日志最低级别，与 debug 模式相互独立 */
  debug_log_level?: 'debug' | 'info' | 'warning' | 'error'
  /** 由 ECL_CONFIG_launcher_showcase 环境变量控制，启用后使用 mock 数据替代真实后端 */
  showcase?: boolean
  disable_ssl_verify?: boolean
  /** 启动器通道代理模式（账户登录、元数据等）：none=直连 / system=系统代理 / custom=自定义代理 */
  api_proxy_mode?: 'none' | 'system' | 'custom'
  /** 启动器通道自定义代理地址（api_proxy_mode 为 custom 时生效），需含协议前缀 */
  api_proxy_url?: string
  /** 下载通道代理模式（游戏文件、Mod 与资源包下载）：none=直连 / system=系统代理 / custom=自定义代理 */
  proxy_mode?: 'none' | 'system' | 'custom'
  /** 下载通道自定义代理地址（proxy_mode 为 custom 时生效），需含协议前缀 */
  proxy_url?: string
  /** 单次网络请求的总超时秒数 */
  request_timeout?: number
  /** 首次请求失败后允许的额外重试次数 */
  request_retries?: number
}

export interface BackgroundConfig {
  /** 当前生效的背景分支；缺省时兼容旧版图片配置。 */
  media_type?: 'image' | 'video'
  /** 图片与视频共用的显示强度。 */
  opacity?: number
  blur?: number
  /** 图片背景的独立持久化分支。 */
  image?: BackgroundImageConfig
  /** 视频背景的独立持久化分支。 */
  video?: BackgroundVideoSource

  /** 以下扁平字段仅用于读取旧版配置，写入时迁移到 image/video 分支。 */
  type?: 'default' | 'none' | 'custom' | 'local' | 'url' | 'gradient'
  path?: string
  image_base64?: string
  mode?: 'single' | 'carousel' | 'random'
  interval?: number
  /** URL 轮播/随机模式下的图片地址列表 */
  urls?: string[]
  poster_path?: string
}

export interface BackgroundImageConfig {
  type?: 'default' | 'none' | 'custom' | 'local' | 'url' | 'gradient'
  path?: string
  image_base64?: string
  mode?: 'single' | 'carousel' | 'random'
  interval?: number
  urls?: string[]
}

export interface BackgroundVideoSource {
  path?: string
  poster_path?: string
  options?: BackgroundVideoConfig
}

export interface BackgroundVideoConfig {
  paused?: boolean
  muted?: boolean
  volume?: number
  fit?: 'cover' | 'contain'
  pause_when_inactive?: boolean
}

export type MinecraftPathEntry = string | { name: string; path: string; protected?: boolean }
export type InstanceIsolationPolicy = 'disabled' | 'modded_only' | 'non_release_only' | 'modded_or_non_release' | 'all'
export type GameRenderer = 'default' | 'software' | 'directx12' | 'vulkan'

export interface GameConfig {
  minecraft_paths: MinecraftPathEntry[]
  java_auto?: boolean
  java_path?: string
  memory_auto?: boolean
  memory_size?: number
  /** 是否锁定 JVM 初始堆与最大堆一致（-Xms=-Xmx），减少游戏运行中堆的反复扩容与收缩 */
  lock_memory?: boolean
  /** 游戏进程优先级：idle 最低，high 最高 */
  process_priority?: 'idle' | 'below_normal' | 'normal' | 'above_normal' | 'high'
  game_width?: number
  game_height?: number
  jvm_args?: string[]
  /** Windows 下使用的 Mesa 兼容渲染后端。 */
  renderer?: GameRenderer
  fullscreen?: boolean
  /** 实例未设置覆盖时使用的游戏目录隔离策略。 */
  instance_isolation_policy?: InstanceIsolationPolicy
  /** 在 Minecraft 原始游戏参数后追加的全局参数文本。 */
  game_args_tail?: string
  /** 创建 Minecraft 进程前执行的全局命令。 */
  pre_launch_command?: string
  /** 包裹 java 命令的全局包装命令；含 {} 占位符时替换为完整命令，否则前缀拼接。 */
  wrapper_command?: string
  /** 游戏进程退出后执行的全局命令。 */
  post_exit_command?: string
  /** 传给游戏进程的自定义环境变量（多行 KEY=VALUE）。 */
  env_vars?: string
  /** 游戏窗口标题模板，支持 {instance}/{version}/{account} 占位符。 */
  window_title_template?: string
  /** 游戏启动成功后的启动器行为。 */
  launcher_visibility?: 'none' | 'minimize' | 'quit'
  /** Windows 下将 Java 可执行文件登记为高性能 GPU 偏好。 */
  prefer_high_performance_gpu?: boolean
  /** Windows 下优先使用 java.exe 而不是 javaw.exe。 */
  use_java_exe?: boolean
  /** 是否禁止异常退出后的自动崩溃报告分析。 */
  disable_crash_analysis?: boolean
  last_install_path?: string
  last_manage_path?: string
  /** 当前激活的游戏路径（用于确定启动哪个路径下的实例） */
  active_path?: string
  /** 手动指定 Qomicex instances.json；为空时由后端自动探测。 */
  qomicex_instances_path?: string
}

/**
 * 实例路径下的 ecl.json 结构。
 * 每个 .minecraft 根目录存放一个，记录该路径下的启动实例等信息。
 */
export interface EclPathConfig {
  /** 当前路径下选中的启动实例 ID */
  activeVersion?: string
  /** 兼容旧版/别名 */
  active_version?: string
  [key: string]: unknown
}

export interface SystemMemoryInfo {
  totalMb: number
  usedMb: number
  freeMb: number
  percentUsed: number
}

export interface ThemeAppearanceConfig {
  /** 启动器窗口圆角（px） */
  radius_window?: number
  /** 卡片圆角（px） */
  radius_card?: number
  /** 控件圆角（px） */
  radius_control?: number
  /** 对话框圆角（px） */
  radius_dialog?: number
  /** 卡片不透明度（0-100） */
  card_opacity?: number
  /** 界面字体族（预设 CSS 字体栈或本机字体名称） */
  font_family?: string
  /** 侧边栏字体，空值表示跟随界面 */
  sidebar_font_family?: string
  /** 实例终端字体，空值表示原有等宽字体栈 */
  terminal_font_family?: string
  /** 启动器日志字体，空值表示原有等宽字体栈 */
  log_font_family?: string
}

export interface ThemeScheduleConfig {
  enabled?: boolean
  /** 进入深色时间 'HH:MM' */
  dark_start?: string
  /** 离开深色时间 'HH:MM' */
  dark_end?: string
}

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system'
  /** 内置皮肤：classic（经典）或 folia（花叶）。 */
  theme_id?: 'classic' | 'folia'
  primary_color: string
  blur_amount: number
  sidebar_collapsed: boolean
  navigation_mode?: NavigationMode
  /** 主窗口装饰模式，保存后下次启动生效。 */
  window_chrome?: 'custom' | 'system_shadow' | 'native'
  /** @deprecated 兼容旧配置；true 对应 sidebar，false 对应 top。 */
  titlebar_hidden: boolean
  transparent_bg: boolean
  background_opacity?: number
  appearance?: ThemeAppearanceConfig
  schedule?: ThemeScheduleConfig
}

export interface WindowBounds {
  x?: number
  y?: number
  width?: number
  height?: number
  monitor?: string
}

export interface WindowMetadata {
  label: string
  descriptorId: string
  windowType: 'main' | 'plugin' | string
  plugin?: string | null
  sessionId?: string | null
  singleton: boolean
  followMain: boolean
  dataSchema: { read?: string[]; write?: string[] }
  ready: boolean
  bounds?: WindowBounds
}

export type NavigationMode = 'sidebar' | 'top'

export interface DownloadConfig {
  mirror_source: 'official' | 'bmclapi'
  /** 按资源类型记忆的「上一次安装实例」缓存：key 为资源类型(mod/resourcepack/shaderpack/datapack/world) */
  resourceInstallCache?: Record<string, { gamePath: string; versionId: string }>
  /** 按资源类型记忆的「另存为」目录。 */
  resourceSaveDirectories?: Record<string, string>
}

export interface LocaleConfig {
  locale: string
}

export interface UiConfig {
  locale?: string
  debug?: boolean
  flowDebug?: boolean
  theme?: Partial<ThemeConfig>
  background?: Partial<BackgroundConfig>
  windows?: Record<string, WindowBounds>
  instanceManager?: {
    viewMode?: 'card' | 'list'
    sortKey?: InstanceSortKey
    sortDirection?: 'asc' | 'desc'
  }
}

export type ConfigSection = 'launcher' | 'game' | 'download' | 'ui' | 'locale' | 'background' | string

// ═══════════════════════════════════════════════════════════════════
//  Java
// ═══════════════════════════════════════════════════════════════════
