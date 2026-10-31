import { describe, expect, it } from 'vitest'
import {
  BUILTIN_THEMES,
  DEFAULT_PRIMARY_COLOR,
  PRESET_COLORS,
  isBuiltinThemeId,
  layoutSkinOf,
  resolveCatppuccinFlavor,
} from './theme'

describe('theme defaults', () => {
  it('默认主色属于外观设置的预设列表', () => {
    expect(PRESET_COLORS.map((color) => color.value)).toContain(DEFAULT_PRIMARY_COLOR)
  })
})

describe('内置主题风格', () => {
  it('包含两个布局皮肤与四个 Catppuccin 风味', () => {
    expect(BUILTIN_THEMES.map((theme) => theme.id)).toEqual([
      'classic',
      'folia',
      'catppuccin-latte',
      'catppuccin-frappe',
      'catppuccin-macchiato',
      'catppuccin-mocha',
    ])
  })

  it('拒绝未登记的主题风格', () => {
    expect(isBuiltinThemeId('catppuccin-mocha')).toBe(true)
    expect(isBuiltinThemeId('catppuccin-espresso')).toBe(false)
    expect(isBuiltinThemeId(null)).toBe(false)
  })

  it('Catppuccin 只替换配色，布局沿用经典皮肤', () => {
    expect(layoutSkinOf('classic')).toBe('classic')
    expect(layoutSkinOf('folia')).toBe('folia')
    expect(layoutSkinOf('catppuccin-frappe')).toBe('classic')
  })

  it('亮色固定 Latte，深色使用所选风味，Latte 选中时深色回退 Mocha', () => {
    expect(resolveCatppuccinFlavor('catppuccin-mocha', false)).toBe('latte')
    expect(resolveCatppuccinFlavor('catppuccin-mocha', true)).toBe('mocha')
    expect(resolveCatppuccinFlavor('catppuccin-frappe', true)).toBe('frappe')
    expect(resolveCatppuccinFlavor('catppuccin-latte', true)).toBe('mocha')
    expect(resolveCatppuccinFlavor('folia', true)).toBeNull()
    expect(resolveCatppuccinFlavor('classic', false)).toBeNull()
  })
})
