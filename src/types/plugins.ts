/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface PluginInfo {
  name: string
  installation_id?: string
  content_digest?: string
  review_required?: boolean
  requested_permissions?: PluginBusinessCapability[]
  required_satisfied?: boolean
  cleanup_state?: string
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
  revision?: number
  schema: PluginSettingSchema[]
  values: Record<string, unknown>
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
  type: 'bool' | 'string' | 'number' | 'select'
}

export interface PluginPermissionItem {
  capability: string
  required: boolean
  decision: 'allow' | 'deny'
  resource_refs: string[]
  selected_resource_refs: string[]
  requested_resource_refs: string[]
  implemented: boolean
  expires_at: number | null
  grant_epoch: number
}

export interface PluginPermissions {
  installation_id: string
  content_digest: string
  revision: number
  grant_epoch: number
  required_satisfied: boolean
  error_code: string | null
  items: PluginPermissionItem[]
}

export interface PluginPermissionDecision {
  capability: string
  resource_refs: string[]
  decision: 'allow' | 'deny'
  lifetime: 'session' | 'permanent'
}

export interface PluginPermissionUpdateResult {
  revision: number
  grant_epoch: number
  persisted: boolean
  required_satisfied: boolean
  cleanup_state: string
}

export interface PluginRuntimeInfo {
  installation_id: string
  run_id: string
  run_state: string
  pid: number | null
  cleanup_state: string
  last_error: { code: string; message: string } | null
}

interface PluginResourceFields {
  resource_id: string
  label: string
  available: boolean
  selected: boolean
  is_default: boolean
}

export type PluginResourceCandidate = PluginResourceFields &
  (
    | { kind: 'instance_root' | 'instance'; parent_ref: string | null; version_id: string | null }
    | { kind: 'java_runtime' | 'account'; parent_ref: null; version_id: null }
  )

export interface PluginResourcePage {
  catalog_revision: number
  items: PluginResourceCandidate[]
  next_cursor: string | null
}

export type PluginInstanceCapability = 'instances.read' | 'instances.manage'
export const pluginBusinessCapabilities = [
  'instances.read',
  'instances.manage',
  'network.read',
  'java.read',
  'java.use',
  'java.catalog.read',
  'java.install',
  'accounts.read',
] as const
export type PluginBusinessCapability = (typeof pluginBusinessCapabilities)[number]

export interface PluginResourceQuery {
  installation_id: string
  content_digest: string
  capability: PluginInstanceCapability | 'java.read' | 'java.use' | 'accounts.read'
  parent_ref?: string | null
  search?: string
  cursor?: string | null
  limit?: number
}
export type PluginFileRecoveryAction = 'restore' | 'save_as' | 'discard'

export interface PluginFileRecovery {
  recovery_ref: string
  name: string
  revision: number
  etag: string
  state: 'pending' | 'conflict' | 'cleanup' | 'invalid'
  actions: PluginFileRecoveryAction[]
}

export interface PluginFileRecoveryPage {
  items: PluginFileRecovery[]
  next_cursor: string | null
}

export interface PluginFileRecoveryChoice {
  recovery_ref: string
  expected_revision: number
  expected_etag: string
  action: PluginFileRecoveryAction
  saved_name?: string
}

export interface PluginInstanceProfileRecoveryChoice {
  recovery_ref: string
  expected_revision: number
  expected_etag: string
  action: PluginFileRecoveryAction
  saved_suffix?: string
}
