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
      capability: 'instances.read',
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
    is_default: false,
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
  it.each(['java.read', 'java.use', 'java.catalog.read', 'java.install', 'accounts.read'])(
    'accepts the current declared domain capability %s',
    (capability) => {
      expect(parsePermissions({ ...valid, items: [{ ...valid.items[0], capability }] }).items[0]?.capability).toBe(
        capability
      )
    }
  )
  it('accepts account candidates and rejects hierarchy fields', () => {
    const account = { ...candidate, kind: 'account', label: 'Player (offline)' }
    expect(parseResourcePage({ catalog_revision: 2, items: [account], next_cursor: null }).items[0]?.kind).toBe(
      'account'
    )
    expect(() =>
      parseResourcePage({ catalog_revision: 2, items: [{ ...account, parent_ref: 'a'.repeat(32) }], next_cursor: null })
    ).toThrow('PLUGIN_SCHEMA_INVALID')
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

it('rejects Java candidates carrying instance hierarchy fields', () => {
  const candidate = {
    resource_id: 'c'.repeat(32),
    kind: 'java_runtime',
    is_default: false,
    label: 'Java 21',
    parent_ref: 'a'.repeat(32),
    version_id: null,
    available: true,
    selected: false,
  }
  expect(() => parseResourcePage({ catalog_revision: 7, items: [candidate], next_cursor: null })).toThrow(
    'PLUGIN_SCHEMA_INVALID'
  )
  expect(
    parseResourcePage({ catalog_revision: 7, items: [{ ...candidate, parent_ref: null }], next_cursor: null }).items[0]
      ?.kind
  ).toBe('java_runtime')
})
