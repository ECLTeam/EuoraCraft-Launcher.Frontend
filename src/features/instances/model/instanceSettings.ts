export interface VersionSettingsTarget {
  versionId: string
  path: string
}

export type InstanceIsolationMode = 'inherit' | 'enabled' | 'disabled'
export type LauncherVisibilityMode = 'inherit' | 'none' | 'minimize' | 'quit'

export interface VersionLaunchSettings {
  isolationMode: InstanceIsolationMode
  customMemory: boolean
  memory: number
  customJava: boolean
  javaPath: string
  jvmArgs: string
  gameArgs: string
  /** 包装命令；留空回退全局。 */
  wrapperCommand: string
  /** 后退出命令；留空回退全局。 */
  postExitCommand: string
  /** 自定义环境变量；留空回退全局。 */
  envVars: string
  /** 窗口标题模板；留空回退全局。 */
  windowTitle: string
  /** 启动器可见性；inherit 表示回退全局。 */
  launcherVisibility: LauncherVisibilityMode
}

export const DEFAULT_VERSION_SETTINGS: Readonly<VersionLaunchSettings> = {
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
  return { ...DEFAULT_VERSION_SETTINGS }
}

export function createVersionSettingsKey(target: VersionSettingsTarget): string {
  const normalizedPath = target.path.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return `${normalizedPath}::${target.versionId.trim()}`
}

export function normalizeVersionSettings(value: unknown): VersionLaunchSettings {
  if (!value || typeof value !== 'object') return createDefaultVersionSettings()
  const data = value as Partial<Record<keyof VersionLaunchSettings, unknown>> & { isolated?: unknown }
  const parsedMemory = Number(data.memory)
  const isolationMode: InstanceIsolationMode =
    data.isolationMode === 'enabled' || data.isolationMode === 'disabled' || data.isolationMode === 'inherit'
      ? data.isolationMode
      : data.isolated === true
        ? 'enabled'
        : data.isolated === false
          ? 'disabled'
          : 'inherit'

  return {
    isolationMode,
    customMemory: data.customMemory === true,
    memory: Number.isFinite(parsedMemory) ? Math.min(65536, Math.max(512, Math.round(parsedMemory))) : 4096,
    customJava: data.customJava === true,
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
  const input = value.trim()

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? ''
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\') {
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
      continue
    }
    if (/\s/.test(character)) {
      if (current) {
        args.push(current)
        current = ''
      }
      continue
    }
    current += character
  }

  if (escaped) current += '\\'
  if (current) args.push(current)
  return args
}
