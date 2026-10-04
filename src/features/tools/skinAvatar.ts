export const avatarSizes = [64, 128, 256, 512] as const
export type AvatarSize = (typeof avatarSizes)[number]

export interface SkinPixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

export class SkinAvatarError extends Error {
  constructor(public readonly reason: 'invalidPng' | 'invalidDimensions' | 'tooLarge' | 'decodeFailed') {
    super(reason)
  }
}

const maxSkinBytes = 5 * 1024 * 1024

export function validateSkinDimensions(width: number, height: number): void {
  const scale = width / 64
  if (!Number.isInteger(scale) || scale < 1 || width > 1024 || ![32 * scale, 64 * scale].includes(height)) {
    throw new SkinAvatarError('invalidDimensions')
  }
}

export function decodeSkinBytes(base64: string): Uint8Array {
  if (base64.length > 4 * Math.ceil(maxSkinBytes / 3)) throw new SkinAvatarError('tooLarge')
  let decoded: string
  try {
    decoded = atob(base64)
  } catch {
    throw new SkinAvatarError('invalidPng')
  }
  if (decoded.length > maxSkinBytes) throw new SkinAvatarError('tooLarge')
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) {
    throw new SkinAvatarError('invalidPng')
  }
  const view = new DataView(bytes.buffer)
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw new SkinAvatarError('invalidPng')
  validateSkinDimensions(view.getUint32(16), view.getUint32(20))
  return bytes
}

export async function loadSkinPixels(base64: string, signal?: AbortSignal): Promise<SkinPixels> {
  const bytes = decodeSkinBytes(base64)
  const objectUrl = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }))
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (reason?: Error) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        if (reason) reject(reason)
        else resolve()
      }
      const abort = () => finish(new DOMException('Aborted', 'AbortError'))
      const timer = setTimeout(() => finish(new SkinAvatarError('decodeFailed')), 10_000)
      image.onload = () => finish()
      image.onerror = () => finish(new SkinAvatarError('decodeFailed'))
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) {
        abort()
        return
      }
      image.src = objectUrl
    })
    validateSkinDimensions(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new SkinAvatarError('decodeFailed')
    context.drawImage(image, 0, 0)
    return {
      width: canvas.width,
      height: canvas.height,
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    }
  } finally {
    image.onload = null
    image.onerror = null
    image.src = ''
    URL.revokeObjectURL(objectUrl)
  }
}

// 使用相同方形区域叠加帽子层，导出不沿用账户展示头像的边距和帽子放大。
export function extractAvatarPixels(skin: SkinPixels, size: AvatarSize, includeHat: boolean): Uint8ClampedArray {
  validateSkinDimensions(skin.width, skin.height)
  if (!avatarSizes.includes(size) || skin.data.length !== skin.width * skin.height * 4) {
    throw new SkinAvatarError('invalidDimensions')
  }
  const scale = skin.width / 64
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    const sourceY = 8 * scale + Math.floor((y * 8 * scale) / size)
    for (let x = 0; x < size; x++) {
      const sourceX = Math.floor((x * 8 * scale) / size)
      const face = (sourceY * skin.width + 8 * scale + sourceX) * 4
      const hat = (sourceY * skin.width + 40 * scale + sourceX) * 4
      const output = (y * size + x) * 4
      const faceAlpha = skin.data[face + 3]! / 255
      const hatAlpha = includeHat ? skin.data[hat + 3]! / 255 : 0
      const alpha = hatAlpha + faceAlpha * (1 - hatAlpha)
      for (let channel = 0; channel < 3; channel++) {
        pixels[output + channel] = alpha
          ? Math.round(
              (skin.data[hat + channel]! * hatAlpha + skin.data[face + channel]! * faceAlpha * (1 - hatAlpha)) / alpha
            )
          : 0
      }
      pixels[output + 3] = Math.round(alpha * 255)
    }
  }
  return pixels
}

export function renderAvatarPng(skin: SkinPixels, size: AvatarSize, includeHat: boolean): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new SkinAvatarError('decodeFailed')
  const image = context.createImageData(size, size)
  image.data.set(extractAvatarPixels(skin, size, includeHat))
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
