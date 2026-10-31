// ============================================================
// 游戏相关配置
// 启动阶段、进度映射、默认值等
// ============================================================

import type { LaunchPhase } from '@/types/instances'

// ---- 启动阶段文案 ----

export const LAUNCH_STAGES = {
  prepare: '准备启动...',
  preparing: '正在准备...',
  account: '验证游戏账户...',
  refreshing_microsoft_token: '刷新正版登录令牌...',
  validating_authlib_token: '刷新外置登录令牌...',
  loading_offline_account: '读取离线账户...',
  account_ready: '登录凭据已就绪',
  preparing_authlib: '准备外置登录组件...',
  checking_files: '检查游戏文件完整性...',
  files_checked: '文件校验完成',
  completing_files: '补全缺失文件...',
  downloading_assets: '下载游戏资源...',
  building_params: '构建启动参数...',
  args_built: '参数构建完成',
  extracting_natives: '解压原生库...',
  natives_done: '原生库解压完成',
  about_to_launch: '即将启动...',
  launching: '启动游戏进程...',
  completed: '启动成功！',
  launched: '启动成功！',
  success: '启动成功！',
  error: '启动失败',
} as const

// ---- 启动进度百分比映射 ----

export const LAUNCH_PROGRESS: Partial<Record<LaunchPhase, number>> = {
  preparing: 3,
  account: 7,
  microsoft_token: 7,
  authlib_token: 7,
  offline_account: 7,
  account_ready: 17,
  authlib: 20,
  checking: 25,
  files_checked: 55,
  building_args: 72,
  args_built: 84,
  natives_done: 90,
  about_to_launch: 94,
  launching: 97,
}

// ---- 延迟/超时 ----

/** 非终止阶段的平滑进度速度参考时长 (ms)，不会延迟实际启动完成。 */
export const LAUNCH_MIN_PROGRESS_DURATION = 5000
/** 启动成功后关闭进度面板的延迟 (ms) */
export const LAUNCH_SUCCESS_HIDE_DELAY = 500
/** 启动失败后关闭进度面板的延迟 (ms) */
export const LAUNCH_ERROR_HIDE_DELAY = 2000
/** 上一次启动仍在退出时，重新启动的重试间隔 (ms) */
export const LAUNCH_BUSY_RETRY_DELAY = 700
/** 上一次启动仍在退出时，重新启动的最大重试次数 */
export const LAUNCH_BUSY_RETRY_LIMIT = 3
/** 取消启动后忽略启动点击的时间窗口 (ms)，避免连点同一位置误触发新启动 */
export const LAUNCH_CANCEL_GUARD_DELAY = 600
/** 状态消息自动消失时间 (ms) */
export const STATUS_MESSAGE_AUTO_HIDE = 5000

// ---- 内存默认值 ----

/** 内存滑块最小值 (MB) */
export const MEMORY_MIN = 1024
/** 内存滑块步长 (MB) */
export const MEMORY_STEP = 256
/** 自动内存默认值 (MB) */
export const AUTO_MEMORY_DEFAULT = 4096
/** 安全内存最小值 (MB) */
export const SAFE_MEMORY_MIN = 1024
/** 系统内存使用比例上限 */
export const MEMORY_MAX_RATIO = 0.8

// ---- 版本设置默认值 ----

export const DEFAULT_VERSION_SETTINGS = {
  isolationMode: 'inherit',
  customMemory: false,
  memory: 4096,
  customJava: false,
  javaPath: '',
  jvmArgs: '',
  gameArgs: '',
}

// ---- 虚拟滚动 ----

export const VERSION_LIST_ITEM_HEIGHT = 56
export const VERSION_LIST_BUFFER_SIZE = 5
export const VERSION_LIST_CACHE_TTL = 10 * 60 * 1000

// ---- 加载器版本列表截取上限 ----

export const LOADER_VERSION_LIST_LIMIT = 20
