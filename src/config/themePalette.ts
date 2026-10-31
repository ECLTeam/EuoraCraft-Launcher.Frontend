import { rgba, rgbaSurface } from './color'

/**
 * 主题调色板的语义令牌：配色方案只负责给出这组语义色，具体 CSS 变量由
 * themePaletteVariables 统一推导，避免每个主题各写一套映射逻辑。
 */
export interface ThemePaletteTokens {
  /** 页面画布底色 */
  canvas: string
  /** 卡片与面板基色 */
  base: string
  /** 次级面板基色（已混合完成，直接使用） */
  mutedBase: string
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
  /** 阴影基色 */
  shadowTint: string
  /** 成功色 */
  success: string
  /** 警告色 */
  warning: string
  /** 错误色 */
  error: string
  /** 信息色（naive-ui 的 info，通常取强调色） */
  info: string
  /** 浮起表面填充（悬停底色、滑杆轨道等） */
  raisedFill: string
  /** 模组加载器徽标配色 */
  badgeFabric: string
  badgeForge: string
  badgeNeoForge: string
  badgeQuilt: string
  /** 滑杆轨道 */
  sliderTrack: string
  /** 窗口外框 */
  windowBorder: string
  /** 窗口按钮描边 */
  windowButtonBorder: string
}

/** 调色板写入的内联变量名；切换主题时按此清单逐项覆盖。 */
export const themePaletteVariableNames = [
  '--ecl-canvas',
  '--ecl-surface',
  '--ecl-surface-muted',
  '--ecl-control-surface',
  '--ecl-text',
  '--ecl-text-secondary',
  '--ecl-text-tertiary',
  '--ecl-border',
  '--ecl-border-strong',
  '--ecl-hover',
  '--ecl-hover-strong',
  '--ecl-shadow-surface',
  '--ecl-shadow-pop',
  '--ecl-badge-fabric-fg',
  '--ecl-badge-forge-fg',
  '--ecl-badge-neoforge-fg',
  '--ecl-badge-quilt-fg',
  '--bg-surface-solid',
  '--glass-bg',
  '--glass-bg-sidebar',
  '--glass-border',
  '--glass-divider',
  '--divider',
  '--text-disabled',
  '--border-strong',
  '--shadow-xs',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-xl',
  '--shadow-hover',
  '--shadow-card',
  '--success',
  '--success-alpha',
  '--warning',
  '--warning-alpha',
  '--error',
  '--error-alpha',
  '--slider-track',
  '--window-border',
  '--window-btn-border',
  '--bg-overlay-tint',
] as const

/**
 * 由语义令牌推导全部配色变量。
 *
 * 表面色沿用 tokens.css 的不透明度语义（卡片 0.88、控件 0.94），阴影与语义色
 * 的透明度按亮暗分别取值，保证浅色背景上仍有层次、深色背景上不糊成一片。
 * @param tokens - 主题语义令牌
 * @param isDark - 是否为深色外观
 * @returns 变量名到取值的映射
 */
export function themePaletteVariables(tokens: ThemePaletteTokens, isDark: boolean): Record<string, string> {
  const shadowScale = isDark ? [0.35, 0.4, 0.45, 0.5, 0.55, 0.45] : [0.05, 0.07, 0.09, 0.12, 0.15, 0.1]
  const semanticAlpha = isDark ? 0.16 : 0.12
  const shadowTint = tokens.shadowTint

  return {
    '--ecl-canvas': tokens.canvas,
    '--ecl-surface': rgbaSurface(tokens.base, 0.88),
    '--ecl-surface-muted': rgbaSurface(tokens.mutedBase, 0.88),
    '--ecl-control-surface': rgbaSurface(tokens.base, 0.94),
    '--ecl-text': tokens.text,
    '--ecl-text-secondary': tokens.textSecondary,
    '--ecl-text-tertiary': tokens.textTertiary,
    '--ecl-border': tokens.border,
    '--ecl-border-strong': tokens.borderStrong,
    '--ecl-hover': rgba(tokens.text, 0.06),
    '--ecl-hover-strong': rgba(tokens.text, 0.1),
    '--ecl-shadow-surface': `0 1px 2px ${rgba(shadowTint, shadowScale[0]!)}`,
    '--ecl-shadow-pop': `0 8px 24px ${rgba(shadowTint, isDark ? 0.7 : 0.12)}`,
    '--ecl-badge-fabric-fg': tokens.badgeFabric,
    '--ecl-badge-forge-fg': tokens.badgeForge,
    '--ecl-badge-neoforge-fg': tokens.badgeNeoForge,
    '--ecl-badge-quilt-fg': tokens.badgeQuilt,
    '--bg-surface-solid': tokens.base,
    '--glass-bg': rgbaSurface(tokens.base, 0.92),
    '--glass-bg-sidebar': rgbaSurface(isDark ? tokens.mutedBase : tokens.base, 0.96),
    '--glass-border': tokens.border,
    '--glass-divider': tokens.divider,
    '--divider': tokens.divider,
    '--text-disabled': tokens.textTertiary,
    '--border-strong': tokens.borderStrong,
    '--shadow-xs': `0 1px 2px ${rgba(shadowTint, shadowScale[0]!)}`,
    '--shadow-sm': `0 2px 6px ${rgba(shadowTint, shadowScale[1]!)}`,
    '--shadow-md': `0 8px 24px ${rgba(shadowTint, shadowScale[2]!)}`,
    '--shadow-lg': `0 14px 40px ${rgba(shadowTint, shadowScale[3]!)}`,
    '--shadow-xl': `0 20px 60px ${rgba(shadowTint, shadowScale[4]!)}`,
    '--shadow-hover': `0 8px 22px ${rgba(shadowTint, shadowScale[5]!)}`,
    '--shadow-card': `0 1px 2px ${rgba(shadowTint, shadowScale[0]!)}`,
    '--success': tokens.success,
    '--success-alpha': rgba(tokens.success, semanticAlpha),
    '--warning': tokens.warning,
    '--warning-alpha': rgba(tokens.warning, semanticAlpha),
    '--error': tokens.error,
    '--error-alpha': rgba(tokens.error, semanticAlpha),
    '--slider-track': tokens.sliderTrack,
    '--window-border': tokens.windowBorder,
    '--window-btn-border': tokens.windowButtonBorder,
    '--bg-overlay-tint': rgba(tokens.canvas, 0.12),
  }
}
