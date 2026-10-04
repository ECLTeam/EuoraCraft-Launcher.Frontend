import { describe, expect, it, vi } from 'vitest'
import {
  avatarSizes,
  decodeSkinBytes,
  extractAvatarPixels,
  validateSkinDimensions,
  loadSkinPixels,
  type SkinPixels,
} from './skinAvatar'

function skinPixels(scale = 1, legacy = false): SkinPixels {
  const width = 64 * scale
  const height = (legacy ? 32 : 64) * scale
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 8 * scale; y < 16 * scale; y++) {
    for (let x = 0; x < 8 * scale; x++) {
      data.set([x, y, 200, 255], (y * width + 8 * scale + x) * 4)
      data.set([255, 0, 0, 128], (y * width + 40 * scale + x) * 4)
    }
  }
  return { width, height, data }
}

function pngHeader(width: number, height: number): string {
  const bytes = new Uint8Array(33)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  view.setUint32(12, 0x49484452)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return btoa(String.fromCharCode(...bytes))
}

describe('skin avatar pixels', () => {
  it('releases a pending image URL immediately when decoding is aborted', async () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:skin', revokeObjectURL: revoke })
    vi.stubGlobal(
      'Image',
      class {
        src = ''
        onload = null
        onerror = null
      }
    )
    const controller = new AbortController()
    try {
      const pending = loadSkinPixels(pngHeader(64, 64), controller.signal)
      controller.abort()
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      expect(revoke).toHaveBeenCalledWith('blob:skin')
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it.each(avatarSizes)('exports an exact %i square using nearest-neighbor face pixels', (size) => {
    const skin = skinPixels()
    const output = extractAvatarPixels(skin, size, false)
    expect(output.length).toBe(size * size * 4)
    expect([...output.slice(0, 4)]).toEqual([0, 8, 200, 255])
    expect([...output.slice(-4)]).toEqual([7, 15, 200, 255])
    expect([...output.slice(4, 8)]).toEqual([0, 8, 200, 255])
  })

  it.each([false, true])('uses scaled face coordinates for HD skins (legacy: %s)', (legacy) => {
    const output = extractAvatarPixels(skinPixels(2, legacy), 64, false)
    expect([...output.slice(0, 4)]).toEqual([0, 16, 200, 255])
    expect([...output.slice(-4)]).toEqual([15, 31, 200, 255])
  })

  it('alpha-composites a semitransparent hat without changing the output bounds', () => {
    const output = extractAvatarPixels(skinPixels(), 64, true)
    expect([...output.slice(0, 4)]).toEqual([128, 4, 100, 255])
    expect([...output.slice(-4)]).toEqual([131, 7, 100, 255])
  })

  it('preserves transparent pixels and uses the face when the hat is transparent', () => {
    const skin = skinPixels()
    skin.data.set([20, 40, 60, 0], (8 * 64 + 8) * 4)
    skin.data.set([255, 0, 0, 0], (8 * 64 + 40) * 4)
    expect([...extractAvatarPixels(skin, 64, true).slice(0, 4)]).toEqual([0, 0, 0, 0])
    skin.data.set([20, 40, 60, 64], (8 * 64 + 8) * 4)
    expect([...extractAvatarPixels(skin, 64, true).slice(0, 4)]).toEqual([20, 40, 60, 64])
    skin.data.set([200, 100, 50, 255], (8 * 64 + 40) * 4)
    expect([...extractAvatarPixels(skin, 64, true).slice(0, 4)]).toEqual([200, 100, 50, 255])
  })

  it.each([
    [0, 0],
    [65, 64],
    [64, 48],
    [2048, 2048],
  ])('rejects invalid dimensions %i × %i', (width, height) => {
    expect(() => validateSkinDimensions(width, height)).toThrow('invalidDimensions')
  })

  it('validates the PNG signature, header and input size before decoding an image', () => {
    expect(decodeSkinBytes(pngHeader(64, 32)).length).toBe(33)
    expect(decodeSkinBytes(pngHeader(1024, 1024)).length).toBe(33)
    expect(() => decodeSkinBytes(pngHeader(64, 48))).toThrow('invalidDimensions')
    expect(() => decodeSkinBytes('not base64!')).toThrow('invalidPng')
    expect(() => decodeSkinBytes(btoa('not a png file'))).toThrow('invalidPng')
    expect(() => decodeSkinBytes('A'.repeat(4 * Math.ceil((5 * 1024 * 1024) / 3) + 4))).toThrow('tooLarge')
    const damaged = atob(pngHeader(64, 64)).split('')
    damaged[12] = 'X'
    expect(() => decodeSkinBytes(btoa(damaged.join('')))).toThrow('invalidPng')
  })
})
