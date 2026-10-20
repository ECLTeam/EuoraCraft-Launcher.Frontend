/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface PluginInfo {
  name: string
  installation_id?: string
  content_digest?: string
  review_required?: boolean
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

export interface PluginResourceCandidate {
  resource_id: string
  kind: 'instance_root' | 'instance'
  label: string
  parent_ref: string | null
  version_id: string | null
  available: boolean
  selected: boolean
}

export interface PluginResourcePage {
  catalog_revision: number
  items: PluginResourceCandidate[]
  next_cursor: string | null
}

export interface PluginResourceQuery {
  installation_id: string
  content_digest: string
  capability: 'instances.read'
  parent_ref?: string | null
  search?: string
  cursor?: string | null
  limit?: number
}
