/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface PluginInfo {
  name: string
  installation_id?: string
  content_digest?: string
  cleanup_state?: string
  source?: 'directory' | 'package'
  supports_hot_reload?: boolean
  development?: PluginDevelopmentItem | null
  title: string
  version: string
  description: string
  author: string
  homepage: string
  license: string
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
  /** 当前运行是否登记了声明式面板，由后端 plugin_list 回填；禁用或未启用时为 false。 */
  has_panels: boolean
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

export interface PluginDirectoryPreflight {
  name: string
  version: string
  entry_point: string
  source_path: string
  target_tag: string
  python_dependencies: string[]
  wheel_count: number
  has_target_lock: boolean
  dependencies_ready: boolean
}

export interface PluginDirectorySelection {
  path: string
  preflight: PluginDirectoryPreflight
}

export interface PluginPackageSelection {
  path: string
  preflight: PluginPackagePreflight
}

export interface PluginPageNav {
  path: string
  label_key: string
  icon: string
  order?: number
}

export interface PluginRoute {
  locales?: string[]
  plugin: string
  path: string
  title: string
  icon?: string
  container?: 'top' | 'more'
  nav?: PluginPageNav
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
  revision?: number
  schema: PluginSettingSchema[]
  values: Record<string, unknown>
  installation_id?: string
  content_digest?: string
  schema_revision?: string | null
  editable?: boolean
  reason?: string | null
}

export interface PluginDevelopmentItem {
  name: string
  status: (typeof pluginDevelopmentStatuses)[number]
  error_code: string | null
  reload_count: number
  supports_hot_reload: boolean
}

export const pluginDevelopmentStatuses = [
  'preparing',
  'reloading',
  'watching',
  'opted_out',
  'review_required',
  'cleanup_pending',
  'failed',
  'disabled',
] as const

export interface PluginDevelopmentState {
  enabled: boolean
  items: PluginDevelopmentItem[]
}

export type PluginPanelTone = 'default' | 'primary' | 'danger'

export interface PluginPanelTextNode {
  type: 'text'
  text: string
  tone?: 'default' | 'muted' | 'warning'
}

export interface PluginPanelGroupNode {
  type: 'group'
  title?: string
  children: PluginPanelNode[]
}

export interface PluginPanelButtonNode {
  type: 'button'
  label: string
  command: string
  args?: Record<string, string | number | boolean>
  tone?: PluginPanelTone
  confirm?: string
}

export interface PluginPanelSettingNode {
  type: 'setting'
  key: string
}

export interface PluginPanelListNode {
  type: 'list'
  source: string
  columns: Array<{ key: string; label: string }>
  empty_text?: string
}

export interface PluginPanelTaskNode {
  type: 'task'
  source: string
}

export type PluginPanelNode =
  | PluginPanelTextNode
  | PluginPanelGroupNode
  | PluginPanelButtonNode
  | PluginPanelSettingNode
  | PluginPanelListNode
  | PluginPanelTaskNode

export interface PluginPanelDefinition {
  key: string
  title: string
  description?: string
  nodes: PluginPanelNode[]
}

export type PluginPanelTaskState = 'pending' | 'running' | 'succeeded' | 'failed'

export interface PluginPanelTask {
  state: PluginPanelTaskState
  percent: number
  detail?: string
}

export interface PluginPanelData {
  lists: Record<string, Array<Record<string, string>>>
  tasks: Record<string, PluginPanelTask>
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
  options?: string[]
  default: unknown
  description: string
  type: 'bool' | 'string' | 'text' | 'number' | 'select' | 'readonly_file'
}

export interface PluginRuntimeInfo {
  installation_id: string
  run_id: string
  run_state: string
  pid: number | null
  cleanup_state: string
  last_error: { code: string; message: string } | null
}
