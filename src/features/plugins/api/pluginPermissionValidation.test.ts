import { describe, expect, it } from 'vitest'
import { parsePermissions, parsePermissionUpdate, parseResourcePage } from './pluginPermissionValidation'

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
      selected_resource_refs: [],
      requested_resource_refs: [],
      expires_at: null,
      grant_epoch: 1,
    },
  ],
}

describe('plugin permission boundary', () => {
  const candidate = {
    resource_id: 'a'.repeat(32),
    kind: 'instance_root',
    label: 'Game',
    parent_ref: null,
    version_id: null,
    available: true,
    selected: false,
  }
  it('projects resource candidates without passing additional host fields to the selector', () => {
    const page = parseResourcePage({
      catalog_revision: 1,
      items: [{ ...candidate, path: 'private' }],
      next_cursor: null,
    })
    expect(page.items).toEqual([candidate])
  })
  it.each([
    { ...candidate, resource_id: '../outside' },
    { ...candidate, kind: 'file' },
    { ...candidate, selected: 'true' },
    { ...candidate, available: 1 },
    { ...candidate, label: 'x'.repeat(121) },
  ])('rejects malformed resource candidates', (item) => {
    expect(() => parseResourcePage({ catalog_revision: 1, items: [item], next_cursor: null })).toThrow(
      'PLUGIN_SCHEMA_INVALID'
    )
  })
  it('accepts a reviewed installation and preserves explicit denial', () => {
    expect(parsePermissions(valid).items[0]?.decision).toBe('deny')
  })
  it.each([
    { ...valid, revision: true },
    { ...valid, installation_id: '../other' },
    { ...valid, required_satisfied: 'true' },
    { ...valid, items: [{ ...valid.items[0], implemented: 'true' }] },
    { ...valid, items: [{ ...valid.items[0], requested_resource_refs: undefined }] },
    { ...valid, items: [{ ...valid.items[0], requested_resource_refs: [3] }] },
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
