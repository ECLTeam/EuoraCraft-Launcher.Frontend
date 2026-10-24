import { describe, expect, it } from 'vitest'
import type { ScannedVersion } from '@/types/instances'
import {
  globalInstanceIsolation,
  javaSelectionOverride,
  memoryAllocationOverride,
  resolveRuntimeAutomatic,
} from './instanceSettings'

describe('direct instance overrides', () => {
  it('compares the complete Java combination with global settings', () => {
    expect(javaSelectionOverride(false, 'A', false, 'A').javaMode).toBe('inherit')
    expect(javaSelectionOverride(false, 'B', false, 'A')).toEqual({ javaMode: 'manual', javaPath: 'B' })
    expect(javaSelectionOverride(true, 'B', false, 'A').javaMode).toBe('auto')
    expect(javaSelectionOverride(false, '', true, '').javaMode).toBe('manual')
    expect(resolveRuntimeAutomatic('inherit', false)).toBe(false)
    expect(resolveRuntimeAutomatic('auto', false)).toBe(true)
  })
  it('does not drop a distinct memory amount because the automatic switch matches', () => {
    expect(memoryAllocationOverride(false, 8192, false, 4096).memoryMode).toBe('manual')
    expect(memoryAllocationOverride(false, 4096, false, 4096).memoryMode).toBe('inherit')
    expect(memoryAllocationOverride(true, 8192, true, 4096).memoryMode).toBe('inherit')
    expect(memoryAllocationOverride(false, 4096, true, 4096).memoryMode).toBe('manual')
  })
  it('resolves isolation using loader and release metadata rather than the version name', () => {
    const version = { primaryLoader: 'OptiFine', versionType: 'release' } as ScannedVersion
    expect(globalInstanceIsolation('modded_only', version)).toBe(true)
    expect(globalInstanceIsolation('non_release_only', version)).toBe(false)
    expect(globalInstanceIsolation('all', version)).toBe(true)
    expect(globalInstanceIsolation('disabled', version)).toBe(false)
    expect(
      globalInstanceIsolation('modded_or_non_release', {
        ...version,
        primaryLoader: 'vanilla',
        versionType: 'snapshot',
      })
    ).toBe(true)
  })
})
