import { describe, expect, it } from 'vitest'
import { parsePermissions, parsePermissionUpdate } from './pluginPermissionValidation'

const valid = {
  installation_id: 'a'.repeat(32),
  content_digest: 'b'.repeat(64),
  revision: 0,
  grant_epoch: 1,
  required_satisfied: false,
  error_code: null,
  items: [
    {
      capability: 'settings.read',
      required: true,
      decision: 'deny',
      implemented: true,
      resource_refs: [],
      expires_at: null,
      grant_epoch: 1,
    },
  ],
}

describe('plugin permission boundary', () => {
  it('accepts a reviewed installation and preserves explicit denial', () => {
    expect(parsePermissions(valid).items[0]?.decision).toBe('deny')
  })
  it.each([
    { ...valid, revision: true },
    { ...valid, installation_id: '../other' },
    { ...valid, required_satisfied: 'true' },
    { ...valid, items: [{ ...valid.items[0], implemented: 'true' }] },
  ])('rejects malformed host responses', (value) => {
    expect(() => parsePermissions(value)).toThrow('PLUGIN_SCHEMA_INVALID')
  })
  it('never treats persistence failure as a successful review', () => {
    expect(() =>
      parsePermissionUpdate({
        revision: 1,
        grant_epoch: 2,
        persisted: false,
        required_satisfied: true,
        cleanup_state: 'pending',
      })
    ).toThrow()
  })
})
