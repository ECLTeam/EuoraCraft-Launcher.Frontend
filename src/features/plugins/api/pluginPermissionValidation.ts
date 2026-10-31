import {
  pluginBusinessCapabilities,
  type PluginPermissionItem,
  type PluginPermissions,
  type PluginPermissionUpdateResult,
  type PluginResourcePage,
  type PluginResourceCandidate,
} from '@/types/plugins'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 128 && value.every((item) => typeof item === 'string')
}

function networkReferences(value: string[]): boolean {
  if (!value.length || value.length > 16 || new Set(value).size !== value.length) return false
  return value.every((reference) => {
    const match = /^(https?):([a-z0-9.-]+):([1-9][0-9]{0,4})$/.exec(reference)
    if (!match || reference.length > 128) return false
    const [, scheme, host, port] = match
    if (!host || !port || !scheme || Number(port) > 65535 || !/[a-z]/.test(host.split('.').at(-1) ?? '')) return false
    if (
      host.split('.').length < 2 ||
      host.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    )
      return false
    try {
      return new URL(`${scheme}://${host}:${port}`).hostname === host
    } catch {
      return false
    }
  })
}

function parseItem(value: unknown): PluginPermissionItem {
  if (
    !record(value) ||
    typeof value.capability !== 'string' ||
    !pluginBusinessCapabilities.some((capability) => capability === value.capability) ||
    typeof value.required !== 'boolean' ||
    (value.decision !== 'allow' && value.decision !== 'deny') ||
    !strings(value.resource_refs) ||
    !strings(value.selected_resource_refs) ||
    !strings(value.requested_resource_refs) ||
    (value.capability === 'network.read' && !networkReferences(value.requested_resource_refs)) ||
    typeof value.implemented !== 'boolean' ||
    !integer(value.grant_epoch) ||
    !(value.expires_at === null || (typeof value.expires_at === 'number' && Number.isFinite(value.expires_at)))
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  return {
    capability: value.capability,
    required: value.required,
    decision: value.decision,
    resource_refs: value.resource_refs,
    selected_resource_refs: value.selected_resource_refs,
    requested_resource_refs: value.requested_resource_refs,
    implemented: value.implemented,
    expires_at: value.expires_at,
    grant_epoch: value.grant_epoch,
  }
}

export function parseResourcePage(value: unknown): PluginResourcePage {
  if (
    !record(value) ||
    !integer(value.catalog_revision) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !(value.next_cursor === null || typeof value.next_cursor === 'string')
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  const items = value.items.map((item: unknown): PluginResourceCandidate => {
    if (
      !record(item) ||
      typeof item.resource_id !== 'string' ||
      !/^[0-9a-f]{32}$/.test(item.resource_id) ||
      (item.kind !== 'instance_root' &&
        item.kind !== 'instance' &&
        item.kind !== 'java_runtime' &&
        item.kind !== 'account') ||
      typeof item.label !== 'string' ||
      item.label.length > 120 ||
      !(item.parent_ref === null || typeof item.parent_ref === 'string') ||
      !(item.version_id === null || typeof item.version_id === 'string') ||
      ((item.kind === 'java_runtime' || item.kind === 'account') &&
        (item.parent_ref !== null || item.version_id !== null)) ||
      typeof item.available !== 'boolean' ||
      typeof item.selected !== 'boolean' ||
      typeof item.is_default !== 'boolean'
    )
      throw new Error('PLUGIN_SCHEMA_INVALID')
    if (item.kind === 'java_runtime' || item.kind === 'account')
      return {
        resource_id: item.resource_id,
        kind: item.kind,
        label: item.label,
        parent_ref: null,
        version_id: null,
        available: item.available,
        selected: item.selected,
        is_default: item.is_default,
      }
    return {
      resource_id: item.resource_id,
      kind: item.kind,
      label: item.label,
      parent_ref: item.parent_ref,
      version_id: item.version_id,
      available: item.available,
      selected: item.selected,
      is_default: item.is_default,
    }
  })
  return { catalog_revision: value.catalog_revision, items, next_cursor: value.next_cursor }
}

export function parsePermissions(value: unknown): PluginPermissions {
  if (
    !record(value) ||
    typeof value.installation_id !== 'string' ||
    !/^[0-9a-f]{32}$/.test(value.installation_id) ||
    typeof value.content_digest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.content_digest) ||
    !integer(value.revision) ||
    !integer(value.grant_epoch) ||
    typeof value.required_satisfied !== 'boolean' ||
    !(value.error_code === null || typeof value.error_code === 'string') ||
    !Array.isArray(value.items) ||
    value.items.length > 128
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  return {
    installation_id: value.installation_id,
    content_digest: value.content_digest,
    revision: value.revision,
    grant_epoch: value.grant_epoch,
    required_satisfied: value.required_satisfied,
    error_code: value.error_code,
    items: value.items.map(parseItem),
  }
}

export function parsePermissionUpdate(value: unknown): PluginPermissionUpdateResult {
  if (
    !record(value) ||
    !integer(value.revision) ||
    !integer(value.grant_epoch) ||
    value.persisted !== true ||
    typeof value.required_satisfied !== 'boolean' ||
    typeof value.cleanup_state !== 'string'
  ) {
    throw new Error('PLUGIN_SCHEMA_INVALID')
  }
  return {
    revision: value.revision,
    grant_epoch: value.grant_epoch,
    persisted: true,
    required_satisfied: value.required_satisfied,
    cleanup_state: value.cleanup_state,
  }
}
