/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface PluginInfo {
  name: string
  title: string
  version: string
  description: string
  author: string
  icon: string
  status: string
  pending_restart?: boolean
  installed_version?: string
  error: string | null
  dependencies: Record<string, string>
  contributes?: {
    themeNodes?: Array<string | Record<string, unknown>>
    windows?: Array<Record<string, unknown>>
  }
  services: string[]
  settings?: PluginSettingSchema[]
  is_system: boolean
}

export interface PluginPackagePreflight {
  package: {
    name: string
    version: string
    manifest_sha256: string
    file_count: number
    total_uncompressed_bytes: number
  }
  target_tag: string
  python_dependencies: string[]
  wheel_count: number
  has_target_lock: boolean
  unverified_source: boolean
  dependencies_ready: boolean
}

export interface PluginPackageInstallResult {
  status: string
  message?: string
}

export interface PluginPackageSelection {
  path: string
  preflight: PluginPackagePreflight
}

export interface PluginRoute {
  plugin: string
  path: string
  title: string
  icon?: string
}

export interface PluginSlotItem {
  plugin: string
  html: string
  key?: string
  priority?: number
  contextKey?: string
}

export interface VueSlotItem {
  plugin: string
  component_name: string
  template: string
  script: string
  style: string
  contextKey?: string
}

export interface VueComponentDef {
  plugin: string
  template: string
  script: string
  style: string
}

export interface PluginSettingsData {
  schema: PluginSettingSchema[]
  values: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════════
//  进度事件
// ═══════════════════════════════════════════════════════════════════

export interface PluginDependency {
  name: string
  version: string
}
export interface PluginSettingSchema {
  key: string
  default: unknown
  description: string
  type: 'bool' | 'string' | 'number' | 'select'
}
