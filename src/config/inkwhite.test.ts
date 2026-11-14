import { describe, expect, it } from 'vitest'
import {
  INKWHITE_ACCENT_PRESETS,
  INKWHITE_DARK,
  INKWHITE_LIGHT,
  inkwhiteAccentPresets,
  inkwhitePalette,
  inkwhitePaletteTokens,
} from './inkwhite'

const hexPattern = /^#[0-9a-f]{6}$/

describe('墨白色板', () => {
  it('亮暗两套色板都是合法十六进制', () => {
    for (const palette of [INKWHITE_DARK, INKWHITE_LIGHT]) {
      for (const value of Object.values(palette)) {
        expect(value).toMatch(hexPattern)
      }
    }
  })

  it('亮色浅灰画布衬白卡，深色近黑画布配实色卡', () => {
    expect(INKWHITE_LIGHT.canvas).toBe('#f4f4f5')
    expect(INKWHITE_LIGHT.surface).toBe('#ffffff')
    expect(INKWHITE_DARK.canvas).toBe('#0a0a0a')
    expect(INKWHITE_DARK.surface).toBe('#111111')
  })

  it('亮色主色是站点近黑，深色换成品牌蓝', () => {
    expect(INKWHITE_LIGHT.accent).toBe('#0a0a0a')
    expect(INKWHITE_DARK.accent).toBe('#3b82f6')
  })

  it('按亮暗取对应色板', () => {
    expect(inkwhitePalette(true)).toBe(INKWHITE_DARK)
    expect(inkwhitePalette(false)).toBe(INKWHITE_LIGHT)
  })

  it('强调色预设取站点色系，首项随外观换成默认强调色', () => {
    expect(INKWHITE_ACCENT_PRESETS.length).toBeGreaterThanOrEqual(6)
    expect(INKWHITE_ACCENT_PRESETS.map((preset) => preset.value)).toContain('#2563eb')
    expect(INKWHITE_ACCENT_PRESETS.map((preset) => preset.value)).toContain('#00baff')

    expect(inkwhiteAccentPresets(false)[0]!.value).toBe(INKWHITE_LIGHT.accent)
    expect(inkwhiteAccentPresets(true)[0]!.value).toBe(INKWHITE_DARK.accent)
    // 只有首项随外观变化，其余色值亮暗共用
    expect(inkwhiteAccentPresets(true).slice(1)).toEqual(inkwhiteAccentPresets(false).slice(1))
  })

  it('语义令牌沿用色板，信息色取品牌蓝而非近黑主色', () => {
    const tokens = inkwhitePaletteTokens(INKWHITE_LIGHT, false)
    expect(tokens.canvas).toBe(INKWHITE_LIGHT.canvas)
    expect(tokens.base).toBe(INKWHITE_LIGHT.surface)
    expect(tokens.mutedBase).toBe(INKWHITE_LIGHT.surfaceMuted)
    expect(tokens.border).toBe(INKWHITE_LIGHT.border)
    expect(tokens.info).toBe(INKWHITE_LIGHT.brand)
    expect(tokens.raisedFill).toBe(INKWHITE_LIGHT.controlFillHover)
    expect(tokens.shadowTint).toBe(INKWHITE_LIGHT.text)
  })

  it('亮色卡片接近实色，深色略透', () => {
    expect(inkwhitePaletteTokens(INKWHITE_LIGHT, false).surfaceOpacity).toBe(0.98)
    expect(inkwhitePaletteTokens(INKWHITE_LIGHT, false).controlOpacity).toBe(1)
    expect(inkwhitePaletteTokens(INKWHITE_DARK, true).surfaceOpacity).toBe(0.9)
    expect(inkwhitePaletteTokens(INKWHITE_DARK, true).controlOpacity).toBe(0.96)
  })

  it('近黑主色下徽标仍保留彩色区分', () => {
    const tokens = inkwhitePaletteTokens(INKWHITE_LIGHT, false)
    expect(tokens.badgeNeoForge).toBe(INKWHITE_LIGHT.brand)
    expect(tokens.badgeNeoForge).not.toBe(INKWHITE_LIGHT.accent)
    expect(tokens.badgeFabric).toBe(INKWHITE_LIGHT.warning)
    expect(tokens.badgeQuilt).toBe(INKWHITE_LIGHT.success)
    expect(new Set([tokens.badgeFabric, tokens.badgeForge, tokens.badgeNeoForge, tokens.badgeQuilt]).size).toBe(4)
  })
})
