import { describe, expect, it } from 'vitest'
import wardrobeGridSource from './WardrobeGrid.vue?raw'

describe('WardrobeGrid', () => {
  it('在内容不足一行时不拉伸衣柜卡片', () => {
    expect(wardrobeGridSource).toMatch(
      /\.wardrobe-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill, minmax\(120px, 1fr\)\);[^}]*align-content:\s*start;/s
    )
  })
})
