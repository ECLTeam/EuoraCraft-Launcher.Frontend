import { mix } from './color'
import type { ThemePaletteTokens } from './themePalette'

/**
 * 墨白配色：墨与白的两端，加一条品牌蓝。
 *
 * 纯白与近黑画布、发丝描边分层、几乎不用阴影，
 * 彩色只保留品牌蓝一支。亮色由近黑承担主操作，深色改用
 * 品牌蓝——近黑在 #0a0a0a 画布上不可见，且浅色主色会被按钮对比度算法压成中灰。
 */
export interface InkwhitePalette {
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
  /** 默认强调色（主操作色，亮暗不同） */
  accent: string
  /** 品牌蓝，供徽标等需要彩色区分的内容使用，不参与主色计算 */
  brand: string
  success: string
  warning: string
  error: string
}

export const INKWHITE_DARK: InkwhitePalette = {
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
  brand: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
}

export const INKWHITE_LIGHT: InkwhitePalette = {
  // 画布压到浅灰，白卡才有边界；站点是纯白底，但在密集列表里卡片会糊成一片
  canvas: '#f4f4f5',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  controlFill: '#ffffff',
  controlFillHover: '#f4f4f5',
  controlFillActive: '#e9e9eb',
  text: '#0a0a0a',
  textSecondary: '#52525b',
  textTertiary: '#71717a',
  border: '#e5e5e5',
  borderStrong: '#d4d4d8',
  divider: '#f0f0f0',
  accent: '#0a0a0a',
  brand: '#2563eb',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
}

/**
 * 取墨白在指定亮暗下的色板。
 * @param isDark - 是否为深色外观
 * @returns 对应的色板
 */
export function inkwhitePalette(isDark: boolean): InkwhitePalette {
  return isDark ? INKWHITE_DARK : INKWHITE_LIGHT
}

/**
 * 可选的强调色，取站点色系；首项为默认强调色。
 *
 * 前两项来自站点标题渐变的两端与主操作色，其余补齐冷暖和语义区分，避免默认
 * 主题下只剩黑白两色可选。
 */
export const INKWHITE_ACCENT_PRESETS = [
  { name: '石墨黑', value: '#0a0a0a' },
  { name: '品牌蓝', value: '#2563eb' },
  { name: '青蓝', value: '#00baff' },
  { name: '翠绿', value: '#10b981' },
  { name: '琥珀', value: '#f59e0b' },
  { name: '橙红', value: '#f97316' },
  { name: '玫红', value: '#f43f5e' },
  { name: '紫', value: '#a855f7' },
] as const

/**
 * 生成指定外观下的强调色预设。
 *
 * 首项「石墨黑」取该外观的默认强调色（浅色 #0a0a0a / 深色 #3b82f6），这样设置页
 * 的选中态能与实际生效的主色对上；其余色值亮暗共用。
 * @param isDark - 是否为深色外观
 * @returns 强调色预设列表
 */
export function inkwhiteAccentPresets(isDark: boolean): { name: string; value: string }[] {
  const accent = inkwhitePalette(isDark).accent
  return INKWHITE_ACCENT_PRESETS.map((preset, index) =>
    index === 0 ? { name: preset.name, value: accent } : { name: preset.name, value: preset.value }
  )
}

/**
 * 把墨白色板转换为共享语义令牌。
 *
 * 徽标统一走品牌蓝与语义色：亮色主色是近黑，若直接取 accent 会让四个加载器徽标
 * 全部变成深灰，失去辨识作用。
 * @param palette - 色板
 * @param isDark - 是否为深色外观
 * @returns 供 themePaletteVariables 使用的语义令牌
 */
export function inkwhitePaletteTokens(palette: InkwhitePalette, isDark: boolean): ThemePaletteTokens {
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
    info: palette.brand,
    raisedFill: palette.controlFillHover,
    // 站点卡片是实色，深浅都压到接近实色，只给用户滑杆留出下调空间
    surfaceOpacity: isDark ? 0.9 : 0.98,
    controlOpacity: isDark ? 0.96 : 1,
    badgeFabric: palette.warning,
    badgeForge: mix(palette.textSecondary, palette.brand, 0.6),
    badgeNeoForge: palette.brand,
    badgeQuilt: palette.success,
    sliderTrack: palette.controlFillActive,
    windowBorder: palette.border,
    windowButtonBorder: palette.divider,
  }
}
