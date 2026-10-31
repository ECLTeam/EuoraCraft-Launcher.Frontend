import type { BuiltinThemeId } from './theme'

/**
 * 主题表面风格：卡片、工具栏等面板的几何与层次，与配色一同由主题预设提供。
 *
 * 字段值一律写成 CSS 取值（可引用其他令牌），由 useTheme 写入 documentElement
 * 的内联变量；外观设置里的圆角滑杆通过 `--ecl-radius-*` 覆盖生效值。
 */
export interface ThemeSurfaceStyle {
  /** 卡片圆角（px） */
  cardRadius: number
  /** 控件圆角（px） */
  controlRadius: number
  /** 卡片描边宽度 */
  borderWidth: string
  /** 卡片描边颜色 */
  borderColor: string
  /** 悬停描边颜色 */
  borderColorHover: string
  /** 静态阴影 */
  shadow: string
  /** 悬停阴影 */
  shadowHover: string
  /** 顶部内高光，必须是合法的 shadow 值 */
  highlight: string
  /** 背景模糊 */
  backdrop: string
}

/**
 * 经典/极光皮肤的默认表面：保持既有观感，几何与颜色继续由 tokens.css 派生。
 */
export const CLASSIC_SURFACE_STYLE: ThemeSurfaceStyle = {
  cardRadius: 8,
  controlRadius: 6,
  borderWidth: '1px',
  borderColor: 'var(--ecl-border)',
  borderColorHover: 'var(--ecl-border-strong)',
  shadow: 'var(--ecl-shadow-surface)',
  shadowHover: 'var(--ecl-shadow-pop)',
  highlight: 'var(--glass-highlight)',
  backdrop: 'var(--ecl-surface-backdrop)',
}

/**
 * Catppuccin 表面：扁平描边——更大圆角、清晰描边、无投影、无白色内高光。
 */
export const CATPPUCCIN_SURFACE_STYLE: ThemeSurfaceStyle = {
  cardRadius: 12,
  controlRadius: 8,
  borderWidth: '1px',
  borderColor: 'var(--ecl-border)',
  borderColorHover: 'var(--ecl-border-strong)',
  shadow: 'none',
  shadowHover: 'none',
  highlight: 'inset 0 0 0 0 transparent',
  backdrop: 'none',
}

/**
 * 取主题对应的表面风格。
 *
 * 极光皮肤的玻璃观感由 folia.css 覆盖 `--ecl-surface` 实现，几何沿用经典皮肤。
 * @param themeId - 主题风格标识
 * @returns 该主题的表面风格
 */
export function surfaceStyleOf(themeId: BuiltinThemeId): ThemeSurfaceStyle {
  return themeId.startsWith('catppuccin-') ? CATPPUCCIN_SURFACE_STYLE : CLASSIC_SURFACE_STYLE
}

/** 表面风格写入的内联变量名；切换主题时按此清单逐项覆盖。 */
export const surfaceVariableNames = [
  '--ecl-card-radius',
  '--ecl-control-radius',
  '--ecl-card-border-width',
  '--ecl-card-border-color',
  '--ecl-card-border-color-hover',
  '--ecl-card-shadow',
  '--ecl-card-shadow-hover',
  '--ecl-card-highlight',
  '--ecl-card-backdrop',
] as const

/**
 * 把表面风格转换为内联变量表。
 * @param style - 主题表面风格
 * @returns 变量名到取值的映射
 */
export function surfaceStyleVariables(style: ThemeSurfaceStyle): Record<string, string> {
  return {
    '--ecl-card-radius': `${style.cardRadius}px`,
    '--ecl-control-radius': `${style.controlRadius}px`,
    '--ecl-card-border-width': style.borderWidth,
    '--ecl-card-border-color': style.borderColor,
    '--ecl-card-border-color-hover': style.borderColorHover,
    '--ecl-card-shadow': style.shadow,
    '--ecl-card-shadow-hover': style.shadowHover,
    '--ecl-card-highlight': style.highlight,
    '--ecl-card-backdrop': style.backdrop,
  }
}
