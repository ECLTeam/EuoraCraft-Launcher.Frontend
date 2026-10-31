/**
 * 颜色计算工具：主题调色板、主色色阶与极光派生色共用的十六进制运算。
 *
 * 只做纯函数转换，不读写 DOM；调用方负责把结果写入样式变量。
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 把三位或带 `#` 前缀的十六进制色统一成六位小写形式。
 * @param hex - 任意十六进制颜色
 * @returns 形如 `#rrggbb` 的规范色值
 */
export function normalizeHex(hex: string): string {
  let value = hex.trim().replace(/^#/, '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((channel) => channel + channel)
      .join('')
  }
  return `#${value}`
}

/**
 * 解析十六进制颜色为 RGB 分量。
 * @param hex - 十六进制颜色
 * @returns 0-255 的 RGB 分量
 * @throws Error 输入不是合法十六进制颜色时抛出
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalizeHex(hex))
  if (!result) throw new Error('Invalid hex color')

  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  }
}

/**
 * 把 RGB 分量合成十六进制颜色。
 * @param r - 红色分量
 * @param g - 绿色分量
 * @param b - 蓝色分量
 * @returns 形如 `#rrggbb` 的色值
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/**
 * 按权重混合两种颜色。
 * @param color1 - 起点色
 * @param color2 - 终点色
 * @param weight - 终点色占比，0-1
 * @returns 混合后的十六进制色
 */
export function mix(color1: string, color2: string, weight: number = 0.5): string {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  const w = clamp(weight, 0, 1)
  const r = Math.round(rgb1.r * (1 - w) + rgb2.r * w)
  const g = Math.round(rgb1.g * (1 - w) + rgb2.g * w)
  const b = Math.round(rgb1.b * (1 - w) + rgb2.b * w)

  return rgbToHex(r, g, b)
}

/**
 * 生成带透明度的 rgba 色值。
 * @param color - 十六进制颜色
 * @param alpha - 透明度，0-1
 * @returns `rgba(...)` 字符串
 */
export function rgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`
}

/**
 * 生成随卡片不透明度缩放的表面色，与 tokens.css 的 calc 写法保持一致。
 * @param color - 十六进制颜色
 * @param alpha - 基础透明度，0-1
 * @returns 使用 `--card-opacity` 的 `rgba(...)` 字符串
 */
export function rgbaSurface(color: string, alpha: number): string {
  const rgb = hexToRgb(color)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, calc(${clamp(alpha, 0, 1)} * var(--card-opacity, 1)))`
}
