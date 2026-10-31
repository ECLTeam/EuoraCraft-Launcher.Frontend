import { describe, expect, it } from 'vitest'
import { ABSOLUTELY_DARK, ABSOLUTELY_LIGHT } from './absolutely'
import { CATPPUCCIN_PALETTES } from './catppuccin'
import {
  CATPPUCCIN_SURFACE_STYLE,
  CLASSIC_SURFACE_STYLE,
  surfaceStyleOf,
  surfaceStyleVariables,
  surfaceVariableNames,
} from './surface'

describe('主题表面风格', () => {
  it('经典与极光沿用既有几何，Catppuccin 使用扁平描边', () => {
    expect(surfaceStyleOf('classic', false)).toBe(CLASSIC_SURFACE_STYLE)
    expect(surfaceStyleOf('folia', true)).toBe(CLASSIC_SURFACE_STYLE)
    for (const flavor of ['latte', 'frappe', 'macchiato', 'mocha'] as const) {
      const style = surfaceStyleOf(`catppuccin-${flavor}`, flavor !== 'latte')
      expect(style.cardRadius).toBe(CATPPUCCIN_SURFACE_STYLE.cardRadius)
      expect(style.controlRadius).toBe(CATPPUCCIN_SURFACE_STYLE.controlRadius)
      expect(style.shadow).toBe(CATPPUCCIN_SURFACE_STYLE.shadow)
    }
  })

  it('Catppuccin 更大圆角、无投影、无白色内高光', () => {
    expect(CATPPUCCIN_SURFACE_STYLE.cardRadius).toBe(12)
    expect(CATPPUCCIN_SURFACE_STYLE.controlRadius).toBe(8)
    expect(CATPPUCCIN_SURFACE_STYLE.shadow).toBe('none')
    expect(CATPPUCCIN_SURFACE_STYLE.shadowHover).toBe('none')
    expect(CATPPUCCIN_SURFACE_STYLE.highlight).toBe('inset 0 0 0 0 transparent')
    expect(CATPPUCCIN_SURFACE_STYLE.backdrop).toBe('none')
  })

  it('经典表面保留投影与内高光，描边与颜色仍由令牌派生', () => {
    expect(CLASSIC_SURFACE_STYLE.cardRadius).toBe(8)
    expect(CLASSIC_SURFACE_STYLE.controlRadius).toBe(6)
    expect(CLASSIC_SURFACE_STYLE.shadow).toBe('var(--ecl-shadow-surface)')
    expect(CLASSIC_SURFACE_STYLE.highlight).toBe('var(--glass-highlight)')
    expect(CLASSIC_SURFACE_STYLE.borderColor).toBe('var(--ecl-border)')
  })

  it('Catppuccin 控件用该风味的 surface0/1/2 做三态填充', () => {
    const style = surfaceStyleOf('catppuccin-mocha', true)
    expect(style.control.fill).toBe(CATPPUCCIN_PALETTES.mocha.surface0)
    expect(style.control.fillHover).toBe(CATPPUCCIN_PALETTES.mocha.surface1)
    expect(style.control.fillActive).toBe(CATPPUCCIN_PALETTES.mocha.surface2)
    expect(style.control.borderColorFocus).toBe('var(--primary)')
    expect(style.control.glow).toBe('none')

    expect(surfaceStyleOf('catppuccin-latte', false).control.fill).toBe(CATPPUCCIN_PALETTES.latte.surface0)
  })

  it('Absolutely 控件填充随亮暗取该色板的近邻灰阶', () => {
    const dark = surfaceStyleOf('absolutely', true)
    const light = surfaceStyleOf('absolutely', false)
    expect(dark.control.fill).toBe(ABSOLUTELY_DARK.controlFill)
    expect(dark.control.fillHover).toBe(ABSOLUTELY_DARK.controlFillHover)
    expect(light.control.fill).toBe(ABSOLUTELY_LIGHT.controlFill)
    expect(light.control.fillHover).toBe(ABSOLUTELY_LIGHT.controlFillHover)
    // 绝对几何：中等圆角、无投影
    expect(dark.cardRadius).toBe(10)
    expect(dark.controlRadius).toBe(8)
    expect(dark.shadow).toBe('none')
  })

  it('经典控件沿用现有令牌，不改变既有观感', () => {
    expect(CLASSIC_SURFACE_STYLE.control.fill).toBe('var(--ecl-control-surface)')
    expect(CLASSIC_SURFACE_STYLE.control.fillHover).toBe('var(--ecl-hover)')
    expect(CLASSIC_SURFACE_STYLE.control.borderColorHover).toBe('var(--border-hover)')
    expect(CLASSIC_SURFACE_STYLE.control.borderColorFocus).toBe('var(--border-focus)')
  })

  it('表面风格映射到完整的内联变量清单', () => {
    const variables = surfaceStyleVariables(surfaceStyleOf('catppuccin-mocha', true))
    expect(Object.keys(variables).sort()).toEqual([...surfaceVariableNames].sort())
    expect(variables['--ecl-card-radius']).toBe('12px')
    expect(variables['--ecl-control-radius']).toBe('8px')
    expect(variables['--ecl-card-shadow']).toBe('none')
    expect(variables['--ecl-control-fill']).toBe(CATPPUCCIN_PALETTES.mocha.surface0)
  })

  it('控件风格缺省字段不写入变量表', () => {
    const variables = surfaceStyleVariables({
      ...CATPPUCCIN_SURFACE_STYLE,
      control: { borderColor: 'var(--ecl-border)' },
    })
    expect(variables['--ecl-control-border-color']).toBe('var(--ecl-border)')
    expect(variables['--ecl-control-fill']).toBeUndefined()
  })
})
