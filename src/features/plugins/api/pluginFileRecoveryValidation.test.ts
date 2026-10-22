import { describe, expect, it } from 'vitest'
import { parseFileRecoveryPage, parseFileRecoveryReceipt } from './pluginFileRecoveryValidation'

const row = {
  recovery_ref: 'a'.repeat(32),
  name: 'target.bin',
  revision: 1,
  etag: 'b'.repeat(64),
  state: 'conflict',
  actions: ['save_as', 'discard'],
}

describe('file recovery boundary', () => {
  it('returns only public fields and validates the task receipt', () => {
    expect(parseFileRecoveryPage({ items: [{ ...row, private_path: 'hidden' }], next_cursor: null }).items[0]).toEqual(
      row
    )
    expect(parseFileRecoveryReceipt({ operationId: 'a'.repeat(32), status: 'pending' })).toEqual({
      operationId: 'a'.repeat(32),
      status: 'pending',
    })
  })
  it.each([
    { actions: ['force'] },
    { revision: true },
    { etag: 'x' },
    { state: 'invalid' },
    { recovery_ref: '../path' },
  ])('rejects invalid external data %j', (change) => {
    expect(() => parseFileRecoveryPage({ items: [{ ...row, ...change }], next_cursor: null })).toThrow(
      'PLUGIN_SCHEMA_INVALID'
    )
  })
  it('rejects fabricated or completed task receipts', () => {
    expect(() => parseFileRecoveryReceipt({ operationId: 'a'.repeat(32), status: 'completed' })).toThrow()
    expect(() => parseFileRecoveryReceipt({ operationId: '../x', status: 'pending' })).toThrow()
  })
})
