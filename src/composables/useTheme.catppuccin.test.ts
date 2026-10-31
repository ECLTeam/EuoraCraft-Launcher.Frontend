import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from '@/composables/useTheme'
import { CATPPUCCIN_PALETTES } from '@/config/catppuccin'
import { PRESET_COLORS } from '@/config/theme'

function createTheme() {
  setActivePinia(createPinia())
  return useTheme()
}

describe('Catppuccin 主题风格', () => {
  beforeEach(() => {
    // 主题 store 绑定模块级 pinia，用例之间共享状态，先回到经典皮肤与默认主色
    const theme = createTheme()
    theme.setThemeId('classic', false)
    theme.setThemeMode('light', false)
    theme.setPrimaryColor('#5B6FF5', false)
    theme.setAppearance({ radius_card: undefined, radius_control: undefined }, false)
    document.documentElement.removeAttribute('data-theme-flavor')
    document.documentElement.style.cssText = ''
  })

  it('选择深色风味后写入风味标识、经典布局与对应色板', () => {
    const theme = createTheme()
    theme.setThemeId('catppuccin-mocha', false)

    const root = document.documentElement
    const palette = CATPPUCCIN_PALETTES.mocha
    expect(root.dataset.themeFlavor).toBe('mocha')
    // Catppuccin 只换配色，布局仍走经典皮肤
    expect(root.dataset.uiSkin).toBe('classic')
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(theme.themeMode.value).toBe('dark')
    expect(theme.themeFlavor.value).toBe('mocha')
    expect(theme.primaryColor.value).toBe(palette.mauve)
    expect(root.style.getPropertyValue('--ecl-canvas')).toBe(palette.crust)
    expect(root.style.getPropertyValue('--ecl-text')).toBe(palette.text)
    expect(root.style.getPropertyValue('--success')).toBe(palette.green)
    expect(theme.themeOverrides.value.common?.successColor).toBe(palette.green)
  })

  it('切回经典皮肤时清除 Catppuccin 令牌，避免残留上一风味的颜色', () => {
    const theme = createTheme()
    theme.setThemeId('catppuccin-frappe', false)
    expect(document.documentElement.style.getPropertyValue('--ecl-canvas')).not.toBe('')

    theme.setThemeId('classic', false)
    expect(document.documentElement.dataset.themeFlavor).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--ecl-canvas')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--glass-bg')).toBe('')
  })

  it('亮暗切换时换用 Latte 并把官方强调色换乘到 Latte 色板', () => {
    const theme = createTheme()
    theme.setThemeId('catppuccin-mocha', false)
    theme.setThemeMode('light', false)

    const root = document.documentElement
    expect(root.dataset.themeFlavor).toBe('latte')
    expect(root.style.getPropertyValue('--ecl-canvas')).toBe(CATPPUCCIN_PALETTES.latte.mantle)
    expect(theme.primaryColor.value).toBe(CATPPUCCIN_PALETTES.latte.mauve)
  })

  it('风味间切换保留用户自定义强调色', () => {
    const theme = createTheme()
    theme.setThemeId('catppuccin-mocha', false)
    theme.setPrimaryColor('#FF8800', false)
    theme.setThemeId('catppuccin-frappe', false)

    expect(theme.themeFlavor.value).toBe('frappe')
    expect(theme.primaryColor.value).toBe('#FF8800')
  })

  it('设置页强调色预设随风味切换，经典皮肤沿用项目预设', () => {
    const theme = createTheme()
    expect(theme.accentPresets.value).toEqual(PRESET_COLORS)

    theme.setThemeId('catppuccin-macchiato', false)
    expect(theme.accentPresets.value[0]).toEqual({ name: '淡紫', value: CATPPUCCIN_PALETTES.macchiato.mauve })
    expect(theme.accentPresets.value).toHaveLength(14)
  })

  it('切换主题时套用表面风格：Catppuccin 12px 圆角、无投影', () => {
    const theme = createTheme()
    theme.setThemeId('catppuccin-mocha', false)

    const root = document.documentElement
    expect(root.style.getPropertyValue('--ecl-card-radius')).toBe('12px')
    expect(root.style.getPropertyValue('--ecl-control-radius')).toBe('8px')
    expect(root.style.getPropertyValue('--ecl-card-shadow')).toBe('none')
    expect(theme.surfaceStyle.value.cardRadius).toBe(12)

    theme.setThemeId('classic', false)
    expect(root.style.getPropertyValue('--ecl-card-radius')).toBe('8px')
    expect(root.style.getPropertyValue('--ecl-card-shadow')).toBe('var(--ecl-shadow-surface)')
  })

  it('未自定义的圆角随主题切换，用户显式设置的圆角保留', () => {
    const theme = createTheme()
    const root = document.documentElement

    // 配置值等于经典预设 8px，视为没动过滑杆：切到 Catppuccin 后跟随 12px
    theme.setAppearance({ radius_card: 8 }, false)
    theme.setThemeId('catppuccin-mocha', false)
    expect(theme.appearance.value.radius_card).toBeUndefined()
    expect(root.style.getPropertyValue('--ecl-radius-card')).toBe('')

    // 用户显式改成 16px 后切回经典，覆盖值保留
    theme.setAppearance({ radius_card: 16 }, false)
    theme.setThemeId('classic', false)
    expect(theme.appearance.value.radius_card).toBe(16)
    expect(root.style.getPropertyValue('--ecl-radius-card')).toBe('16px')
  })
})
