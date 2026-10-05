import {
  argbFromHex,
  hexFromArgb,
  sourceColorFromImage,
  themeFromSourceColor,
} from '@material/material-color-utilities'
import { darkTheme, type GlobalTheme, type GlobalThemeOverrides } from 'naive-ui'
import { defineStore, storeToRefs } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { pinia } from '@/app/stores'
import {
  CARD_OPACITY_DEFAULT,
  DEFAULT_PRIMARY_COLOR,
  DARK_THEME_COLORS,
  LIGHT_THEME_COLORS,
  PRESET_COLORS,
} from '@/config/theme'
import { resolveLocalImageUrl, settingsApi } from '@/features/settings/api/settingsApi'
import {
  BACKGROUND_INTERVAL_DEFAULT,
  clampBackgroundInterval,
  isCarouselMode,
  nextBackgroundIndex,
  type BackgroundMode,
} from '@/features/settings/model/backgroundMode'
import { resolveNavigationMode } from '@/features/settings/model/navigation'
import type {
  BackgroundConfig,
  BackgroundImageConfig,
  BackgroundVideoConfig,
  BackgroundVideoSource,
  NavigationMode,
  ThemeAppearanceConfig,
  ThemeConfig,
  ThemeScheduleConfig,
} from '@/types/config'
import { resolveFontFamily } from '@/utils/fontFamily'

interface ThemeInitPayload {
  theme?: Partial<ThemeConfig>
  background?: Partial<BackgroundConfig>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeVideoConfig(value: BackgroundVideoConfig | undefined): Required<BackgroundVideoConfig> {
  return {
    paused: value?.paused === true,
    muted: value?.muted !== false,
    volume: clamp(typeof value?.volume === 'number' ? value.volume : 0, 0, 1),
    fit: value?.fit === 'contain' ? 'contain' : 'cover',
    pause_when_inactive: value?.pause_when_inactive !== false,
  }
}

function readImageBackground(background: Partial<BackgroundConfig>): BackgroundImageConfig {
  if (background.image) return background.image
  return {
    type: background.type,
    path: background.path,
    image_base64: background.image_base64,
    mode: background.mode,
    interval: background.interval,
    urls: background.urls,
  }
}

function readVideoBackground(background: Partial<BackgroundConfig>): BackgroundVideoSource {
  const video = background.video as unknown
  if (video && typeof video === 'object' && ('path' in video || 'options' in video)) {
    return video as BackgroundVideoSource
  }
  return {
    path: background.media_type === 'video' ? background.path : undefined,
    poster_path: background.media_type === 'video' ? background.poster_path : undefined,
    options: video as BackgroundVideoConfig | undefined,
  }
}

function normalizeHex(hex: string): string {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return `#${hex}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = normalizeHex(hex)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) throw new Error('Invalid hex color')

  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

function mix(color1: string, color2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  const w = clamp(weight, 0, 1)
  const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w)
  const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w)
  const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w)

  return rgbToHex(r, g, b)
}

function rgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h * 360, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360
  let r = 0
  let g = 0
  let b = 0
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/** 色相偏移；用于浅色模式极光辅色。 */
function shiftHue(hex: string, degrees: number): string {
  const rgb = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const [r, g, b] = hslToRgb((h + degrees + 360) % 360, s, l)
  return rgbToHex(r, g, b)
}

/** 色相偏移 + 降饱和 + 指定亮度（深色模式极光辅色，避免亮色刺眼）。 */
function shiftHueSlim(hex: string, degrees: number, satScale: number, targetLightness: number): string {
  const rgb = hexToRgb(hex)
  const [h, s] = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const [r, g, b] = hslToRgb((h + degrees + 360) % 360, Math.min(1, s * satScale), targetLightness)
  return rgbToHex(r, g, b)
}

/** 保留色相，降饱和并压暗到指定亮度（深色模式极光主色）。 */
function dimForDark(hex: string, satScale: number, targetLightness: number): string {
  const rgb = hexToRgb(hex)
  const [h, s] = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const [r, g, b] = hslToRgb(h, Math.min(1, s * satScale), targetLightness)
  return rgbToHex(r, g, b)
}

/**
 * 由主色派生极光光斑三色（主色 + 色相偏移的两个辅色），明暗模式不同强度。
 * 深色模式采用「低调淡光」：低透明度、降饱和、压暗亮度，避免亮色刺眼。对齐 fork useTheme.ts。
 */
function createAuroraColors(baseColor: string, isDark: boolean): { c1: string; c2: string; c3: string } {
  const color = /^#([a-f\d]{6})$/i.test(normalizeHex(baseColor)) ? normalizeHex(baseColor) : DEFAULT_PRIMARY_COLOR
  if (isDark) {
    return {
      c1: rgba(dimForDark(color, 0.9, 0.32), 0.3),
      c2: rgba(shiftHueSlim(color, 45, 0.6, 0.34), 0.24),
      c3: rgba(shiftHueSlim(color, -35, 0.55, 0.3), 0.18),
    }
  }
  return {
    c1: rgba(color, 0.12),
    c2: rgba(shiftHue(color, 45), 0.1),
    c3: rgba(shiftHue(color, -35), 0.085),
  }
}

/**
 * 从图片 URL 提取主色：canvas 缩略图 + HSL 色相聚类。
 * 跳过近灰/极暗/极亮像素，取像素数最多的色相桶平均色；失败返回 null（功能降级）。对齐 fork useTheme.ts。
 */
function extractPrimaryFromImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const size = 48
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = Math.max(1, Math.round((size * image.naturalHeight) / Math.max(1, image.naturalWidth)))
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          resolve(null)
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
        const buckets = new Map<number, { r: number; g: number; b: number; n: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!
          const g = data[i + 1]!
          const b = data[i + 2]!
          const a = data[i + 3]!
          if (a < 128) continue
          const [h, s, l] = rgbToHsl(r, g, b)
          if (s < 0.15 || l < 0.12 || l > 0.88) continue
          const hueBucket = Math.floor(h / 30)
          const bucket = buckets.get(hueBucket) ?? { r: 0, g: 0, b: 0, n: 0 }
          bucket.r += r
          bucket.g += g
          bucket.b += b
          bucket.n += 1
          buckets.set(hueBucket, bucket)
        }
        let best: { r: number; g: number; b: number; n: number } | null = null
        for (const bucket of buckets.values()) {
          if (!best || bucket.n > best.n) best = bucket
        }
        if (!best || best.n < 2) {
          resolve(null)
          return
        }
        resolve(rgbToHex(Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)))
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/** 从图片提取 Monet 种子色（Material You，基于 HCT 色彩空间）。 */
function monetSeedFromImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = async () => {
      try {
        const argb = await sourceColorFromImage(image)
        resolve(hexFromArgb(argb))
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/** Monet tonal 色板缓存：相同种子色复用主题对象，避免重复计算 Material You 调色板。 */
let monetPaletteCache: { seed: string; palette: { tone(tone: number): number } } | null = null

function monetTone(seedHex: string, tone: number): string {
  if (!monetPaletteCache || monetPaletteCache.seed !== seedHex) {
    const theme = themeFromSourceColor(argbFromHex(seedHex))
    monetPaletteCache = { seed: seedHex, palette: theme.palettes.primary }
  }
  return hexFromArgb(monetPaletteCache.palette.tone(tone))
}

/** 根据 Monet 种子色生成完整 Material You tonal 色阶（明暗各用 tone 40/80、30/90、20/95）。 */
function createMonetScale(
  seedHex: string,
  isDark: boolean
): {
  primary: string
  primaryHover: string
  primaryPressed: string
  primaryLight: string
  primaryRgb: string
} {
  const primary = monetTone(seedHex, isDark ? 80 : 40)
  const rgb = hexToRgb(primary)
  return {
    primary,
    primaryHover: monetTone(seedHex, isDark ? 90 : 30),
    primaryPressed: monetTone(seedHex, isDark ? 95 : 20),
    primaryLight: rgba(primary, 0.15),
    primaryRgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
  }
}

/** 解析 'HH:MM' 为当天分钟数；非法输入返回 -1。 */
function parseTimeMinutes(value: string | undefined): number {
  if (!value) return -1
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return -1
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return -1
  return hours * 60 + minutes
}

const THEME_SNAPSHOT_KEY = 'euoracraft-theme-snapshot'

/** 极光流体背景（光斑）开关的本地存储键（仅前端记忆，不同步后端）。 */
const AURORA_STORAGE_KEY = 'euoracraft-aurora'

/** 背景模糊层（毛玻璃）开关的本地存储键（仅前端记忆，不同步后端）。 */
const BLUR_LAYER_STORAGE_KEY = 'euoracraft-blur-layer'

/** 从背景图提取主题色的取色模式开关的本地存储键（仅前端记忆，不同步后端）。 */
const DERIVE_MODE_STORAGE_KEY = 'euoracraft-derive-mode'

/**
 * 根据基础色生成主题主色阶。
 * @param baseColor - 十六进制基础色
 * @param isDark - 是否为深色模式（决定悬停/按下色的混色方向）
 * @returns 包含主色、悬停色、按下色、浅色及 RGB 值的色阶对象
 */
function createPrimaryScale(
  baseColor: string,
  isDark: boolean
): {
  primary: string
  primaryHover: string
  primaryPressed: string
  primaryLight: string
  primaryRgb: string
} {
  const normalized = normalizeHex(baseColor)
  const isValid = /^#([a-f\d]{6})$/i.test(normalized)
  const color = isValid ? normalized : DEFAULT_PRIMARY_COLOR
  const rgb = hexToRgb(color)

  return {
    primary: color,
    primaryHover: mix(color, isDark ? '#ffffff' : '#000000', 0.15),
    primaryPressed: mix(color, isDark ? '#ffffff' : '#000000', 0.3),
    primaryLight: rgba(color, 0.15),
    primaryRgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
  }
}

export type ThemeMode = 'light' | 'dark' | 'system'

/** 从背景图提取主题色的取色模式：关闭 / 提取主色 / Monet 莫奈（Material You tonal 色板）。 */
export type DeriveMode = 'off' | 'default' | 'monet'

export const presetColors = PRESET_COLORS

const themeColors = {
  light: LIGHT_THEME_COLORS,
  dark: DARK_THEME_COLORS,
} as const

/**
 * 创建 naive-ui 主题覆盖配置。
 * @param isDark - 是否为深色模式
 * @param primaryScale - 已计算好的主色色阶（由调用方基于响应式状态生成一次）
 * @param _appearance - 外观配置快照（半径/字体/卡片透明度），仅用于驱动重算
 * @returns naive-ui 主题覆盖对象
 */
function createThemeOverrides(
  isDark: boolean,
  primaryScale: ReturnType<typeof createPrimaryScale>,
  _appearance: ThemeAppearanceConfig
): GlobalThemeOverrides {
  const baseColors = isDark ? themeColors.dark : themeColors.light

  return {
    common: {
      primaryColor: primaryScale.primary,
      primaryColorHover: primaryScale.primaryHover,
      primaryColorPressed: primaryScale.primaryPressed,
      primaryColorSuppl: primaryScale.primaryHover,
      successColor: baseColors.success,
      warningColor: baseColors.warning,
      errorColor: baseColors.error,
      infoColor: baseColors.info,
      textColorBase: baseColors.text,
      textColor1: baseColors.text,
      textColor2: baseColors.textSecondary,
      textColor3: baseColors.textSecondary,
      bodyColor: 'transparent',
      cardColor: 'var(--ecl-surface)',
      modalColor: 'var(--ecl-surface)',
      popoverColor: 'var(--ecl-surface)',
      borderColor: baseColors.border,
      dividerColor: baseColors.border,
      borderRadius: 'var(--ecl-radius-control, 6px)',
      borderRadiusSmall: 'var(--ecl-radius-control, 6px)',
      fontFamily: 'var(--ecl-font-body, var(--font-body))',
      // 与 base.css 的 emphasized 缓动族对齐，让 naive-ui 内部过渡
      // （message / dialog / select / popover 等）跟随统一动画体系
      cubicBezierEaseInOut: 'cubic-bezier(0.2, 0, 0, 1)',
      cubicBezierEaseOut: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
      cubicBezierEaseIn: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    },
    Button: {
      color: 'var(--ecl-control-surface)',
      colorHover: 'var(--ecl-hover)',
      colorPressed: 'var(--ecl-hover)',
      textColor: baseColors.text,
      textColorHover: primaryScale.primary,
      border: `1px solid ${baseColors.border}`,
      borderHover: `1px solid ${primaryScale.primary}`,
      heightMedium: 'var(--ecl-control-height, 36px)',
      heightSmall: 'var(--ecl-control-height-sm, 32px)',
      borderRadiusMedium: 'var(--ecl-radius-control, 6px)',
      borderRadiusSmall: 'var(--ecl-radius-control, 6px)',
      fontWeight: '550',
      paddingMedium: '0 14px',
    },
    Card: {
      color: 'var(--ecl-surface)',
      borderColor: baseColors.border,
      borderRadius: 'var(--ecl-radius-card, 8px)',
      boxShadow: 'var(--ecl-shadow-surface, 0 1px 2px rgba(29, 36, 51, 0.04))',
      paddingMedium: '16px',
    },
    Input: {
      color: 'var(--ecl-control-surface)',
      colorFocus: 'var(--ecl-control-surface)',
      border: `1px solid ${baseColors.border}`,
      borderHover: `1px solid ${primaryScale.primary}`,
      borderFocus: `1px solid ${primaryScale.primary}`,
      textColor: baseColors.text,
      placeholderColor: baseColors.textSecondary,
      heightMedium: 'var(--ecl-control-height, 36px)',
      heightSmall: 'var(--ecl-control-height-sm, 32px)',
      borderRadius: 'var(--ecl-radius-control, 6px)',
      boxShadowFocus: `0 0 0 2px ${rgba(primaryScale.primary, 0.16)}`,
    },
    Select: {
      color: 'var(--ecl-control-surface)',
      colorActive: 'var(--ecl-hover)',
      border: `1px solid ${baseColors.border}`,
      borderHover: `1px solid ${primaryScale.primary}`,
      borderActive: `1px solid ${primaryScale.primary}`,
    },
    Switch: {
      railColor: baseColors.textSecondary,
      railColorActive: primaryScale.primary,
    },
    Slider: {
      fillColor: primaryScale.primary,
      railColor: baseColors.border,
    },
    Tooltip: {
      color: 'var(--ecl-control-surface)',
      textColor: baseColors.text,
    },
    Dropdown: {
      color: 'var(--ecl-control-surface)',
      optionColorHover: 'var(--ecl-hover)',
    },
    Menu: {
      color: 'transparent',
      itemColorHover: baseColors.backgroundHover,
      itemTextColor: baseColors.text,
      itemTextColorHover: primaryScale.primary,
      itemColorActive: primaryScale.primaryLight,
      itemTextColorActive: primaryScale.primary,
      itemIconColorActive: primaryScale.primary,
      itemHeight: '40px',
      itemBorderRadius: '6px',
    },
    Dialog: {
      borderRadius: 'var(--ecl-radius-dialog, 10px)',
      titleFontSize: '17px',
      padding: '20px',
    },
    Tabs: {
      tabBorderRadius: '6px',
      tabColorSegment: baseColors.backgroundHover,
    },
    Tag: {
      borderRadius: '5px',
    },
  }
}

// 单例级非响应式状态（系统监听/初始化缓存/Blob URL/保存防抖）
let systemThemeListenerInitialized = false
let initThemePromise: Promise<void> | null = null
let currentBgObjectUrl: string | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 主题全局状态（Pinia）。
 * 由 useTheme() 包装暴露，保持原有 API（readonly ref + setter 函数）。
 */
export const useThemeStore = defineStore('theme', () => {
  const themeId = ref<'classic' | 'folia'>('classic')
  const themeMode = ref<ThemeMode>('system')
  const primaryColor = ref('')
  /** 极光流体背景（光斑）是否显示。 */
  const auroraEnabled = ref(true)
  /** 背景模糊层（毛玻璃）是否启用。 */
  const blurLayerEnabled = ref(true)
  /** 从背景图提取主题色的取色模式。 */
  const deriveMode = ref<DeriveMode>('off')
  /** 从背景图提取出的主色（hex），为空时回退到手动选择的主色。 */
  const derivedPrimary = ref('')
  /** 从背景图提取出的 Monet 种子色（hex，Material You）。 */
  const derivedMonetSeed = ref('')
  /** 图片分支当前解析出的显示地址；视频封面不会覆盖它。 */
  const backgroundImageSourceUrl = ref('')
  const backgroundImage = ref('')
  const backgroundImagePath = ref('')
  /** 图片/视频背景的持久化类型；旧配置缺省时视为图片。 */
  const backgroundMediaType = ref<'image' | 'video'>('image')
  /** 后端签发的临时视频流 URL，不写入配置。 */
  const backgroundVideoUrl = ref('')
  const backgroundVideoPath = ref('')
  const backgroundVideoPosterPath = ref('')
  const backgroundVideo = ref<Required<BackgroundVideoConfig>>(normalizeVideoConfig(undefined))
  const backgroundOpacity = ref(1)
  const blurAmount = ref(0)
  /** 背景模式：single=单张 / carousel=顺序轮播 / random=随机切换。 */
  const bgMode = ref<BackgroundMode>('single')
  /** 轮播/随机模式下的图片来源文件夹路径（single 模式存 backgroundImagePath）。 */
  const bgFolderPath = ref('')
  /** 轮播/随机切换间隔（秒）。 */
  const bgInterval = ref(BACKGROUND_INTERVAL_DEFAULT)
  /** 轮播/随机来源文件列表（绝对路径，按文件名排序）。 */
  const bgSources = ref<string[]>([])
  /** 当前展示的文件索引。 */
  const bgIndex = ref(0)
  let bgRotateTimer: ReturnType<typeof setInterval> | null = null
  const transparentBg = ref(false)
  const sidebarStorageKey = 'euoracraft-sidebar-collapsed'
  let hasWarnedSidebarStorage = false

  function warnSidebarStorage(): void {
    if (hasWarnedSidebarStorage) return
    hasWarnedSidebarStorage = true
    console.warn('侧栏折叠状态无法本地保存，本次运行仍可正常切换')
  }

  function readSidebarState(): boolean | null {
    try {
      const stored = window.localStorage.getItem(sidebarStorageKey)
      return stored === 'true' ? true : stored === 'false' ? false : null
    } catch {
      warnSidebarStorage()
      return null
    }
  }

  const sidebarCollapsed = ref(readSidebarState() ?? true)

  function saveSidebarState(): void {
    try {
      window.localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed.value))
    } catch {
      warnSidebarStorage()
    }
  }

  const navigationMode = ref<NavigationMode>('sidebar')
  const systemDark = ref(false)
  /** 用户级外观覆盖（圆角/字体/卡片透明度）。未设置的字段交由默认值决定。 */
  const appearance = ref<ThemeAppearanceConfig>({})
  /** 定时自动切换亮暗（仅在 system 模式生效）。 */
  const schedule = ref<ThemeScheduleConfig>({})
  /** 定时器心跳，驱动 system 模式下按时间重算。 */
  const scheduleTick = ref(0)
  let scheduleTimer: ReturnType<typeof setInterval> | null = null

  const titlebarHidden = computed(() => navigationMode.value === 'sidebar')

  /** system 模式下的有效深色判定：启用定时则按时间窗口，否则跟随系统。 */
  const effectiveSystemDark = computed(() => {
    const conf = schedule.value
    if (conf.enabled) {
      const startMinutes = parseTimeMinutes(conf.dark_start)
      const endMinutes = parseTimeMinutes(conf.dark_end)
      if (startMinutes >= 0 && endMinutes >= 0) {
        const now = new Date()
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        if (startMinutes === endMinutes) return true
        if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes
        return nowMinutes >= startMinutes || nowMinutes < endMinutes
      }
    }
    return systemDark.value
  })

  const isDark = computed(() => {
    if (themeMode.value === 'dark') return true
    if (themeMode.value === 'light') return false
    return effectiveSystemDark.value
  })

  const naiveTheme = computed<GlobalTheme | null>(() => {
    return isDark.value ? darkTheme : null
  })

  /** 生效主色：开启背景取色且提取成功时用提取色，否则回退手动主色。 */
  const activePrimaryColor = computed(() =>
    deriveMode.value === 'default' && derivedPrimary.value ? derivedPrimary.value : primaryColor.value
  )

  /** 主色色阶：Monet 模式用完整 tonal 色板，否则由生效主色派生。 */
  const primaryScale = computed(() => {
    if (deriveMode.value === 'monet' && derivedMonetSeed.value) {
      return createMonetScale(derivedMonetSeed.value, isDark.value)
    }
    return createPrimaryScale(activePrimaryColor.value, isDark.value)
  })

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    return createThemeOverrides(isDark.value, primaryScale.value, appearance.value)
  })

  const colors = computed(() => {
    const baseColors = isDark.value ? themeColors.dark : themeColors.light

    return {
      ...baseColors,
      ...primaryScale.value,
    }
  })

  /**
   * 监听系统深色模式偏好变化。
   */
  function initSystemThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mediaQuery.matches

    mediaQuery.addEventListener('change', (e) => {
      systemDark.value = e.matches
      if (themeMode.value === 'system') {
        updateTheme()
      }
    })
  }

  /** 写入用户级外观覆盖变量；未设置的字段不写，交由默认值决定。 */
  function applyAppearanceVars(): void {
    const el = document.documentElement
    const conf = appearance.value
    if (typeof conf.radius_window === 'number') el.style.setProperty('--ecl-radius-window', `${conf.radius_window}px`)
    if (typeof conf.radius_control === 'number')
      el.style.setProperty('--ecl-radius-control', `${conf.radius_control}px`)
    if (typeof conf.radius_card === 'number') el.style.setProperty('--ecl-radius-card', `${conf.radius_card}px`)
    if (typeof conf.radius_dialog === 'number') el.style.setProperty('--ecl-radius-dialog', `${conf.radius_dialog}px`)
    const fontVariables = [
      ['--ecl-font-body', conf.font_family, 'var(--font-body)'],
      ['--ecl-font-sidebar', conf.sidebar_font_family, 'var(--ecl-font-body, var(--font-body))'],
      ['--ecl-font-terminal', conf.terminal_font_family, 'var(--font-mono)'],
      ['--ecl-font-log', conf.log_font_family, 'var(--font-mono)'],
    ] as const
    for (const [variable, value, fallback] of fontVariables) {
      if (value) el.style.setProperty(variable, resolveFontFamily(value, fallback))
      else el.style.removeProperty(variable)
    }
    el.style.setProperty('--card-opacity', String((conf.card_opacity ?? CARD_OPACITY_DEFAULT) / 100))
  }

  /** 持久化当前主题到 localStorage，供 index.html 内联脚本启动时无闪烁恢复。 */
  function saveSnapshot(): void {
    try {
      const scale = primaryScale.value
      localStorage.setItem(
        THEME_SNAPSHOT_KEY,
        JSON.stringify({
          theme: isDark.value ? 'dark' : 'light',
          uiSkin: themeId.value,
          primary: scale.primary,
          primaryRgb: scale.primaryRgb,
          primaryHover: scale.primaryHover,
          primaryActive: scale.primaryPressed,
          primaryAlpha: scale.primaryLight,
        })
      )
    } catch {
      /* localStorage 不可用时跳过快照 */
    }
  }

  function updateTheme() {
    const bgImageValue = backgroundImage.value ? `url("${backgroundImage.value}")` : 'none'

    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
    document.documentElement.dataset.uiSkin = themeId.value
    document.documentElement.style.setProperty('--primary', primaryScale.value.primary)
    document.documentElement.style.setProperty('--ecl-primary', primaryScale.value.primary)
    document.documentElement.style.setProperty('--primary-rgb', primaryScale.value.primaryRgb)
    document.documentElement.style.setProperty('--primary-hover', primaryScale.value.primaryHover)
    document.documentElement.style.setProperty('--ecl-primary-hover', primaryScale.value.primaryHover)
    document.documentElement.style.setProperty('--primary-active', primaryScale.value.primaryPressed)
    document.documentElement.style.setProperty('--ecl-primary-active', primaryScale.value.primaryPressed)
    document.documentElement.style.setProperty('--primary-alpha', primaryScale.value.primaryLight)
    document.documentElement.style.setProperty('--bg-image', bgImageValue)
    document.documentElement.style.setProperty('--bg-opacity', String(backgroundOpacity.value))
    document.documentElement.style.setProperty('--bg-app', transparentBg.value ? 'transparent' : '')
    document.documentElement.style.setProperty('--bg-blur', `${blurAmount.value}px`)
    document.documentElement.style.setProperty('--main-bg-layer-opacity', transparentBg.value ? '1' : '0')

    // 极光开关及派生色：光斑显隐、模糊层显隐，色板由主色动态派生
    document.documentElement.dataset.aurora = auroraEnabled.value ? '1' : '0'
    document.documentElement.dataset.auroraBlur = blurLayerEnabled.value ? '1' : '0'
    const aurora = createAuroraColors(primaryScale.value.primary, isDark.value)
    document.documentElement.style.setProperty('--aurora-c1', aurora.c1)
    document.documentElement.style.setProperty('--aurora-c2', aurora.c2)
    document.documentElement.style.setProperty('--aurora-c3', aurora.c3)

    document.documentElement.setAttribute('data-sidebar-collapsed', sidebarCollapsed.value ? '1' : '0')
    document.documentElement.setAttribute('data-navigation-mode', navigationMode.value)
    document.documentElement.setAttribute('data-titlebar-hidden', titlebarHidden.value ? '1' : '0')

    applyAppearanceVars()
    saveSnapshot()

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(
        '[updateTheme] --bg-image:',
        bgImageValue,
        'backgroundImage.length:',
        backgroundImage.value?.length ?? 0
      )
    }
  }

  /** 亮暗切换时短暂开启过渡类，让颜色平滑变化；系统减少动效时会自动禁用。 */
  function withThemeTransition(fn: () => void): void {
    const el = document.documentElement
    el.classList.add('theme-transition')
    fn()
    window.setTimeout(() => el.classList.remove('theme-transition'), 320)
  }

  function setThemeMode(mode: ThemeMode, persist = true) {
    themeMode.value = mode
    withThemeTransition(updateTheme)
    if (persist) saveThemeConfig()
  }

  /** 切换到内置皮肤（classic/folia），并写入 data-ui-skin 驱动布局差异。 */
  function setThemeId(id: 'classic' | 'folia', persist = true) {
    themeId.value = id
    updateTheme()
    if (persist) saveThemeConfig()
  }

  function setPrimaryColor(color: string, persist = true) {
    if (deriveMode.value !== 'off') setDeriveMode('off', false)
    primaryColor.value = color
    updateTheme()
    if (persist) saveThemeConfig()
  }

  /** 按当前取色模式从背景图提取主题色并同步（对准 fork deriveFromBackground）。 */
  async function deriveFromBackground() {
    if (deriveMode.value === 'off' || !backgroundImage.value) return
    const url = backgroundImage.value
    if (deriveMode.value === 'default') {
      const color = await extractPrimaryFromImage(url)
      derivedPrimary.value = color ?? ''
    } else {
      const seed = await monetSeedFromImage(url)
      derivedMonetSeed.value = seed ?? ''
    }
    updateTheme()
  }

  async function setDeriveMode(mode: DeriveMode, persist = true) {
    deriveMode.value = mode
    if (mode !== 'off') {
      if (backgroundImage.value) await deriveFromBackground()
    } else {
      derivedPrimary.value = ''
      derivedMonetSeed.value = ''
    }
    updateTheme()
    if (persist) {
      try {
        window.localStorage.setItem(DERIVE_MODE_STORAGE_KEY, mode)
      } catch {
        /* localStorage 不可用时忽略 */
      }
    }
  }

  /** 局部更新用户级外观覆盖。传入 undefined 可清除某个字段。 */
  function setAppearance(patch: Partial<ThemeAppearanceConfig>, persist = true) {
    appearance.value = { ...appearance.value, ...patch }
    updateTheme()
    if (persist) saveThemeConfig()
  }

  function setSchedule(patch: Partial<ThemeScheduleConfig>, persist = true) {
    schedule.value = { ...schedule.value, ...patch }
    updateTheme()
    if (persist) saveThemeConfig()
  }

  function dataUrlToBlobUrl(dataUrl: string): string {
    if (currentBgObjectUrl) {
      URL.revokeObjectURL(currentBgObjectUrl)
      currentBgObjectUrl = null
    }
    const [header, base64] = dataUrl.split(',')
    const mimeMatch = header?.match(/:(.*?);/)
    const mime = mimeMatch?.[1] || 'image/png'
    const binary = atob(base64 || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mime })
    currentBgObjectUrl = URL.createObjectURL(blob)
    return currentBgObjectUrl
  }

  function resolveImageUrl(url: string): string {
    // 超大的 data URL 直接写入 CSS 变量容易触发渲染/长度问题，转为 blob URL
    return url && url.startsWith('data:') && url.length > 100 * 1024 ? dataUrlToBlobUrl(url) : url
  }

  function preloadBackgroundImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () => {
        console.warn('[Theme] 背景图片加载失败:', url)
        resolve()
      }
      image.src = url
    })
  }

  function setBackgroundImage(url: string, path?: string, persist = true) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[setBackgroundImage] url.length:', url?.length ?? 0, 'path:', path, 'persist:', persist)
    }
    backgroundImageSourceUrl.value = resolveImageUrl(url)
    backgroundImage.value = backgroundImageSourceUrl.value
    backgroundMediaType.value = 'image'
    backgroundVideoUrl.value = ''
    if (path !== undefined) backgroundImagePath.value = path
    updateTheme()
    restartBgRotation()
    if (persist) saveThemeConfig()
    // 开启背景取色时，更换背景图自动重新提取主题色
    if (deriveMode.value !== 'off' && backgroundImage.value) {
      void deriveFromBackground()
    }
  }

  function setBackgroundVideo(
    url: string,
    path: string,
    config: BackgroundVideoConfig | undefined,
    posterPath = '',
    persist = true
  ): void {
    backgroundMediaType.value = 'video'
    backgroundVideoUrl.value = url
    backgroundVideoPath.value = path
    backgroundVideoPosterPath.value = posterPath
    backgroundVideo.value = normalizeVideoConfig(config)
    updateTheme()
    restartBgRotation()
    if (persist) saveThemeConfig()
  }

  function setBackgroundVideoOptions(patch: Partial<BackgroundVideoConfig>, persist = true): void {
    backgroundVideo.value = normalizeVideoConfig({ ...backgroundVideo.value, ...patch })
    if (persist) saveThemeConfig()
  }

  function setBackgroundVideoPoster(url: string, path: string, persist = true): void {
    backgroundImage.value = resolveImageUrl(url)
    backgroundVideoPosterPath.value = path
    updateTheme()
    if (persist) saveThemeConfig()
  }

  /** 切回已保存的图片背景分支，并恢复单张或轮播显示。 */
  async function activateImageBackground(): Promise<void> {
    backgroundMediaType.value = 'image'
    backgroundVideoUrl.value = ''
    if (isCarouselMode(bgMode.value) && bgSources.value.length) {
      const source = bgSources.value[bgIndex.value] ?? bgSources.value[0]
      if (source) {
        const url = await resolveLocalImageUrl(source)
        if (url) {
          backgroundImageSourceUrl.value = resolveImageUrl(url)
          backgroundImage.value = backgroundImageSourceUrl.value
        }
      }
    } else if (backgroundImageSourceUrl.value) {
      backgroundImage.value = backgroundImageSourceUrl.value
    } else if (backgroundImagePath.value) {
      const url = await resolveLocalImageUrl(backgroundImagePath.value)
      backgroundImageSourceUrl.value = url ? resolveImageUrl(url) : ''
      backgroundImage.value = backgroundImageSourceUrl.value
    } else {
      backgroundImage.value = ''
    }
    updateTheme()
    restartBgRotation()
  }

  /** 切回已保存的视频背景分支；流地址始终由后端按已保存配置重新签发。 */
  async function activateVideoBackground(): Promise<void> {
    backgroundMediaType.value = 'video'
    backgroundVideoUrl.value = ''
    if (backgroundVideoPosterPath.value) {
      const posterUrl = await resolveLocalImageUrl(backgroundVideoPosterPath.value)
      backgroundImage.value = posterUrl ? resolveImageUrl(posterUrl) : ''
    }
    if (backgroundVideoPath.value) {
      try {
        backgroundVideoUrl.value = (await settingsApi.openBackgroundVideo()) ?? ''
      } catch {
        /* 视频不可用时保留封面或纯色背景。 */
      }
    }
    updateTheme()
    restartBgRotation()
  }

  function markBackgroundVideoUnavailable(): void {
    backgroundVideoUrl.value = ''
  }

  function setBlurAmount(amount: number, persist = true) {
    blurAmount.value = amount
    updateTheme()
    if (persist) saveThemeConfig()
  }

  function setBackgroundOpacity(opacity: number, persist = true) {
    backgroundOpacity.value = opacity
    updateTheme()
    if (persist) saveThemeConfig()
  }

  /** 切换并加载下一张背景图；随机/顺序由 bgMode 决定。 */
  async function advanceBackground() {
    const sources = bgSources.value
    if (bgMode.value === 'single' || sources.length < 2) return
    const next = nextBackgroundIndex(bgMode.value, sources.length, bgIndex.value)
    bgIndex.value = next
    const source = sources[next]
    if (!source) return
    try {
      const url = await resolveLocalImageUrl(source)
      if (!url) return
      await preloadBackgroundImage(url)
      if (bgSources.value.length >= 2) {
        setBackgroundImage(resolveImageUrl(url), undefined, false)
      }
    } catch {
      /* 单张加载失败跳过本轮 */
    }
  }

  /** 停止并重启轮播定时器；非轮播模式或来源不足时保持停止。 */
  function restartBgRotation() {
    if (bgRotateTimer) {
      clearInterval(bgRotateTimer)
      bgRotateTimer = null
    }
    if (backgroundMediaType.value !== 'image' || bgMode.value === 'single' || bgSources.value.length < 2) return
    const intervalMs = clampBackgroundInterval(bgInterval.value) * 1000
    bgRotateTimer = setInterval(() => {
      void advanceBackground()
    }, intervalMs)
  }

  /** 切换背景模式；切到单张时保留当前展示图，轮播来源可在切回后复用。 */
  function setBgMode(mode: BackgroundMode, persist = true) {
    bgMode.value = mode
    restartBgRotation()
    updateTheme()
    if (persist) saveThemeConfig()
  }

  /** 设置轮播/随机切换间隔（秒）。 */
  function setBgInterval(seconds: number, persist = true) {
    bgInterval.value = clampBackgroundInterval(seconds)
    restartBgRotation()
    if (persist) saveThemeConfig()
  }

  /**
   * 应用文件夹轮播来源：记录文件夹路径与文件列表，加载首张并启动轮播。
   * @param folderPath - 图片所在文件夹绝对路径
   * @param files - 文件夹内图片文件绝对路径列表（需非空）
   * @param mode - 目标模式，默认沿用当前模式（carousel/random），否则回退 carousel
   */
  async function applyBackgroundFolder(
    folderPath: string,
    files: string[],
    mode: BackgroundMode = bgMode.value,
    persist = true
  ): Promise<void> {
    if (!files.length) return
    bgFolderPath.value = folderPath
    bgSources.value = files
    bgIndex.value = 0
    bgMode.value = isCarouselMode(mode) ? mode : 'carousel'
    const first = files[0]
    if (first) {
      const url = await resolveLocalImageUrl(first)
      if (url) setBackgroundImage(resolveImageUrl(url), undefined, false)
    }
    restartBgRotation()
    if (persist) saveThemeConfig()
  }

  /** 移除轮播来源（用于清空背景时同步重置）。 */
  function clearBackgroundSource() {
    if (bgRotateTimer) {
      clearInterval(bgRotateTimer)
      bgRotateTimer = null
    }
    bgSources.value = []
    bgIndex.value = 0
    bgFolderPath.value = ''
  }

  function setTransparentBg(val: boolean, persist = true) {
    transparentBg.value = val
    updateTheme()
    if (persist) saveThemeConfig()
  }

  function setAuroraEnabled(val: boolean, persist = true) {
    auroraEnabled.value = val
    updateTheme()
    if (persist) {
      try {
        window.localStorage.setItem(AURORA_STORAGE_KEY, val ? '1' : '0')
      } catch {
        /* localStorage 不可用时忽略 */
      }
    }
  }

  function setBlurLayerEnabled(val: boolean, persist = true) {
    blurLayerEnabled.value = val
    updateTheme()
    if (persist) {
      try {
        window.localStorage.setItem(BLUR_LAYER_STORAGE_KEY, val ? '1' : '0')
      } catch {
        /* localStorage 不可用时忽略 */
      }
    }
  }

  function setSidebarCollapsed(val: boolean) {
    if (sidebarCollapsed.value === val) return
    sidebarCollapsed.value = val
    updateTheme()
    saveSidebarState()
  }

  function setTitlebarHidden(val: boolean) {
    navigationMode.value = val ? 'sidebar' : 'top'
    updateTheme()
    saveThemeConfig()
  }

  function setNavigationMode(mode: NavigationMode) {
    navigationMode.value = mode
    updateTheme()
    saveThemeConfig()
  }

  async function saveThemeConfig() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      if (!settingsApi.isAvailable) return
      try {
        const ui = await settingsApi.getUi()
        const savedBackground = ui.background ?? {}
        const savedImage = readImageBackground(savedBackground)
        const savedVideo = readVideoBackground(savedBackground)
        await settingsApi.saveUi({
          ...ui,
          theme: {
            window_chrome: ui.theme?.window_chrome,
            mode: themeMode.value,
            theme_id: themeId.value,
            primary_color: primaryColor.value,
            blur_amount: blurAmount.value,
            navigation_mode: navigationMode.value,
            titlebar_hidden: titlebarHidden.value,
            transparent_bg: transparentBg.value,
            background_opacity: backgroundOpacity.value,
            appearance: appearance.value,
            schedule: schedule.value,
          },
          background: {
            ...savedBackground,
            opacity: backgroundOpacity.value,
            media_type: backgroundMediaType.value,
            image: {
              ...savedImage,
              type: backgroundImagePath.value ? 'custom' : 'none',
              path: isCarouselMode(bgMode.value) ? bgFolderPath.value : backgroundImagePath.value,
              mode: bgMode.value,
              interval: clampBackgroundInterval(bgInterval.value),
            },
            video: {
              ...savedVideo,
              path: backgroundVideoPath.value,
              poster_path: backgroundVideoPosterPath.value,
              options: backgroundVideo.value,
            },
          },
        })
      } catch (error) {
        // 防抖回调里的失败没有调用方接住，静默丢失会造成未处理 rejection 且配置未保存
        console.warn('[useTheme] 主题配置保存失败:', error)
      }
    }, 100)
  }

  function toggleTheme() {
    if (themeMode.value === 'system') {
      setThemeMode(isDark.value ? 'light' : 'dark')
    } else {
      setThemeMode(themeMode.value === 'dark' ? 'light' : 'dark')
    }
  }

  /**
   * 初始化主题状态。
   * @param uiConfig - 后端推送的 UI 配置，首次调用后会被缓存
   */
  async function initTheme(uiConfig?: unknown): Promise<void> {
    if (!uiConfig && initThemePromise) {
      return initThemePromise
    }

    const payload = uiConfig as ThemeInitPayload | undefined

    const promise = (async () => {
      let backgroundChanged = false
      if (payload?.theme) {
        const themeData = payload.theme
        if (themeData.mode) {
          themeMode.value = themeData.mode
        }
        if (themeData.theme_id === 'classic' || themeData.theme_id === 'folia') {
          themeId.value = themeData.theme_id
        }
        if (themeData.appearance) {
          appearance.value = { ...themeData.appearance }
        }
        if (themeData.schedule) {
          schedule.value = { ...themeData.schedule }
        }
        if (themeData.primary_color) {
          primaryColor.value = themeData.primary_color
        }
        if (typeof themeData.blur_amount === 'number') {
          blurAmount.value = themeData.blur_amount
        }
        if (typeof themeData.transparent_bg === 'boolean') {
          transparentBg.value = themeData.transparent_bg
        }
        navigationMode.value = resolveNavigationMode(themeData)
      }

      if (payload?.background) {
        backgroundChanged = true
        const bgData = payload.background
        const imageData = readImageBackground(bgData)
        const videoData = readVideoBackground(bgData)
        bgMode.value = imageData.mode === 'carousel' || imageData.mode === 'random' ? imageData.mode : 'single'
        bgInterval.value = clampBackgroundInterval(imageData.interval ?? BACKGROUND_INTERVAL_DEFAULT)
        bgSources.value = []
        bgIndex.value = 0
        bgFolderPath.value = ''
        backgroundImagePath.value = ''
        backgroundImageSourceUrl.value = ''
        backgroundImage.value = ''
        backgroundMediaType.value = bgData.media_type === 'video' ? 'video' : 'image'
        backgroundVideoUrl.value = ''
        backgroundVideoPath.value = videoData.path ?? ''
        backgroundVideoPosterPath.value = videoData.poster_path ?? ''
        backgroundVideo.value = normalizeVideoConfig(videoData.options)

        if (bgMode.value === 'carousel' || bgMode.value === 'random') {
          if (imageData.path) {
            bgFolderPath.value = imageData.path
            try {
              const files = await settingsApi.listBackgroundImages(imageData.path)
              bgSources.value = files
              const first = files[0]
              if (first) {
                bgIndex.value = 0
                const url = await resolveLocalImageUrl(first)
                if (url) backgroundImageSourceUrl.value = resolveImageUrl(url)
              }
            } catch {
              /* 目录读取失败时保持空来源 */
            }
          }
        } else if (imageData.image_base64) {
          backgroundImagePath.value = imageData.path ?? ''
          backgroundImageSourceUrl.value = resolveImageUrl(imageData.image_base64)
        } else if (settingsApi.isShowcase && imageData.path?.startsWith('http')) {
          backgroundImagePath.value = imageData.path ?? ''
          backgroundImageSourceUrl.value = imageData.path
        } else if (imageData.path && imageData.type !== 'default') {
          // 桌面端统一通过后端读取 Base64，并将大图转换为 Blob URL 供 CSS 使用
          backgroundImagePath.value = imageData.path
          const imageUrl = await resolveLocalImageUrl(imageData.path)
          backgroundImageSourceUrl.value = imageUrl ? resolveImageUrl(imageUrl) : ''
        }

        if (backgroundMediaType.value === 'video') {
          await activateVideoBackground()
        } else {
          await activateImageBackground()
        }

        if (typeof bgData.opacity === 'number') {
          backgroundOpacity.value = bgData.opacity
        }
      }

      if (backgroundChanged && backgroundImage.value) {
        await preloadBackgroundImage(backgroundImage.value)
      }

      if (!systemThemeListenerInitialized) {
        initSystemThemeListener()
        systemThemeListenerInitialized = true
      }
      if (!scheduleTimer) {
        scheduleTimer = setInterval(() => {
          scheduleTick.value += 1
          if (themeMode.value === 'system' && schedule.value.enabled) updateTheme()
        }, 60_000)
      }
      try {
        const storedAurora = window.localStorage.getItem(AURORA_STORAGE_KEY)
        if (storedAurora !== null) auroraEnabled.value = storedAurora === '1'
        const storedBlur = window.localStorage.getItem(BLUR_LAYER_STORAGE_KEY)
        if (storedBlur !== null) blurLayerEnabled.value = storedBlur === '1'
        const storedDerive = window.localStorage.getItem(DERIVE_MODE_STORAGE_KEY)
        if (storedDerive === 'off' || storedDerive === 'default' || storedDerive === 'monet')
          deriveMode.value = storedDerive
      } catch {
        /* localStorage 不可用时沿用默认值 */
      }
      updateTheme()
      restartBgRotation()
      // 开启背景取色且背景图就绪后，异步补一次初始提取
      if (deriveMode.value !== 'off' && backgroundImage.value) {
        void deriveFromBackground()
      }
    })()

    if (!uiConfig) {
      initThemePromise = promise
    }

    return promise
  }

  return {
    themeId,
    themeMode,
    primaryColor,
    auroraEnabled,
    blurLayerEnabled,
    deriveMode,
    derivedPrimary,
    derivedMonetSeed,
    backgroundImage,
    backgroundImagePath,
    backgroundMediaType,
    backgroundVideoUrl,
    backgroundVideoPath,
    backgroundVideoPosterPath,
    backgroundVideo,
    backgroundOpacity,
    blurAmount,
    transparentBg,
    sidebarCollapsed,
    navigationMode,
    titlebarHidden,
    isDark,
    systemDark,
    appearance,
    schedule,
    bgMode,
    bgFolderPath,
    bgInterval,
    bgSources,
    bgIndex,
    naiveTheme,
    themeOverrides,
    colors,
    initSystemThemeListener,
    updateTheme,
    setThemeMode,
    setThemeId,
    setPrimaryColor,
    setAppearance,
    setSchedule,
    setBackgroundImage,
    setBackgroundVideo,
    setBackgroundVideoOptions,
    setBackgroundVideoPoster,
    activateImageBackground,
    activateVideoBackground,
    markBackgroundVideoUnavailable,
    setBlurAmount,
    setBackgroundOpacity,
    setTransparentBg,
    setAuroraEnabled,
    setBlurLayerEnabled,
    setDeriveMode,
    setSidebarCollapsed,
    setTitlebarHidden,
    setNavigationMode,
    setBgMode,
    setBgInterval,
    applyBackgroundFolder,
    clearBackgroundSource,
    saveThemeConfig,
    toggleTheme,
    initTheme,
  }
})

/**
 * 初始化主题状态（模块级入口，供 main.ts 在 app.use(pinia) 之前调用）。
 * @param uiConfig - 后端推送的 UI 配置，首次调用后会被缓存
 */
export async function initTheme(uiConfig?: unknown): Promise<void> {
  return useThemeStore(pinia).initTheme(uiConfig)
}

/**
 * 获取全局主题状态及操作方法。
 * @returns 主题相关的响应式状态与 setter
 */
export function useTheme() {
  const store = useThemeStore(pinia)
  const {
    themeId,
    themeMode,
    primaryColor,
    auroraEnabled,
    blurLayerEnabled,
    deriveMode,
    derivedPrimary,
    derivedMonetSeed,
    backgroundImage,
    backgroundImagePath,
    backgroundMediaType,
    backgroundVideoUrl,
    backgroundVideoPath,
    backgroundVideoPosterPath,
    backgroundVideo,
    backgroundOpacity,
    blurAmount,
    transparentBg,
    sidebarCollapsed,
    navigationMode,
    titlebarHidden,
    isDark,
    appearance,
    schedule,
    bgMode,
    bgFolderPath,
    bgInterval,
    bgSources,
    bgIndex,
    naiveTheme,
    themeOverrides,
    colors,
  } = storeToRefs(store)
  return {
    themeId: readonly(themeId),
    themeMode: readonly(themeMode),
    primaryColor: readonly(primaryColor),
    auroraEnabled: readonly(auroraEnabled),
    blurLayerEnabled: readonly(blurLayerEnabled),
    deriveMode: readonly(deriveMode),
    derivedPrimary: readonly(derivedPrimary),
    derivedMonetSeed: readonly(derivedMonetSeed),
    backgroundImage: readonly(backgroundImage),
    backgroundImagePath: readonly(backgroundImagePath),
    backgroundMediaType: readonly(backgroundMediaType),
    backgroundVideoUrl: readonly(backgroundVideoUrl),
    backgroundVideoPath: readonly(backgroundVideoPath),
    backgroundVideoPosterPath: readonly(backgroundVideoPosterPath),
    backgroundVideo: readonly(backgroundVideo),
    backgroundOpacity: readonly(backgroundOpacity),
    blurAmount: readonly(blurAmount),
    transparentBg: readonly(transparentBg),
    sidebarCollapsed: readonly(sidebarCollapsed),
    navigationMode: readonly(navigationMode),
    titlebarHidden: readonly(titlebarHidden),
    isDark: readonly(isDark),
    appearance: readonly(appearance),
    schedule: readonly(schedule),
    bgMode: readonly(bgMode),
    bgFolderPath: readonly(bgFolderPath),
    bgInterval: readonly(bgInterval),
    bgSources: readonly(bgSources),
    bgIndex: readonly(bgIndex),
    naiveTheme,
    themeOverrides,
    colors,
    setThemeMode: store.setThemeMode,
    setThemeId: store.setThemeId,
    setPrimaryColor: store.setPrimaryColor,
    setAppearance: store.setAppearance,
    setSchedule: store.setSchedule,
    setBackgroundImage: store.setBackgroundImage,
    setBackgroundVideo: store.setBackgroundVideo,
    setBackgroundVideoOptions: store.setBackgroundVideoOptions,
    setBackgroundVideoPoster: store.setBackgroundVideoPoster,
    activateImageBackground: store.activateImageBackground,
    activateVideoBackground: store.activateVideoBackground,
    markBackgroundVideoUnavailable: store.markBackgroundVideoUnavailable,
    setBlurAmount: store.setBlurAmount,
    setTransparentBg: store.setTransparentBg,
    setAuroraEnabled: store.setAuroraEnabled,
    setBlurLayerEnabled: store.setBlurLayerEnabled,
    setDeriveMode: store.setDeriveMode,
    setBackgroundOpacity: store.setBackgroundOpacity,
    setSidebarCollapsed: store.setSidebarCollapsed,
    setNavigationMode: store.setNavigationMode,
    setTitlebarHidden: store.setTitlebarHidden,
    setBgMode: store.setBgMode,
    setBgInterval: store.setBgInterval,
    applyBackgroundFolder: store.applyBackgroundFolder,
    clearBackgroundSource: store.clearBackgroundSource,
    toggleTheme: store.toggleTheme,
    initTheme,
    updateTheme: store.updateTheme,
  }
}
