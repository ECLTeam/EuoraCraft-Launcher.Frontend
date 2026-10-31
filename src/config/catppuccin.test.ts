import { describe, expect, it } from 'vitest'
import {
  CATPPUCCIN_ACCENT_KEYS,
  CATPPUCCIN_FLAVORS,
  CATPPUCCIN_PALETTES,
  catppuccinAccentPresets,
  catppuccinFlavorOfThemeId,
  isCatppuccinFlavor,
  translateAccentColor,
} from './catppuccin'

const hexPattern = /^#[0-9a-f]{6}$/

describe('Catppuccin 色板', () => {
  it('四个风味都提供完整的 26 色标准色板', () => {
    const expectedKeys = [
      'rosewater',
      'flamingo',
      'pink',
      'mauve',
      'red',
      'maroon',
      'peach',
      'yellow',
      'green',
      'teal',
      'sky',
      'sapphire',
      'blue',
      'lavender',
      'text',
      'subtext1',
      'subtext0',
      'overlay2',
      'overlay1',
      'overlay0',
      'surface2',
      'surface1',
      'surface0',
      'base',
      'mantle',
      'crust',
    ]
    for (const flavor of CATPPUCCIN_FLAVORS) {
      const palette = CATPPUCCIN_PALETTES[flavor]
      expect(Object.keys(palette).sort()).toEqual([...expectedKeys].sort())
      for (const value of Object.values(palette)) {
        expect(value).toMatch(hexPattern)
      }
    }
  })

  it('Latte 为亮色底，深色风味依次变暗', () => {
    expect(CATPPUCCIN_PALETTES.latte.base).toBe('#eff1f5')
    expect(CATPPUCCIN_PALETTES.frappe.base).toBe('#303446')
    expect(CATPPUCCIN_PALETTES.macchiato.base).toBe('#24273a')
    expect(CATPPUCCIN_PALETTES.mocha.base).toBe('#1e1e2e')
  })
})

describe('Catppuccin 风味解析', () => {
  it('只接受四个官方风味标识', () => {
    expect(isCatppuccinFlavor('mocha')).toBe(true)
    expect(isCatppuccinFlavor('espresso')).toBe(false)
    expect(isCatppuccinFlavor(undefined)).toBe(false)
  })

  it('从主题风格标识解析风味，非 Catppuccin 返回 null', () => {
    expect(catppuccinFlavorOfThemeId('catppuccin-macchiato')).toBe('macchiato')
    expect(catppuccinFlavorOfThemeId('catppuccin')).toBeNull()
    expect(catppuccinFlavorOfThemeId('folia')).toBeNull()
    expect(catppuccinFlavorOfThemeId('catppuccin-espresso')).toBeNull()
  })
})

describe('Catppuccin 强调色', () => {
  it('预设色点取对应风味的官方色，Mauve 排首位', () => {
    const presets = catppuccinAccentPresets('mocha')
    expect(presets).toHaveLength(CATPPUCCIN_ACCENT_KEYS.length)
    expect(presets[0]).toEqual({ name: '淡紫', value: CATPPUCCIN_PALETTES.mocha.mauve })
    expect(presets.map((preset) => preset.value)).toContain(CATPPUCCIN_PALETTES.mocha.blue)
  })

  it('亮暗切换时官方强调色换乘到目标风味，自定义色保持不变', () => {
    expect(translateAccentColor(CATPPUCCIN_PALETTES.mocha.mauve, 'latte')).toBe(CATPPUCCIN_PALETTES.latte.mauve)
    expect(translateAccentColor(CATPPUCCIN_PALETTES.latte.mauve, 'mocha')).toBe(CATPPUCCIN_PALETTES.mocha.mauve)
    expect(translateAccentColor('#5B6FF5', 'mocha')).toBeNull()
    expect(translateAccentColor('', 'mocha')).toBeNull()
  })
})
