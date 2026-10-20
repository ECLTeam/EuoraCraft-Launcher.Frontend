import type { PluginPermissionItem, PluginPermissions, PluginPermissionUpdateResult } from '@/types/plugins'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 128 && value.every((item) => typeof item === 'string')
}

function parseItem(value: unknown): PluginPermissionItem {
  if (
    !record(value) ||
    typeof value.capability !== 'string' ||
    typeof value.required !== 'boolean' ||
    (value.decision !== 'allow' && value.decision !== 'deny') ||
    !strings(value.resource_refs) ||
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
    implemented: value.implemented,
    expires_at: value.expires_at,
    grant_epoch: value.grant_epoch,
  }
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
