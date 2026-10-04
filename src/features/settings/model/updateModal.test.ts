import { describe, expect, it } from 'vitest'
import { getUpdateVersionChannel } from './updateModal'

describe('getUpdateVersionChannel', () => {
  it.each([
    ['0.1.0-beta.2+20260919', 'beta'],
    ['v0.1.0-RC.1', 'rc'],
    ['0.0.1-alpha', 'alpha'],
    ['1.0.0', 'release'],
    ['1.0.0+build-beta.1', 'release'],
  ] as const)('labels target version %s as %s', (version, channel) => {
    expect(getUpdateVersionChannel(version)).toBe(channel)
  })
})
