import { mix } from './color'
import type { ThemePaletteTokens } from './themePalette'

/**
 * Absolutely 配色：绝对中性。
 *
 * 灰阶不带色偏，只用一条高饱和强调色承担全部注意力；深色以近黑为底、
 * 浅色以近白为底，追求 Linear / Vercel 式的冷静与高对比。
 */
export interface AbsolutelyPalette {
  /** 页面画布 */
  canvas: string
  /** 卡片基色 */
  surface: string
  /** 次级面板基色 */
  surfaceMuted: string
  /** 控件常态填充 */
  controlFill: string
  /** 控件悬停填充 */
  controlFillHover: string
  /** 控件按下填充 */
  controlFillActive: string
  /** 主文字 */
  text: string
  /** 次要文字 */
  textSecondary: string
  /** 三级文字 */
  textTertiary: string
  /** 常态描边 */
  border: string
  /** 强调描边 */
  borderStrong: string
  /** 分隔线 */
  divider: string
  /** 默认强调色 */
  accent: string
  success: string
  warning: string
  error: string
}

export const ABSOLUTELY_DARK: AbsolutelyPalette = {
  canvas: '#0a0a0a',
  surface: '#111111',
  surfaceMuted: '#171717',
  controlFill: '#1a1a1a',
  controlFillHover: '#242424',
  controlFillActive: '#2e2e2e',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',
  border: '#262626',
  borderStrong: '#3f3f46',
  divider: '#1f1f1f',
  accent: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
}

export const ABSOLUTELY_LIGHT: AbsolutelyPalette = {
  // 灰底白卡：画布压到明显的中性灰，白色卡片才有边界，避免和经典亮色混淆
  canvas: '#e7e7ea',
  surface: '#ffffff',
  surfaceMuted: '#f2f2f4',
  controlFill: '#ffffff',
  controlFillHover: '#f1f1f3',
  controlFillActive: '#e3e3e6',
  text: '#0a0a0a',
  textSecondary: '#46464e',
  textTertiary: '#7c7c86',
  // 描边比经典亮色更实，扁平风格下承担主要分层
  border: '#d5d5da',
  borderStrong: '#bdbdc4',
  divider: '#e6e6e9',
  accent: '#2563eb',
  success: '#15803d',
  warning: '#b45309',
  error: '#dc2626',
}

/**
 * 取 Absolutely 在指定亮暗下的色板。
 * @param isDark - 是否为深色外观
 * @returns 对应的色板
 */
export function absolutelyPalette(isDark: boolean): AbsolutelyPalette {
  return isDark ? ABSOLUTELY_DARK : ABSOLUTELY_LIGHT
}

/** 可选的强调色，按「冷 → 暖」排列；首项为默认强调色。 */
export const ABSOLUTELY_ACCENT_PRESETS = [
  { name: '电光蓝', value: '#3b82f6' },
  { name: '靛蓝', value: '#6366f1' },
  { name: '青', value: '#06b6d4' },
  { name: '翠绿', value: '#10b981' },
  { name: '琥珀', value: '#f59e0b' },
  { name: '橙红', value: '#f97316' },
  { name: '玫红', value: '#f43f5e' },
  { name: '紫', value: '#a855f7' },
] as const

/**
 * 生成指定外观下的强调色预设。
 *
 * 首项「电光蓝」取该外观色板里的强调色（浅色 #2563eb / 深色 #3b82f6），
 * 这样设置页的选中态能与实际生效的主色对上；其余色值亮暗共用。
 * @param isDark - 是否为深色外观
 * @returns 强调色预设列表
 */
export function absolutelyAccentPresets(isDark: boolean): { name: string; value: string }[] {
  const accent = absolutelyPalette(isDark).accent
  return ABSOLUTELY_ACCENT_PRESETS.map((preset, index) =>
    index === 0 ? { name: preset.name, value: accent } : { name: preset.name, value: preset.value }
  )
}

/**
 * 把 Absolutely 色板转换为共享语义令牌。
 * @param palette - 色板
 * @param isDark - 是否为深色外观
 * @returns 供 themePaletteVariables 使用的语义令牌
 */
export function absolutelyPaletteTokens(palette: AbsolutelyPalette, isDark: boolean): ThemePaletteTokens {
  return {
    canvas: palette.canvas,
    base: palette.surface,
    mutedBase: palette.surfaceMuted,
    text: palette.text,
    textSecondary: palette.textSecondary,
    textTertiary: palette.textTertiary,
    border: palette.border,
    borderStrong: palette.borderStrong,
    divider: palette.divider,
    shadowTint: isDark ? '#000000' : palette.text,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    info: palette.accent,
    raisedFill: palette.controlFillHover,
    // 浅色档把表面压到接近实色：88% 白叠在灰底上会被染灰、发闷
    surfaceOpacity: isDark ? 0.88 : 0.98,
    controlOpacity: isDark ? 0.94 : 1,
    // 徽标沿用语义色，保持「一条强调色 + 语义色」的克制
    badgeFabric: palette.warning,
    badgeForge: mix(palette.textSecondary, palette.accent, 0.55),
    badgeNeoForge: palette.accent,
    badgeQuilt: palette.success,
    sliderTrack: palette.controlFillActive,
    windowBorder: palette.border,
    windowButtonBorder: palette.divider,
  }
}
