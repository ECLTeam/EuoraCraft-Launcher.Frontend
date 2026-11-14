import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from '@/composables/useTheme'
import { INKWHITE_DARK, INKWHITE_LIGHT } from '@/config/inkwhite'

function createTheme() {
  setActivePinia(createPinia())
  return useTheme()
}

describe('墨白主题风格', () => {
  beforeEach(() => {
    // 主题 store 绑定模块级 pinia，用例之间共享状态，先回到经典皮肤与默认主色
    const theme = createTheme()
    theme.setThemeId('classic', false)
    theme.setThemeMode('light', false)
    theme.setPrimaryColor('#5B6FF5', false)
    theme.setAppearance({ radius_card: undefined, radius_control: undefined }, false)
    document.documentElement.removeAttribute('data-theme-palette')
    document.documentElement.removeAttribute('data-theme-flavor')
    document.documentElement.style.cssText = ''
  })

  it('亮色套用浅灰画布、发丝描边与 14/10 圆角', () => {
    const theme = createTheme()
    theme.setThemeId('inkwhite', false)

    const root = document.documentElement
    expect(root.dataset.themePalette).toBe('inkwhite')
    expect(root.dataset.themeFlavor).toBeUndefined()
    expect(root.dataset.uiSkin).toBe('classic')
    expect(root.style.getPropertyValue('--ecl-canvas')).toBe(INKWHITE_LIGHT.canvas)
    expect(root.style.getPropertyValue('--ecl-border')).toBe(INKWHITE_LIGHT.border)
    expect(root.style.getPropertyValue('--ecl-control-fill')).toBe(INKWHITE_LIGHT.controlFill)
    expect(root.style.getPropertyValue('--ecl-card-radius')).toBe('14px')
    expect(root.style.getPropertyValue('--ecl-control-radius')).toBe('10px')
    // 默认主色按主题注册为站点近黑，而不是沿用进入前的项目蓝
    expect(theme.primaryColor.value).toBe(INKWHITE_LIGHT.accent)
  })

  it('深色保留近黑画布并把默认主色换成品牌蓝', () => {
    const theme = createTheme()
    theme.setThemeMode('dark', false)
    theme.setThemeId('inkwhite', false)

    const root = document.documentElement
    expect(theme.themeMode.value).toBe('dark')
    expect(root.style.getPropertyValue('--ecl-canvas')).toBe(INKWHITE_DARK.canvas)
    expect(root.style.getPropertyValue('--ecl-control-fill')).toBe(INKWHITE_DARK.controlFill)
    expect(theme.primaryColor.value).toBe(INKWHITE_DARK.accent)
  })

  it('亮暗切换时默认主色跟随换档，用户自选色不动', () => {
    const theme = createTheme()
    theme.setThemeId('inkwhite', false)
    expect(theme.primaryColor.value).toBe(INKWHITE_LIGHT.accent)

    theme.setThemeMode('dark', false)
    expect(theme.primaryColor.value).toBe(INKWHITE_DARK.accent)

    theme.setPrimaryColor('#10b981', false)
    theme.setThemeMode('light', false)
    expect(theme.primaryColor.value).toBe('#10b981')
  })

  it('强调色预设取站点色系，首项对应当前外观', () => {
    const theme = createTheme()
    theme.setThemeId('inkwhite', false)
    expect(theme.accentPresets.value.length).toBe(8)
    expect(theme.accentPresets.value.map((preset) => preset.value)).toContain('#00baff')
    expect(theme.accentPresets.value[0]!.value).toBe(INKWHITE_LIGHT.accent)

    theme.setThemeMode('dark', false)
    expect(theme.accentPresets.value[0]!.value).toBe(INKWHITE_DARK.accent)
  })

  it('近黑主色派生中性光斑，切回经典皮肤时清除调色板变量', () => {
    const theme = createTheme()
    theme.setThemeId('inkwhite', false)
    const inkwhiteAurora = document.documentElement.style.getPropertyValue('--aurora-c1')

    theme.setThemeId('absolutely', false)
    // 两支中性主题共用灰阶光斑，避免近黑主色派生出脏色光晕
    expect(inkwhiteAurora).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--aurora-c1')).toBe(inkwhiteAurora)

    theme.setThemeId('classic', false)
    expect(document.documentElement.dataset.themePalette).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--ecl-canvas')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--ecl-card-radius')).toBe('8px')
  })
})
