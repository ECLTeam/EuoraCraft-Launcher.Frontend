import type { PluginFileRecovery, PluginFileRecoveryAction, PluginFileRecoveryPage } from '@/types/plugins'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function action(value: unknown): value is PluginFileRecoveryAction {
  return value === 'restore' || value === 'save_as' || value === 'discard'
}

function parseItem(value: unknown): PluginFileRecovery {
  if (
    !record(value) ||
    typeof value.recovery_ref !== 'string' ||
    !/^[0-9a-f]{32}$/.test(value.recovery_ref) ||
    typeof value.name !== 'string' ||
    value.name.length > 120 ||
    typeof value.revision !== 'number' ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.etag !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.etag) ||
    (value.state !== 'pending' &&
      value.state !== 'conflict' &&
      value.state !== 'cleanup' &&
      value.state !== 'invalid') ||
    !Array.isArray(value.actions) ||
    value.actions.length > 3 ||
    !value.actions.every(action) ||
    ((value.state === 'invalid' || value.state === 'cleanup') && value.actions.length > 0)
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  return {
    recovery_ref: value.recovery_ref,
    name: value.name,
    revision: value.revision,
    etag: value.etag,
    state: value.state,
    actions: value.actions,
  }
}

export function parseFileRecoveryPage(value: unknown): PluginFileRecoveryPage {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 100 ||
    !(value.next_cursor === null || (typeof value.next_cursor === 'string' && /^[0-9a-f]{32}$/.test(value.next_cursor)))
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  return { items: value.items.map(parseItem), next_cursor: value.next_cursor }
}

export function parseFileRecoveryReceipt(value: unknown): { operationId: string; status: 'pending' } {
  if (
    !record(value) ||
    typeof value.operationId !== 'string' ||
    !/^[0-9a-f]{32}$/.test(value.operationId) ||
    value.status !== 'pending'
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  return { operationId: value.operationId, status: value.status }
}
