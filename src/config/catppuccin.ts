/**
 * Catppuccin 官方配色（Latte / Frappe / Macchiato / Mocha）。
 *
 * 数值取自 Catppuccin 标准 26 色色板，皮肤变量、naive-ui 语义色与强调色预设
 * 共用同一份数据，避免多处手写十六进制造成漂移。
 */
import { mix } from './color'
import type { ThemePaletteTokens } from './themePalette'

/** Catppuccin 风味标识；latte 为亮色，其余三个为深色。 */
export type CatppuccinFlavor = 'latte' | 'frappe' | 'macchiato' | 'mocha'

export const CATPPUCCIN_FLAVORS: readonly CatppuccinFlavor[] = ['latte', 'frappe', 'macchiato', 'mocha']

export interface CatppuccinPalette {
  rosewater: string
  flamingo: string
  pink: string
  mauve: string
  red: string
  maroon: string
  peach: string
  yellow: string
  green: string
  teal: string
  sky: string
  sapphire: string
  blue: string
  lavender: string
  text: string
  subtext1: string
  subtext0: string
  overlay2: string
  overlay1: string
  overlay0: string
  surface2: string
  surface1: string
  surface0: string
  base: string
  mantle: string
  crust: string
}

export const CATPPUCCIN_PALETTES: Record<CatppuccinFlavor, CatppuccinPalette> = {
  latte: {
    rosewater: '#dc8a78',
    flamingo: '#dd7878',
    pink: '#ea76cb',
    mauve: '#8839ef',
    red: '#d20f39',
    maroon: '#e64553',
    peach: '#fe640b',
    yellow: '#df8e1d',
    green: '#40a02b',
    teal: '#179299',
    sky: '#04a5e5',
    sapphire: '#209fb5',
    blue: '#1e66f5',
    lavender: '#7287fd',
    text: '#4c4f69',
    subtext1: '#5c5f77',
    subtext0: '#6c6f85',
    overlay2: '#7c7f93',
    overlay1: '#8c8fa1',
    overlay0: '#9ca0b0',
    surface2: '#acb0be',
    surface1: '#bcc0cc',
    surface0: '#ccd0da',
    base: '#eff1f5',
    mantle: '#e6e9ef',
    crust: '#dce0e8',
  },
  frappe: {
    rosewater: '#f2d5cf',
    flamingo: '#eebebe',
    pink: '#f4b8e4',
    mauve: '#ca9ee6',
    red: '#e78284',
    maroon: '#ea999c',
    peach: '#ef9f76',
    yellow: '#e5c890',
    green: '#a6d189',
    teal: '#81c8be',
    sky: '#99d1db',
    sapphire: '#85c1dc',
    blue: '#8caaee',
    lavender: '#babbf1',
    text: '#c6d0f5',
    subtext1: '#b5bfe2',
    subtext0: '#a5adce',
    overlay2: '#949cbb',
    overlay1: '#838ba7',
    overlay0: '#737994',
    surface2: '#626880',
    surface1: '#51576d',
    surface0: '#414559',
    base: '#303446',
    mantle: '#292c3c',
    crust: '#232634',
  },
  macchiato: {
    rosewater: '#f4dbd6',
    flamingo: '#f0c6c6',
    pink: '#f5bde6',
    mauve: '#c6a0f6',
    red: '#ed8796',
    maroon: '#ee99a0',
    peach: '#f5a97f',
    yellow: '#eed49f',
    green: '#a6da95',
    teal: '#8bd5ca',
    sky: '#91d7e3',
    sapphire: '#7dc4e4',
    blue: '#8aadf4',
    lavender: '#b7bdf8',
    text: '#cad3f5',
    subtext1: '#b8c0e0',
    subtext0: '#a5adcb',
    overlay2: '#939ab7',
    overlay1: '#8087a2',
    overlay0: '#6e738d',
    surface2: '#5b6078',
    surface1: '#494d64',
    surface0: '#363a4f',
    base: '#24273a',
    mantle: '#1e2030',
    crust: '#181926',
  },
  mocha: {
    rosewater: '#f5e0dc',
    flamingo: '#f2cdcd',
    pink: '#f5c2e7',
    mauve: '#cba6f7',
    red: '#f38ba8',
    maroon: '#eba0ac',
    peach: '#fab387',
    yellow: '#f9e2af',
    green: '#a6e3a1',
    teal: '#94e2d5',
    sky: '#89dceb',
    sapphire: '#74c7ec',
    blue: '#89b4fa',
    lavender: '#b4befe',
    text: '#cdd6f4',
    subtext1: '#bac2de',
    subtext0: '#a6adc8',
    overlay2: '#9399b2',
    overlay1: '#7f849c',
    overlay0: '#6c7086',
    surface2: '#585b70',
    surface1: '#45475a',
    surface0: '#313244',
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
  },
}

/** 可作为强调色的官方色键，顺序即设置页色点顺序（Mauve 为默认强调色）。 */
export const CATPPUCCIN_ACCENT_KEYS = [
  'mauve',
  'blue',
  'sapphire',
  'lavender',
  'teal',
  'green',
  'peach',
  'yellow',
  'pink',
  'flamingo',
  'rosewater',
  'red',
  'maroon',
  'sky',
] as const

export type CatppuccinAccentKey = (typeof CATPPUCCIN_ACCENT_KEYS)[number]

/** 强调色的界面名称，随色板语言保持中文。 */
const accent_labels: Record<CatppuccinAccentKey, string> = {
  mauve: '淡紫',
  blue: '蓝',
  sapphire: '蓝宝石',
  lavender: '薰衣草',
  teal: '青',
  green: '绿',
  peach: '蜜桃',
  yellow: '黄',
  pink: '粉',
  flamingo: '火烈鸟',
  rosewater: '玫瑰水',
  red: '红',
  maroon: '栗',
  sky: '天蓝',
}

export interface CatppuccinAccentPreset {
  name: string
  value: string
}

/**
 * 判断任意值是否为 Catppuccin 风味标识。
 * @param value - 待校验的值
 * @returns 是风味标识时为 true
 */
export function isCatppuccinFlavor(value: unknown): value is CatppuccinFlavor {
  return typeof value === 'string' && (CATPPUCCIN_FLAVORS as readonly string[]).includes(value)
}

/**
 * 从主题风格标识中解析 Catppuccin 风味。
 * @param themeId - 形如 `catppuccin-mocha` 的主题风格标识
 * @returns 对应的风味；非 Catppuccin 风格时为 null
 */
export function catppuccinFlavorOfThemeId(themeId: string): CatppuccinFlavor | null {
  const prefix = 'catppuccin-'
  if (!themeId.startsWith(prefix)) return null
  const flavor = themeId.slice(prefix.length)
  return isCatppuccinFlavor(flavor) ? flavor : null
}

/**
 * 生成指定风味的强调色预设，供设置页色点与主色回退使用。
 * @param flavor - Catppuccin 风味
 * @returns 该风味的官方强调色列表
 */
export function catppuccinAccentPresets(flavor: CatppuccinFlavor): CatppuccinAccentPreset[] {
  const palette = CATPPUCCIN_PALETTES[flavor]
  return CATPPUCCIN_ACCENT_KEYS.map((key) => ({ name: accent_labels[key], value: palette[key] }))
}

/**
 * 把 Catppuccin 色板转换为共享语义令牌。
 *
 * 次级面板在 base 与 surface0 之间取中间值，让面板与卡片仍有层次；描边用
 * surface1/surface2 这一官方层级，比半透明文字色更清晰。
 * @param palette - 风味色板
 * @param isDark - 是否为深色外观
 * @returns 供 themePaletteVariables 使用的语义令牌
 */
export function catppuccinPaletteTokens(palette: CatppuccinPalette, isDark: boolean): ThemePaletteTokens {
  return {
    canvas: isDark ? palette.crust : palette.mantle,
    base: palette.base,
    mutedBase: mix(palette.base, palette.surface0, isDark ? 0.55 : 0.6),
    text: palette.text,
    textSecondary: palette.subtext0,
    textTertiary: isDark ? palette.overlay2 : palette.overlay1,
    border: palette.surface1,
    borderStrong: palette.surface2,
    divider: palette.surface0,
    shadowTint: isDark ? palette.crust : palette.text,
    success: palette.green,
    warning: palette.yellow,
    error: palette.red,
    info: palette.blue,
    raisedFill: palette.surface0,
    badgeFabric: palette.yellow,
    badgeForge: palette.lavender,
    badgeNeoForge: palette.blue,
    badgeQuilt: palette.green,
    sliderTrack: isDark ? palette.surface1 : palette.surface0,
    windowBorder: palette.surface1,
    windowButtonBorder: palette.surface0,
  }
}

/**
 * 把强调色换成目标风味中的同名官方色。
 *
 * 亮暗切换会更换生效风味（Latte ↔ 深色风味），深色风味的浅紫直接放在 Latte
 * 背景上对比度不足，因此官方色需要随风味换乘；用户自定义色不在任何色板中，
 * 保持原值不动。
 * @param color - 当前强调色（十六进制）
 * @param to - 目标风味
 * @returns 目标风味中的同名强调色；当前色不是官方强调色时为 null
 */
export function translateAccentColor(color: string, to: CatppuccinFlavor): string | null {
  const normalized = color.trim().toLowerCase()
  if (!normalized) return null
  for (const flavor of CATPPUCCIN_FLAVORS) {
    const palette = CATPPUCCIN_PALETTES[flavor]
    const key = CATPPUCCIN_ACCENT_KEYS.find((candidate) => palette[candidate].toLowerCase() === normalized)
    if (key) return CATPPUCCIN_PALETTES[to][key]
  }
  return null
}
