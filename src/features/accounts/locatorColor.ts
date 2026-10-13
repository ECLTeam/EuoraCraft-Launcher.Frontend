/** Minecraft Java 1.21.6 默认定位栏颜色；核验自官方 LocatorBarRenderer 与 ARGB 字节码。 */
export interface LocatorColor {
  readonly hex: string
  readonly rgb: readonly [number, number, number]
}

function setLocatorBrightness(red: number, green: number, blue: number): [number, number, number] {
  // Java 每一步 float 运算都舍入到单精度，省略这些舍入会使部分通道相差 1。
  const f = Math.fround
  const brightness = f(0.9)
  const maximum = Math.max(red, green, blue)
  const delta = maximum - Math.min(red, green, blue)
  const saturation = maximum === 0 ? 0 : f(delta / maximum)
  const channel = (value: number) => Math.round(f(value * 255))
  if (saturation === 0) {
    const gray = channel(brightness)
    return [gray, gray, gray]
  }

  const redDistance = f((maximum - red) / delta)
  const greenDistance = f((maximum - green) / delta)
  const blueDistance = f((maximum - blue) / delta)
  let hue =
    red === maximum
      ? f(blueDistance - greenDistance)
      : green === maximum
        ? f(f(2 + redDistance) - blueDistance)
        : f(f(4 + greenDistance) - redDistance)
  hue = f(hue / 6)
  if (hue < 0) hue = f(hue + 1)

  const sector = f(f(hue - Math.floor(hue)) * 6)
  const fraction = f(sector - Math.floor(sector))
  const dark = channel(f(brightness * f(1 - saturation)))
  const falling = channel(f(brightness * f(1 - f(saturation * fraction))))
  const rising = channel(f(brightness * f(1 - f(saturation * f(1 - fraction)))))
  const bright = channel(brightness)
  switch (Math.trunc(sector)) {
    case 0:
      return [bright, rising, dark]
    case 1:
      return [falling, bright, dark]
    case 2:
      return [dark, bright, rising]
    case 3:
      return [dark, falling, bright]
    case 4:
      return [rising, dark, bright]
    case 5:
      return [bright, dark, falling]
    default:
      return [red, green, blue]
  }
}

/** 使用账户已有 UUID 计算默认颜色，不查询用户名、不推测服务器 UUID。 */
export function getLocatorColor(uuid?: string | null): LocatorColor | null {
  if (typeof uuid !== 'string') return null
  const normalized = uuid.trim()
  if (!/^(?:[\da-f]{32}|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.test(normalized)) return null
  const compact = normalized.replaceAll('-', '')
  // XOR 四个 32 位字与 Java UUID.hashCode 等价，避免将 128 位值存入 JS Number。
  let hash = 0
  for (let offset = 0; offset < 32; offset += 8) hash ^= Number.parseInt(compact.slice(offset, offset + 8), 16)
  const rgb = Object.freeze(setLocatorBrightness((hash >>> 16) & 255, (hash >>> 8) & 255, hash & 255))
  const hex = `#${rgb
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
  return Object.freeze({ hex, rgb })
}
