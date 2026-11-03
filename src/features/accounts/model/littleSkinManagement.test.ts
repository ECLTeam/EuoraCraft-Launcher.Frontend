import { describe, expect, it } from 'vitest'
import { parseLittleSkinCloset, parseLittleSkinManagement } from './littleSkinManagement'

describe('LittleSkin management boundary', () => {
  it('accepts an explicit authorization requirement', () => {
    expect(parseLittleSkinManagement({ needs_authorization: true, player: null }).needs_authorization).toBe(true)
  })
  it('requires a player when authorization is available', () => {
    expect(() => parseLittleSkinManagement({ needs_authorization: false, player: null })).toThrow()
  })
  it.each([{ hash: 'https://elsewhere.invalid' }, { tid: 0 }, { type: 'unknown' }])(
    'rejects invalid cloud textures %o',
    (change) => {
      expect(() =>
        parseLittleSkinCloset({
          current_page: 1,
          last_page: 1,
          total: 1,
          data: [{ tid: 1, name: 'Skin', hash: 'a'.repeat(64), type: 'steve', ...change }],
        })
      ).toThrow()
    }
  )
})
