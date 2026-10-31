import { describe, expect, it } from 'vitest'
import {
  ABSOLUTELY_ACCENT_PRESETS,
  ABSOLUTELY_DARK,
  ABSOLUTELY_LIGHT,
  absolutelyPalette,
  absolutelyPaletteTokens,
} from './absolutely'

const hexPattern = /^#[0-9a-f]{6}$/

describe('Absolutely 色板', () => {
  it('亮暗两套色板都是合法十六进制且中性色不带色偏', () => {
    for (const palette of [ABSOLUTELY_DARK, ABSOLUTELY_LIGHT]) {
      for (const value of Object.values(palette)) {
        expect(value).toMatch(hexPattern)
      }
    }
    // 深色以近黑为底，浅色用中性灰画布衬出白卡
    expect(ABSOLUTELY_DARK.canvas).toBe('#0a0a0a')
    expect(ABSOLUTELY_LIGHT.canvas).toBe('#e7e7ea')
    expect(ABSOLUTELY_LIGHT.surface).toBe('#ffffff')
  })

  it('按亮暗取对应色板', () => {
    expect(absolutelyPalette(true)).toBe(ABSOLUTELY_DARK)
    expect(absolutelyPalette(false)).toBe(ABSOLUTELY_LIGHT)
  })

  it('强调色预设默认项与深色强调色一致', () => {
    expect(ABSOLUTELY_ACCENT_PRESETS.length).toBeGreaterThanOrEqual(6)
    expect(ABSOLUTELY_ACCENT_PRESETS.map((preset) => preset.value)).toContain(ABSOLUTELY_DARK.accent)
    expect(ABSOLUTELY_ACCENT_PRESETS[0]!.value).toBe(ABSOLUTELY_DARK.accent)
  })

  it('语义令牌直接沿用色板，不引入额外混色', () => {
    const tokens = absolutelyPaletteTokens(ABSOLUTELY_DARK, true)
    expect(tokens.canvas).toBe(ABSOLUTELY_DARK.canvas)
    expect(tokens.base).toBe(ABSOLUTELY_DARK.surface)
    expect(tokens.mutedBase).toBe(ABSOLUTELY_DARK.surfaceMuted)
    expect(tokens.border).toBe(ABSOLUTELY_DARK.border)
    expect(tokens.info).toBe(ABSOLUTELY_DARK.accent)
    expect(tokens.raisedFill).toBe(ABSOLUTELY_DARK.controlFillHover)
    expect(tokens.shadowTint).toBe('#000000')
  })

  it('浅色档把表面压到接近实色，深色沿用默认不透明度', () => {
    expect(absolutelyPaletteTokens(ABSOLUTELY_LIGHT, false).surfaceOpacity).toBe(0.98)
    expect(absolutelyPaletteTokens(ABSOLUTELY_LIGHT, false).controlOpacity).toBe(1)
    expect(absolutelyPaletteTokens(ABSOLUTELY_DARK, true).surfaceOpacity).toBe(0.88)
  })

  it('浅色外观的阴影基色取文字色，避免纯黑阴影发灰', () => {
    const tokens = absolutelyPaletteTokens(ABSOLUTELY_LIGHT, false)
    expect(tokens.shadowTint).toBe(ABSOLUTELY_LIGHT.text)
  })
})
