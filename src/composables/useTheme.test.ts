import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { useTheme } from '@/composables/useTheme'
import { LIGHT_THEME_COLORS } from '@/config/theme'

describe('useTheme 语义色', () => {
  it('关闭额外毛玻璃层后背景模糊仍可调整，切换主题不覆盖数值', () => {
    setActivePinia(createPinia())
    const theme = useTheme()
    const root = document.documentElement

    theme.setThemeId('folia', false)
    theme.setBlurLayerEnabled(false)
    theme.setBlurAmount(12, false)
    expect(root.dataset.auroraBlur).toBe('0')
    expect(root.style.getPropertyValue('--bg-blur')).toBe('12px')

    theme.setThemeId('classic', false)
    expect(theme.blurAmount.value).toBe(12)
    expect(root.dataset.auroraBlur).toBe('0')
    expect(root.style.getPropertyValue('--bg-blur')).toBe('12px')

    theme.setBlurLayerEnabled(true)
    expect(root.style.getPropertyValue('--bg-blur')).toBe('12px')
    theme.setBlurAmount(0, false)
    expect(root.style.getPropertyValue('--bg-blur')).toBe('0px')
  })

  it('字体覆盖只作用于对应区域，清空后立即移除旧变量', () => {
    setActivePinia(createPinia())
    const theme = useTheme()
    const style = document.documentElement.style

    theme.setAppearance({ font_family: 'Microsoft YaHei', sidebar_font_family: 'SimSun' }, false)
    expect(style.getPropertyValue('--ecl-font-body')).toBe('"Microsoft YaHei", var(--font-body)')
    expect(style.getPropertyValue('--ecl-font-sidebar')).toBe('"SimSun", var(--ecl-font-body, var(--font-body))')
    expect(style.getPropertyValue('--ecl-font-terminal')).toBe('')
    expect(style.getPropertyValue('--ecl-font-log')).toBe('')

    theme.setAppearance({ terminal_font_family: 'Consolas', log_font_family: 'Cascadia Code' }, false)
    expect(style.getPropertyValue('--ecl-font-terminal')).toBe('"Consolas", var(--font-mono)')
    expect(style.getPropertyValue('--ecl-font-log')).toBe('"Cascadia Code", var(--font-mono)')

    theme.setAppearance(
      {
        font_family: undefined,
        sidebar_font_family: undefined,
        terminal_font_family: undefined,
        log_font_family: undefined,
      },
      false
    )
    for (const name of ['--ecl-font-body', '--ecl-font-sidebar', '--ecl-font-terminal', '--ecl-font-log']) {
      expect(style.getPropertyValue(name)).toBe('')
    }
  })

  it('配置外观后语义色仍回退到主题默认色而非自定义值', () => {
    setActivePinia(createPinia())
    const theme = useTheme()

    // 旧版支持自定义语义色（warning_color/info_color），已随主题重构移除；
    // 语义色现在统一回退到主题默认色
    theme.setAppearance({ radius_control: 4 }, false)

    const overrides = theme.themeOverrides.value
    expect(overrides.common).toBeDefined()
    expect(overrides.common!.warningColor).toBe(LIGHT_THEME_COLORS.warning)
    expect(overrides.common!.infoColor).toBe(LIGHT_THEME_COLORS.info)
    for (const color of [
      overrides.common!.successColor,
      overrides.common!.warningColor,
      overrides.common!.errorColor,
      overrides.common!.infoColor,
    ]) {
      expect(color).toBeTypeOf('string')
      expect(color).not.toContain('var(')
    }
  })

  it('未配置外观时语义色回退到主题默认色', () => {
    setActivePinia(createPinia())
    const theme = useTheme()

    theme.setAppearance({}, false)
    const overrides = theme.themeOverrides.value
    expect(overrides.common).toBeDefined()
    expect(overrides.common!.successColor).toBe(LIGHT_THEME_COLORS.success)
    expect(overrides.common!.warningColor).toBe(LIGHT_THEME_COLORS.warning)
    expect(overrides.common!.errorColor).toBe(LIGHT_THEME_COLORS.error)
    expect(overrides.common!.infoColor).toBe(LIGHT_THEME_COLORS.info)
    expect(overrides.common!.warningColor).not.toContain('var(')
  })

  it('视频背景保留独立的临时媒体地址与播放偏好', () => {
    setActivePinia(createPinia())
    const theme = useTheme()

    theme.setBackgroundVideo(
      'http://127.0.0.1:9527/background/token',
      'C:/background.mp4',
      {
        muted: false,
        volume: 0.35,
        fit: 'contain',
        pause_when_inactive: false,
      },
      '',
      false
    )

    expect(theme.backgroundMediaType.value).toBe('video')
    expect(theme.backgroundVideoPath.value).toBe('C:/background.mp4')
    expect(theme.backgroundVideoUrl.value).toContain('/background/token')
    expect(theme.backgroundVideo.value).toMatchObject({ muted: false, volume: 0.35, fit: 'contain' })
  })

  it('切换到视频后仍保留图片分支并可立即恢复', async () => {
    setActivePinia(createPinia())
    const theme = useTheme()
    theme.setBackgroundImage('data:image/png;base64,AA==', 'C:/background.png', false)
    theme.setBackgroundVideo('http://127.0.0.1:9527/background/token', 'C:/background.mp4', undefined, '', false)

    await theme.activateImageBackground()

    expect(theme.backgroundMediaType.value).toBe('image')
    expect(theme.backgroundImagePath.value).toBe('C:/background.png')
    expect(theme.backgroundImage.value).toContain('data:image/png;base64,AA==')
    expect(theme.backgroundVideoPath.value).toBe('C:/background.mp4')
  })
})
