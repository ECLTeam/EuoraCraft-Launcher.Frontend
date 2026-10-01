import type { GameConfig, GameRenderer } from '@/types/config'
export interface VersionSettingsTarget {
  versionId: string
  path: string
}

export type InstanceIsolationMode = 'inherit' | 'enabled' | 'disabled'
export type LauncherVisibilityMode = 'inherit' | 'none' | 'minimize' | 'quit'

export interface VersionLaunchSettings {
  schemaVersion: number
  javaMode: 'inherit' | 'auto' | 'manual'
  memoryMode: 'inherit' | 'auto' | 'manual'
  lockMemory: boolean | null
  processPriority: NonNullable<GameConfig['process_priority']> | null
  width: number | null
  height: number | null
  fullscreen: boolean | null
  renderer: GameRenderer | null
  preLaunchCommand: string | null
  preferHighPerformanceGpu: boolean | null
  useJavaExe: boolean | null
  disableCrashAnalysis: boolean | null
  commandOverrides: Array<'wrapperCommand' | 'postExitCommand' | 'envVars' | 'windowTitle'>
  isolationMode: InstanceIsolationMode
  customMemory: boolean
  memory: number
  customJava: boolean
  javaPath: string
  jvmArgs: string
  gameArgs: string
  /** 包装命令；由 commandOverrides 区分继承与显式清空。 */
  wrapperCommand: string
  /** 后退出命令；由 commandOverrides 区分继承与显式清空。 */
  postExitCommand: string
  /** 自定义环境变量；由 commandOverrides 区分继承与显式清空。 */
  envVars: string
  /** 窗口标题模板；由 commandOverrides 区分继承与显式清空。 */
  windowTitle: string
  /** 启动器可见性；inherit 表示回退全局。 */
  launcherVisibility: LauncherVisibilityMode
}

export const DEFAULT_VERSION_SETTINGS: Readonly<VersionLaunchSettings> = {
  schemaVersion: 2,
  javaMode: 'inherit',
  memoryMode: 'inherit',
  lockMemory: null,
  processPriority: null,
  width: null,
  height: null,
  fullscreen: null,
  renderer: null,
  preLaunchCommand: null,
  preferHighPerformanceGpu: null,
  useJavaExe: null,
  disableCrashAnalysis: null,
  commandOverrides: [],
  isolationMode: 'inherit',
  customMemory: false,
  memory: 4096,
  customJava: false,
  javaPath: '',
  jvmArgs: '',
  gameArgs: '',
  wrapperCommand: '',
  postExitCommand: '',
  envVars: '',
  windowTitle: '',
  launcherVisibility: 'inherit',
}

export function createDefaultVersionSettings(): VersionLaunchSettings {
  return { ...DEFAULT_VERSION_SETTINGS, commandOverrides: [] }
}

export function createVersionSettingsKey(target: VersionSettingsTarget): string {
  const normalizedPath = target.path.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return `${normalizedPath}::${target.versionId.trim()}`
}

export function normalizeVersionSettings(value: unknown): VersionLaunchSettings {
  if (!value || typeof value !== 'object') return createDefaultVersionSettings()
  const data = value as Partial<Record<keyof VersionLaunchSettings, unknown>> & { isolated?: unknown }
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > 2)
    throw new Error('实例设置来自更高版本，不能覆盖')
  const parsedMemory = Number(data.memory)
  const javaMode =
    data.javaMode === 'inherit' || data.javaMode === 'auto' || data.javaMode === 'manual'
      ? data.javaMode
      : data.customJava === true
        ? 'manual'
        : 'inherit'
  const memoryMode =
    data.memoryMode === 'inherit' || data.memoryMode === 'auto' || data.memoryMode === 'manual'
      ? data.memoryMode
      : data.customMemory === true
        ? 'manual'
        : 'inherit'
  const isolationMode: InstanceIsolationMode =
    data.isolationMode === 'enabled' || data.isolationMode === 'disabled' || data.isolationMode === 'inherit'
      ? data.isolationMode
      : data.isolated === true
        ? 'enabled'
        : data.isolated === false
          ? 'disabled'
          : 'inherit'

  return {
    ...data,
    schemaVersion: 2,
    javaMode,
    memoryMode,
    lockMemory: typeof data.lockMemory === 'boolean' ? data.lockMemory : null,
    processPriority: ['idle', 'below_normal', 'normal', 'above_normal', 'high'].includes(String(data.processPriority))
      ? (data.processPriority as VersionLaunchSettings['processPriority'])
      : null,
    width: typeof data.width === 'number' ? Math.max(320, Math.min(16384, data.width)) : null,
    height: typeof data.height === 'number' ? Math.max(240, Math.min(16384, data.height)) : null,
    fullscreen: typeof data.fullscreen === 'boolean' ? data.fullscreen : null,
    renderer: ['default', 'software', 'directx12', 'vulkan'].includes(String(data.renderer))
      ? (data.renderer as GameRenderer)
      : null,
    preLaunchCommand: typeof data.preLaunchCommand === 'string' ? data.preLaunchCommand : null,
    preferHighPerformanceGpu: typeof data.preferHighPerformanceGpu === 'boolean' ? data.preferHighPerformanceGpu : null,
    useJavaExe: typeof data.useJavaExe === 'boolean' ? data.useJavaExe : null,
    disableCrashAnalysis: typeof data.disableCrashAnalysis === 'boolean' ? data.disableCrashAnalysis : null,
    commandOverrides: Array.isArray(data.commandOverrides)
      ? data.commandOverrides.filter((key): key is VersionLaunchSettings['commandOverrides'][number] =>
          ['wrapperCommand', 'postExitCommand', 'envVars', 'windowTitle'].includes(String(key))
        )
      : (['wrapperCommand', 'postExitCommand', 'envVars', 'windowTitle'] as const).filter((key) => Boolean(data[key])),
    isolationMode,
    customMemory: memoryMode === 'manual',
    memory: Number.isFinite(parsedMemory) ? Math.min(65536, Math.max(512, Math.round(parsedMemory))) : 4096,
    customJava: javaMode === 'manual',
    javaPath: typeof data.javaPath === 'string' ? data.javaPath : '',
    jvmArgs: typeof data.jvmArgs === 'string' ? data.jvmArgs : '',
    gameArgs: typeof data.gameArgs === 'string' ? data.gameArgs : '',
    wrapperCommand: typeof data.wrapperCommand === 'string' ? data.wrapperCommand : '',
    postExitCommand: typeof data.postExitCommand === 'string' ? data.postExitCommand : '',
    envVars: typeof data.envVars === 'string' ? data.envVars : '',
    windowTitle: typeof data.windowTitle === 'string' ? data.windowTitle : '',
    launcherVisibility:
      data.launcherVisibility === 'none' || data.launcherVisibility === 'minimize' || data.launcherVisibility === 'quit'
        ? data.launcherVisibility
        : 'inherit',
  }
}

export function parseLaunchArguments(value: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaped = false
  let started = false
  const input = value.trim()

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? ''
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\') {
      started = true
      const next = input[index + 1]
      if (next && (next === '\\' || next === '"' || next === "'" || /\s/.test(next))) {
        escaped = true
      } else {
        current += character
      }
      continue
    }
    if (quote) {
      if (character === quote) quote = null
      else current += character
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      started = true
      continue
    }
    if (/\s/.test(character)) {
      if (started) {
        args.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += character
    started = true
  }

  if (quote) throw new Error('启动参数的引号未闭合')
  if (escaped) current += '\\'
  if (started) args.push(current)
  return args
}
