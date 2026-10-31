import type { ThemeMode } from '@/composables/useTheme'
import { catppuccinFlavorOfThemeId, type CatppuccinFlavor } from './catppuccin'

export interface PresetColor {
  name: string
  value: string
}

export const PRESET_COLORS: PresetColor[] = [
  { name: 'ECL 蓝', value: '#5B6FF5' },
  { name: '天空蓝', value: '#5B9BD5' },
  { name: '薄荷绿', value: '#52A37F' },
  { name: '珊瑚橙', value: '#D4755B' },
  { name: '薰衣草', value: '#8B7FD9' },
  { name: '石墨灰', value: '#6A6D74' },
]

export const DEFAULT_PRIMARY_COLOR = '#5B6FF5'

export interface ThemeModeOption {
  value: ThemeMode
  icon: string
}

export const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  { value: 'light', icon: 'sun' },
  { value: 'dark', icon: 'moon' },
  { value: 'system', icon: 'settings' },
]

/** Catppuccin 主题风格标识，形如 `catppuccin-mocha`。 */
export type CatppuccinThemeId = `catppuccin-${CatppuccinFlavor}`

/** 内置主题风格：经典 / 极光 / Catppuccin 四风味。 */
export type BuiltinThemeId = 'classic' | 'folia' | CatppuccinThemeId

/** 内置主题风格选项；labelKey 指向 settings.* 下的界面名称。 */
export interface BuiltinThemeOption {
  id: BuiltinThemeId
  icon: string
  labelKey: string
}

export const BUILTIN_THEMES: BuiltinThemeOption[] = [
  { id: 'classic', icon: 'palette', labelKey: 'themeClassic' },
  { id: 'folia', icon: 'sparkles', labelKey: 'themeFolia' },
  { id: 'catppuccin-latte', icon: 'coffee', labelKey: 'themeCatppuccinLatte' },
  { id: 'catppuccin-frappe', icon: 'coffee', labelKey: 'themeCatppuccinFrappe' },
  { id: 'catppuccin-macchiato', icon: 'coffee', labelKey: 'themeCatppuccinMacchiato' },
  { id: 'catppuccin-mocha', icon: 'coffee', labelKey: 'themeCatppuccinMocha' },
]

export const BUILTIN_THEME_IDS: readonly BuiltinThemeId[] = BUILTIN_THEMES.map((option) => option.id)

/**
 * 判断任意值是否为受支持的内置主题风格。
 * @param value - 待校验的值，通常来自后端配置或界面选择
 * @returns 是内置主题风格标识时为 true
 */
export function isBuiltinThemeId(value: unknown): value is BuiltinThemeId {
  return typeof value === 'string' && (BUILTIN_THEME_IDS as readonly string[]).includes(value)
}

/**
 * 取主题风格对应的布局皮肤。
 *
 * Catppuccin 只替换配色，布局沿用经典皮肤；`data-ui-skin` 因此只写 classic/folia。
 * @param themeId - 主题风格标识
 * @returns 布局皮肤标识
 */
export function layoutSkinOf(themeId: BuiltinThemeId): 'classic' | 'folia' {
  return themeId === 'folia' ? 'folia' : 'classic'
}

/**
 * 解析主题风格在指定亮暗下实际使用的 Catppuccin 风味。
 *
 * 亮色统一使用 Latte，深色使用所选风味；所选风味为 Latte 时深色回退 Mocha。
 * @param themeId - 主题风格标识
 * @param isDark - 当前是否为深色外观
 * @returns 生效风味；非 Catppuccin 风格时为 null
 */
export function resolveCatppuccinFlavor(themeId: BuiltinThemeId, isDark: boolean): CatppuccinFlavor | null {
  const flavor = catppuccinFlavorOfThemeId(themeId)
  if (!flavor) return null
  if (!isDark) return 'latte'
  return flavor === 'latte' ? 'mocha' : flavor
}

/** 卡片不透明度滑杆边界（0-100）。 */
export const CARD_OPACITY_MIN = 20
export const CARD_OPACITY_MAX = 100
export const CARD_OPACITY_DEFAULT = 100

export interface FontFamilyOption {
  name: string
  value: string
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { name: '系统默认', value: '' },
  { name: 'HarmonyOS Sans SC', value: 'HarmonyOS Sans SC, system-ui, sans-serif' },
  { name: '微软雅黑', value: '"Microsoft YaHei", system-ui, sans-serif' },
  { name: '苹方', value: '"PingFang SC", system-ui, sans-serif' },
  { name: '思源黑体', value: '"Source Han Sans SC", "Noto Sans SC", system-ui, sans-serif' },
  { name: '等宽字体', value: '"JetBrains Mono", "Cascadia Code", Consolas, monospace' },
]

export interface ThemeColorPalette {
  success: string
  warning: string
  error: string
  info: string
  background: string
  backgroundHover: string
  surface: string
  cardBackground: string
  text: string
  textSecondary: string
  border: string
}

export const LIGHT_THEME_COLORS: ThemeColorPalette = {
  success: '#3E9B70',
  warning: '#D99532',
  error: '#D95763',
  info: '#5B6FF5',
  background: 'rgba(255,255,255,0.94)',
  backgroundHover: '#F0F3F8',
  surface: '#FFFFFF',
  cardBackground: 'rgba(255,255,255,0.88)',
  text: '#1D2433',
  textSecondary: '#596275',
  border: 'rgba(29,36,51,0.10)',
}

export const DARK_THEME_COLORS: ThemeColorPalette = {
  success: '#58B98A',
  warning: '#E5AA51',
  error: '#EB6B76',
  info: '#8291FF',
  background: 'rgba(34,38,48,0.94)',
  backgroundHover: '#2D323E',
  surface: '#222630',
  cardBackground: 'rgba(35,38,45,0.88)',
  text: '#F1F3F7',
  textSecondary: '#B4BBC9',
  border: 'rgba(255,255,255,0.09)',
}
