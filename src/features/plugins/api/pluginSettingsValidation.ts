import {
  pluginDevelopmentStatuses,
  type PluginDevelopmentState,
  type PluginSettingSchema,
  type PluginSettingsData,
} from '@/types/plugins'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function schemaItem(value: unknown): value is PluginSettingSchema {
  if (!record(value) || typeof value.key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(value.key))
    return false
  if (typeof value.description !== 'string') return false
  if (value.type === 'bool') return typeof value.default === 'boolean'
  if (value.type === 'number') return typeof value.default === 'number' && Number.isFinite(value.default)
  if (value.type === 'string') return typeof value.default === 'string'
  return (
    value.type === 'select' &&
    typeof value.default === 'string' &&
    Array.isArray(value.options) &&
    value.options.length <= 64 &&
    value.options.every((item) => typeof item === 'string') &&
    value.options.includes(value.default)
  )
}

export function parseSettings(value: unknown): PluginSettingsData {
  if (
    !record(value) ||
    !Array.isArray(value.schema) ||
    value.schema.length > 64 ||
    !value.schema.every(schemaItem) ||
    new Set(value.schema.map((item) => item.key)).size !== value.schema.length ||
    !record(value.values) ||
    !Number.isSafeInteger(value.revision) ||
    typeof value.revision !== 'number' ||
    value.revision < 0 ||
    typeof value.installation_id !== 'string' ||
    !/^[0-9a-f]{32}$/.test(value.installation_id) ||
    typeof value.content_digest !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.content_digest) ||
    (value.schema_revision !== null &&
      (typeof value.schema_revision !== 'string' || !/^[0-9a-f]{64}$/.test(value.schema_revision))) ||
    typeof value.editable !== 'boolean' ||
    (value.reason !== null && typeof value.reason !== 'string') ||
    (value.editable && value.schema_revision === null)
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  const values = value.values
  if (
    value.schema.some((item) => {
      const stored = values[item.key]
      if (item.type === 'bool') return typeof stored !== 'boolean'
      if (item.type === 'number') return typeof stored !== 'number' || !Number.isFinite(stored)
      return typeof stored !== 'string' || (item.type === 'select' && !item.options?.includes(stored))
    })
  )
    throw new Error('PLUGIN_SCHEMA_INVALID')
  return {
    schema: value.schema,
    values: value.values,
    revision: value.revision,
    installation_id: value.installation_id,
    content_digest: value.content_digest,
    schema_revision: value.schema_revision,
    editable: value.editable,
    reason: value.reason,
  }
}

export function parseDevelopment(value: unknown): PluginDevelopmentState {
  if (
    !record(value) ||
    typeof value.enabled !== 'boolean' ||
    !Array.isArray(value.items) ||
    value.items.length > 10000
  ) {
    throw new Error('PLUGIN_SCHEMA_INVALID')
  }
  return {
    enabled: value.enabled,
    items: value.items.map((item: unknown) => {
      if (
        !record(item) ||
        typeof item.name !== 'string' ||
        typeof item.status !== 'string' ||
        (item.error_code !== null && typeof item.error_code !== 'string') ||
        typeof item.supports_hot_reload !== 'boolean' ||
        typeof item.reload_count !== 'number' ||
        !Number.isSafeInteger(item.reload_count) ||
        item.reload_count < 0
      ) {
        throw new Error('PLUGIN_SCHEMA_INVALID')
      }
      const status = pluginDevelopmentStatuses.find((status) => item.status === status)
      if (!status) throw new Error('PLUGIN_SCHEMA_INVALID')
      return {
        name: item.name,
        status,
        error_code: item.error_code,
        reload_count: item.reload_count,
        supports_hot_reload: item.supports_hot_reload,
      }
    }),
  }
}
