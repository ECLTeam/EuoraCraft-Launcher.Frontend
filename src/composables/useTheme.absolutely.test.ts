import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from '@/composables/useTheme'
import { ABSOLUTELY_DARK, ABSOLUTELY_LIGHT } from '@/config/absolutely'

function createTheme() {
  setActivePinia(createPinia())
  return useTheme()
}

describe('Absolutely 主题风格', () => {
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

  it('深色下套用近黑画布、中性描边与自己的控件填充', () => {
    const theme = createTheme()
    theme.setThemeMode('dark', false)
    theme.setThemeId('absolutely', false)

    const root = document.documentElement
    expect(root.dataset.themePalette).toBe('absolutely')
    expect(root.dataset.themeFlavor).toBeUndefined()
    expect(root.dataset.uiSkin).toBe('classic')
    expect(root.style.getPropertyValue('--ecl-canvas')).toBe(ABSOLUTELY_DARK.canvas)
    expect(root.style.getPropertyValue('--ecl-border')).toBe(ABSOLUTELY_DARK.border)
    expect(root.style.getPropertyValue('--ecl-control-fill')).toBe(ABSOLUTELY_DARK.controlFill)
    expect(root.style.getPropertyValue('--ecl-card-radius')).toBe('10px')
    expect(theme.primaryColor.value).toBe(ABSOLUTELY_DARK.accent)
  })

  it('浅色下切到近白画布，且不改动亮暗模式', () => {
    const theme = createTheme()
    theme.setThemeMode('light', false)
    theme.setThemeId('absolutely', false)

    const root = document.documentElement
    expect(theme.themeMode.value).toBe('light')
    expect(root.style.getPropertyValue('--ecl-canvas')).toBe(ABSOLUTELY_LIGHT.canvas)
    expect(root.style.getPropertyValue('--ecl-control-fill')).toBe(ABSOLUTELY_LIGHT.controlFill)
    expect(theme.primaryColor.value).toBe(ABSOLUTELY_LIGHT.accent)
  })

  it('亮暗切换时同一主题换用另一套灰阶，默认强调色跟随换档', () => {
    const theme = createTheme()
    theme.setThemeId('absolutely', false)
    expect(theme.primaryColor.value).toBe(ABSOLUTELY_LIGHT.accent)

    theme.setThemeMode('dark', false)
    expect(document.documentElement.style.getPropertyValue('--ecl-canvas')).toBe(ABSOLUTELY_DARK.canvas)
    // 默认电光蓝分亮暗两档，切换外观时自动换乘
    expect(theme.primaryColor.value).toBe(ABSOLUTELY_DARK.accent)
  })

  it('用户自选强调色不随亮暗改动', () => {
    const theme = createTheme()
    theme.setThemeId('absolutely', false)
    theme.setPrimaryColor('#f43f5e', false)

    theme.setThemeMode('dark', false)
    expect(theme.primaryColor.value).toBe('#f43f5e')
  })

  it('切回经典皮肤时清除调色板变量，避免残留 Absolutely 灰阶', () => {
    const theme = createTheme()
    theme.setThemeId('absolutely', false)
    expect(document.documentElement.style.getPropertyValue('--ecl-canvas')).not.toBe('')

    theme.setThemeId('classic', false)
    expect(document.documentElement.dataset.themePalette).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--ecl-canvas')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--ecl-card-radius')).toBe('8px')
  })

  it('强调色预设使用 Absolutely 自己的色板，首项对应当前外观', () => {
    const theme = createTheme()
    theme.setThemeId('absolutely', false)
    expect(theme.accentPresets.value.length).toBeGreaterThanOrEqual(6)
    expect(theme.accentPresets.value[0]!.value).toBe(ABSOLUTELY_LIGHT.accent)

    theme.setThemeMode('dark', false)
    expect(theme.accentPresets.value[0]!.value).toBe(ABSOLUTELY_DARK.accent)
  })
})
