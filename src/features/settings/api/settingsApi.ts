import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import type { ImageSaveUrlResult } from '@/types/accounts'
import type {
  ConnectorConfig,
  DownloadConfig,
  GameConfig,
  LauncherConfig,
  SystemMemoryInfo,
  UiConfig,
} from '@/types/config'
import type { JavaInstallation } from '@/types/instances'
import type { ImageSaveAsPayload } from '@/types/system'

// 图片 URL 内存缓存：避免重复 IPC 读取与解码（按路径缓存，上限 32 条）
const IMAGE_URL_CACHE_LIMIT = 32
const MAX_CACHED_DATA_URL_LENGTH = 2 * 1024 * 1024 // 超过 2MB 的 data URL 不缓存，防止内存膨胀
const imageUrlCache = new Map<string, string>()

function normalizeBackgroundDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl.startsWith('data:')) {
      resolve(dataUrl)
      return
    }
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight)
      if (scale === 1 && dataUrl.length <= MAX_CACHED_DATA_URL_LENGTH) {
        resolve(dataUrl)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(dataUrl)
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/webp', 0.82))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}

function cacheImageUrl(path: string, url: string | null): void {
  if (!url || (url.startsWith('data:') && url.length > MAX_CACHED_DATA_URL_LENGTH)) return
  if (imageUrlCache.size >= IMAGE_URL_CACHE_LIMIT) {
    const oldest = imageUrlCache.keys().next().value
    if (oldest !== undefined) imageUrlCache.delete(oldest)
  }
  imageUrlCache.set(path, url)
}

/**
 * 通过后端 IPC 读取图片为 data URL（带内存缓存）。
 */
export async function readImageFile(path: string): Promise<string | null> {
  const cached = imageUrlCache.get(path)
  if (cached) return cached
  const result = await backend.command('image_read_file', { path })
  if (!result.success) throw new Error(result.message || '读取图片失败')
  const data = result.data ?? {}
  let url: string | null = null
  if (data.dataUrl) {
    url = await normalizeBackgroundDataUrl(data.dataUrl)
  } else if (data.base64) {
    url = `data:image/png;base64,${data.base64}`
  }
  cacheImageUrl(path, url)
  return url
}

/**
 * 通过后端读取本地图片并返回可展示的 Data URL。
 * 结果按路径缓存，避免同一运行周期重复传输。
 */
export async function resolveLocalImageUrl(path: string): Promise<string | null> {
  return readImageFile(path)
}

export const settingsApi = {
  isAvailable: backend.runtime.isAvailable,
  isShowcase: backend.runtime.isShowcase,

  async load() {
    const result = await backend.config.getMany(['ui', 'game', 'download', 'launcher', 'connector'])
    const data = assertSuccess(result, '读取设置')
    return {
      ui: (data.ui ?? {}) as UiConfig,
      game: (data.game ?? {}) as GameConfig,
      download: (data.download ?? {}) as DownloadConfig,
      launcher: (data.launcher ?? {}) as LauncherConfig,
      connector: (data.connector ?? { mode: 'automatic', nodes: [] }) as ConnectorConfig,
    }
  },

  async getUi(): Promise<UiConfig> {
    return assertSuccess(await backend.config.get<UiConfig>('ui'), '读取界面设置') ?? {}
  },

  async saveUi(config: UiConfig): Promise<void> {
    assertSuccess(await backend.config.set('ui', config), '保存界面设置')
  },

  async getLauncher(): Promise<LauncherConfig> {
    return assertSuccess(await backend.config.get<LauncherConfig>('launcher'), '读取启动器设置') ?? {}
  },

  async saveLauncher(config: LauncherConfig): Promise<void> {
    assertSuccess(await backend.config.set('launcher', config), '保存启动器设置')
  },

  async saveGame(config: GameConfig): Promise<void> {
    assertSuccess(await backend.config.set('game', config), '保存设置')
  },

  async saveDownload(config: DownloadConfig): Promise<void> {
    assertSuccess(await backend.config.set('download', config), '保存下载设置')
  },

  async saveConnector(config: ConnectorConfig): Promise<void> {
    assertSuccess(await backend.config.set('connector', config), '保存联机设置')
  },

  async getSystemMemory(): Promise<SystemMemoryInfo> {
    return (
      assertSuccess(await backend.command('system_memory'), '读取系统内存') ?? {
        totalMb: 16384,
        usedMb: 4096,
        freeMb: 12288,
        percentUsed: 25,
      }
    )
  },

  async listJava(): Promise<JavaInstallation[]> {
    return assertSuccess(await backend.command('game_java_scan'), '扫描 Java') ?? []
  },

  async selectJava(): Promise<string | null> {
    const result = await backend.command('select_java')
    if (!result.success) throw new Error(result.message || '选择 Java 失败')
    return result.data?.path ?? null
  },

  async selectImage(): Promise<string | null> {
    const result = await backend.command('select_image')
    if (!result.success) throw new Error(result.message || '选择图片失败')
    return result.data?.path ?? null
  },

  async selectBackgroundVideo(): Promise<string | null> {
    const result = await backend.command('select_background_video')
    if (!result.success) throw new Error(result.message || '选择背景视频失败')
    return result.data?.path ?? null
  },

  async openBackgroundVideo(): Promise<string | null> {
    const result = await backend.command('background_video_open')
    if (!result.success) throw new Error(result.message || '加载背景视频失败')
    return result.data?.url ?? null
  },

  async selectDirectory(): Promise<string | null> {
    const result = await backend.command('select_directory')
    if (!result.success) throw new Error(result.message || '选择文件夹失败')
    return result.data?.path ?? null
  },

  async listBackgroundImages(path: string): Promise<string[]> {
    const result = await backend.command('image_list_files', { path })
    if (!result.success) throw new Error(result.message || '读取图片列表失败')
    return result.data?.files ?? []
  },

  async saveImageUrl(url: string): Promise<ImageSaveUrlResult | null> {
    const result = await backend.command('image_save_url', { url })
    if (!result.success) throw new Error(result.message || '保存远程图片失败')
    if (!result.data) return null
    return { ...result.data, dataUrl: await normalizeBackgroundDataUrl(result.data.dataUrl) }
  },

  async saveImageAs(payload: ImageSaveAsPayload): Promise<string | null> {
    const result = await backend.command('image_save_as', payload)
    if (!result.success) throw new Error(result.message || '保存图片失败')
    return result.data?.path ?? null
  },

  async readImage(path: string): Promise<string | null> {
    return readImageFile(path)
  },
}
