import { describe, expect, it } from 'vitest'
import { parseLittleSkinConfig, parseLittleSkinSnapshot } from './littleSkinLogin'

const snapshot = {
  session_id: '0123456789abcdef0123456789abcdef',
  method: 'device_code',
  status: 'pending',
  user_code: 'ABCD',
  verification_uri: 'https://open.littleskin.cn/oauth/link?user_code=ABCD',
  expires_at: 2000000000,
  profiles: [],
  error_code: '',
}

describe('LittleSkin IPC response validation', () => {
  it('accepts the official authorization pages for both flows', () => {
    expect(parseLittleSkinSnapshot(snapshot).user_code).toBe('ABCD')
    expect(
      parseLittleSkinSnapshot({
        ...snapshot,
        method: 'authorization_code',
        verification_uri: 'https://littleskin.cn/oauth/authorize?state=example',
      }).method
    ).toBe('authorization_code')
  })

  it.each([
    'https://attacker.invalid/oauth/link',
    'javascript:alert(1)',
    'https://open.littleskin.cn@attacker.invalid/oauth/link',
    'https://littleskin.cn/oauth/authorize',
  ])('rejects untrusted or incorrect authorization destinations: %s', (verification_uri) => {
    expect(() => parseLittleSkinSnapshot({ ...snapshot, verification_uri })).toThrow()
  })

  it('rejects malformed states, profile IDs and configuration types', () => {
    expect(() => parseLittleSkinSnapshot({ ...snapshot, status: 'unknown' })).toThrow()
    expect(() => parseLittleSkinSnapshot({ ...snapshot, profiles: [{ id: '../../file', name: 'Player' }] })).toThrow()
    expect(() =>
      parseLittleSkinConfig({ device_code: 'true', authorization_code: false, needs_client_id: false })
    ).toThrow()
  })
})
