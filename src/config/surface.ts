import type { BuiltinThemeId } from './theme'
import { CATPPUCCIN_PALETTES, catppuccinFlavorOfThemeId, type CatppuccinFlavor } from './catppuccin'
import { absolutelyPalette } from './absolutely'

/**
 * 控件风格：按钮、输入框、选择器等交互控件的填充、描边与反馈。
 *
 * 与卡片风格分开描述，因为控件强调「可交互」——需要悬停、按下与焦点三态，
 * 而卡片只需要静态层次与悬停。字段缺省表示沿用配色层或 tokens.css 的默认值，
 * 便于主题只覆盖需要变化的维度。
 */
export interface ThemeControlStyle {
  /** 常态填充 */
  fill?: string
  /** 悬停填充 */
  fillHover?: string
  /** 按下填充 */
  fillActive?: string
  /** 常态描边 */
  borderColor?: string
  /** 悬停描边 */
  borderColorHover?: string
  /** 焦点描边 */
  borderColorFocus?: string
  /** 悬停外发光 */
  glow?: string
}

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
  /** 控件风格 */
  control: ThemeControlStyle
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
  control: {
    fill: 'var(--ecl-control-surface)',
    fillHover: 'var(--ecl-hover)',
    fillActive: 'var(--bg-active)',
    borderColor: 'var(--ecl-border)',
    borderColorHover: 'var(--border-hover)',
    borderColorFocus: 'var(--border-focus)',
    glow: 'none',
  },
}

/**
 * Catppuccin 表面：扁平描边——更大圆角、清晰描边、无投影、无白色内高光。
 * 控件用 surface0 填充、surface1 描边，悬停升一档，与卡片语言一致。
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
  control: {
    // 填充色在 surfaceStyleOf 里按风味从色板取 surface0/1/2，这里只声明描边与发光
    borderColor: 'var(--ecl-border)',
    borderColorHover: 'var(--ecl-border-strong)',
    borderColorFocus: 'var(--primary)',
    glow: 'none',
  },
}

/**
 * Absolutely 表面：绝对几何——中等圆角、清晰 1px 描边、无投影、无内高光。
 *
 * 控件填充随亮暗取该色板的近邻灰阶（深色 #1a1a1a / 浅色 #ffffff），悬停与
 * 按下逐级提亮或压深，靠明度差而不是阴影表达可交互性。
 * @param isDark - 是否为深色外观
 * @returns 该外观下的表面风格
 */
function absolutelySurfaceStyle(isDark: boolean): ThemeSurfaceStyle {
  const palette = absolutelyPalette(isDark)
  return {
    cardRadius: 10,
    controlRadius: 8,
    borderWidth: '1px',
    borderColor: 'var(--ecl-border)',
    borderColorHover: 'var(--ecl-border-strong)',
    shadow: 'none',
    shadowHover: 'none',
    highlight: 'inset 0 0 0 0 transparent',
    backdrop: 'none',
    control: {
      fill: palette.controlFill,
      fillHover: palette.controlFillHover,
      fillActive: palette.controlFillActive,
      borderColor: 'var(--ecl-border)',
      borderColorHover: 'var(--ecl-border-strong)',
      borderColorFocus: 'var(--primary)',
      glow: 'none',
    },
  }
}

/**
 * 由风味色板生成 Catppuccin 的控件风格。
 *
 * 控件比卡片高一档底色（surface0），悬停再升一档，这样按钮、输入框在卡片上
 * 仍有可辨识的边界，同时保持扁平、无投影。
 * @param flavor - Catppuccin 风味
 * @returns 该风味的表面风格
 */
function catppuccinSurfaceStyle(flavor: CatppuccinFlavor): ThemeSurfaceStyle {
  const palette = CATPPUCCIN_PALETTES[flavor]
  return {
    ...CATPPUCCIN_SURFACE_STYLE,
    control: {
      ...CATPPUCCIN_SURFACE_STYLE.control,
      fill: palette.surface0,
      fillHover: palette.surface1,
      fillActive: palette.surface2,
    },
  }
}

/** 风味到表面风格的静态映射；对象在模块加载时构建，引用保持稳定。 */
const catppuccinSurfaceStyles: Record<CatppuccinFlavor, ThemeSurfaceStyle> = {
  latte: catppuccinSurfaceStyle('latte'),
  frappe: catppuccinSurfaceStyle('frappe'),
  macchiato: catppuccinSurfaceStyle('macchiato'),
  mocha: catppuccinSurfaceStyle('mocha'),
}

/**
 * 取主题对应的表面风格。
 *
 * 极光皮肤的玻璃观感由 folia.css 覆盖 `--ecl-surface` 实现，几何沿用经典皮肤；
 * Absolutely 的控件填充随亮暗变化，因此需要传入当前外观。
 * @param themeId - 主题风格标识
 * @param isDark - 是否为深色外观
 * @returns 该主题的表面风格
 */
export function surfaceStyleOf(themeId: BuiltinThemeId, isDark: boolean): ThemeSurfaceStyle {
  if (themeId === 'absolutely') return absolutelySurfaceStyle(isDark)
  const flavor = catppuccinFlavorOfThemeId(themeId)
  if (flavor) return catppuccinSurfaceStyles[flavor]
  return CLASSIC_SURFACE_STYLE
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
  '--ecl-control-fill',
  '--ecl-control-fill-hover',
  '--ecl-control-fill-active',
  '--ecl-control-border-color',
  '--ecl-control-border-color-hover',
  '--ecl-control-border-color-focus',
  '--ecl-control-glow',
] as const

/**
 * 把表面风格转换为内联变量表。
 *
 * 控件风格中未定义的字段不会出现在结果里，避免把配色层提供的值覆盖成空。
 * @param style - 主题表面风格
 * @returns 变量名到取值的映射
 */
export function surfaceStyleVariables(style: ThemeSurfaceStyle): Record<string, string> {
  const variables: Record<string, string> = {
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
  const control = style.control
  if (control.fill) variables['--ecl-control-fill'] = control.fill
  if (control.fillHover) variables['--ecl-control-fill-hover'] = control.fillHover
  if (control.fillActive) variables['--ecl-control-fill-active'] = control.fillActive
  if (control.borderColor) variables['--ecl-control-border-color'] = control.borderColor
  if (control.borderColorHover) variables['--ecl-control-border-color-hover'] = control.borderColorHover
  if (control.borderColorFocus) variables['--ecl-control-border-color-focus'] = control.borderColorFocus
  if (control.glow) variables['--ecl-control-glow'] = control.glow
  return variables
}
