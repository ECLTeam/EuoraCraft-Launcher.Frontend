import { describe, expect, it } from 'vitest'
import { getLocatorColor } from './locatorColor'

describe('账户定位栏默认颜色', () => {
  it('匹配官方 1.21.6 ARGB.setBrightness 实际执行结果，含灰色、最高位和舍入边界', () => {
    // 期望值由官方 client.jar（SHA-1 740a125b83dd3447feaa3c5e891ead7fbb21ae28）在 JVM 中执行得出。
    const vectors = [
      ['069a79f4-44e9-4726-a5be-fca90e38aaf5', '#E66185'],
      ['00000000-0000-0000-0000-000000000000', '#E6E6E6'],
      ['ffffffff-ffff-ffff-ffff-ffffffffffff', '#E6E6E6'],
      ['80000000-0000-0000-0000-000000123456', '#308BE6'],
      ['00000000-0000-0000-0000-000000ff0000', '#E60000'],
      ['00000000-0000-0000-0000-00000000ff00', '#00E600'],
      ['00000000-0000-0000-0000-0000000000ff', '#0000E6'],
      ['00000000-0000-0000-0000-000000fefd01', '#E6E501'],
      ['00000000-0000-0000-0000-00000001fdfe', '#01E5E6'],
      ['00000000-0000-0000-0000-000000fe01fd', '#E601E5'],
      ['00000000-0000-0000-0000-000000010203', '#4C99E6'],
    ] as const
    for (const [uuid, expected] of vectors) expect(getLocatorColor(uuid)?.hex, uuid).toBe(expected)
    expect(getLocatorColor(vectors[0][0])?.rgb).toEqual([230, 97, 133])
  })

  it('标准和紧凑 UUID 大小写等价，不依赖账户类型或用户名', () => {
    const color = getLocatorColor('069a79f4-44e9-4726-a5be-fca90e38aaf5')
    expect(getLocatorColor('  069A79F444E94726A5BEFCA90E38AAF5  ')).toEqual(color)
    expect(Object.isFrozen(color)).toBe(true)
    expect(Object.isFrozen(color?.rgb)).toBe(true)
  })

  it('缺失或无效 UUID 不产生颜色', () => {
    for (const uuid of [
      undefined,
      null,
      '',
      'Notch',
      'g'.repeat(32),
      '0'.repeat(31),
      '0'.repeat(33),
      `${'0'.repeat(31)}-0`,
    ]) {
      expect(getLocatorColor(uuid)).toBeNull()
    }
  })
})
