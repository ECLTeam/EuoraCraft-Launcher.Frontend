import { describe, expect, it } from 'vitest'
import {
  CATPPUCCIN_SURFACE_STYLE,
  CLASSIC_SURFACE_STYLE,
  surfaceStyleOf,
  surfaceStyleVariables,
  surfaceVariableNames,
} from './surface'

describe('主题表面风格', () => {
  it('经典与极光沿用既有几何，Catppuccin 使用扁平描边', () => {
    expect(surfaceStyleOf('classic')).toBe(CLASSIC_SURFACE_STYLE)
    expect(surfaceStyleOf('folia')).toBe(CLASSIC_SURFACE_STYLE)
    for (const flavor of ['latte', 'frappe', 'macchiato', 'mocha'] as const) {
      expect(surfaceStyleOf(`catppuccin-${flavor}`)).toBe(CATPPUCCIN_SURFACE_STYLE)
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

  it('表面风格映射到完整的内联变量清单', () => {
    const variables = surfaceStyleVariables(CATPPUCCIN_SURFACE_STYLE)
    expect(Object.keys(variables).sort()).toEqual([...surfaceVariableNames].sort())
    expect(variables['--ecl-card-radius']).toBe('12px')
    expect(variables['--ecl-control-radius']).toBe('8px')
    expect(variables['--ecl-card-shadow']).toBe('none')
  })
})
