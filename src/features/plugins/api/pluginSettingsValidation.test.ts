import { describe, expect, it } from 'vitest'
import { parseDevelopment, parseSettings } from './pluginSettingsValidation'

const settings = {
  installation_id: 'a'.repeat(32),
  content_digest: 'b'.repeat(64),
  schema_revision: 'c'.repeat(64),
  schema: [{ key: 'enabled', type: 'bool', default: false, description: 'Enabled' }],
  values: { enabled: false },
  revision: 0,
  editable: true,
  reason: null,
}

describe('plugin settings boundary', () => {
  it('preserves explicit false and zero revision', () => {
    expect(parseSettings(settings)).toEqual(settings)
  })
  it.each([
    { revision: true },
    { values: { enabled: 'false' } },
    { installation_id: '../other' },
    { schema_revision: null },
    { schema: [...settings.schema, ...settings.schema] },
    { schema: [{ ...settings.schema[0], default: 'false' }] },
  ])('rejects malformed identity, definitions and values', (patch) => {
    expect(() => parseSettings({ ...settings, ...patch })).toThrow('PLUGIN_SCHEMA_INVALID')
  })
  it('accepts an unavailable schema without treating it as editable', () => {
    expect(
      parseSettings({
        ...settings,
        schema: [],
        values: {},
        schema_revision: null,
        editable: false,
        reason: 'PLUGIN_SETTING_SCHEMA_UNAVAILABLE',
      }).editable
    ).toBe(false)
  })
  it('rejects unsupported development states and non-integer counts', () => {
    const item = { name: 'demo', status: 'watching', error_code: null, supports_hot_reload: true, reload_count: 2 }
    expect(parseDevelopment({ enabled: true, items: [item] }).items[0]?.reload_count).toBe(2)
    expect(() => parseDevelopment({ enabled: true, items: [{ ...item, status: 'invented' }] })).toThrow()
    expect(() => parseDevelopment({ enabled: true, items: [{ ...item, reload_count: 1.2 }] })).toThrow()
  })
})
