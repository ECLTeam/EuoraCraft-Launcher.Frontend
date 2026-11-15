import backend from '@/api/client'
import { confirmConfigWrite, setConfigSectionSnapshot } from '@/app/data/configQueries'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import { parseSettingsSnapshot } from '@/features/settings/model/settingsSnapshot'
import type { ImageSaveUrlResult } from '@/types/accounts'
import type { DownloadConfig, GameConfig, LauncherConfig, SystemMemoryInfo, UiConfig } from '@/types/config'
import type { JavaInstallation } from '@/types/instances'
import type { ImageSaveAsPayload } from '@/types/system'

// 图片 URL 内存缓存：避免重复签发协议地址（按路径缓存，上限 32 条）
const IMAGE_URL_CACHE_LIMIT = 32
const imageUrlCache = new Map<string, string>()

function cacheImageUrl(path: string, url: string | null): void {
  if (!url) return
  if (imageUrlCache.size >= IMAGE_URL_CACHE_LIMIT) {
    const oldest = imageUrlCache.keys().next().value
    if (oldest !== undefined) imageUrlCache.delete(oldest)
  }
  imageUrlCache.set(path, url)
}

/**
 * 通过后端为本地图片签发 ecl-img 协议地址（带内存缓存）。
 */
export async function readImageFile(path: string): Promise<string | null> {
  const cached = imageUrlCache.get(path)
  if (cached) return cached
  const result = await backend.command('image_url_resolve', { kind: 'local', path })
  if (!result.success) throw new Error(result.message || '读取图片失败')
  const url = result.data?.url ?? null
  cacheImageUrl(path, url)
  return url
}

/**
 * 通过后端读取本地图片并返回可在 <img> 中直接使用的协议地址。
 * 结果按路径缓存，避免同一运行周期重复签发。
 */
export async function resolveLocalImageUrl(path: string): Promise<string | null> {
  return readImageFile(path)
}

export const settingsApi = {
  // 运行模式可能在运行期切换（如展示模式），必须惰性读取而非导入时快照；
  // 同时避免模块加载阶段就依赖 API 客户端，保证被 i18n 间接导入时安全。
  get isAvailable(): boolean {
    return backend.runtime.isAvailable
  },

  get isShowcase(): boolean {
    return backend.runtime.isShowcase
  },

  async load() {
    const result = await backend.config.getMany(['ui', 'game', 'download', 'launcher'])
    return parseSettingsSnapshot(assertSuccess(result, '读取设置'))
  },

  async getUi(): Promise<UiConfig> {
    return assertSuccess(await backend.config.get<UiConfig>('ui'), '读取界面设置') ?? {}
  },

  async saveUi(config: UiConfig): Promise<UiConfig | void> {
    const response = await backend.config.set('ui', config)
    assertSuccess(response, '保存界面设置')
    return confirmConfigWrite(response.data)?.ui
  },

  async getLauncher(): Promise<LauncherConfig> {
    return assertSuccess(await backend.config.get<LauncherConfig>('launcher'), '读取启动器设置') ?? {}
  },

  async saveLauncher(config: LauncherConfig): Promise<LauncherConfig | void> {
    const response = await backend.config.set('launcher', config)
    assertSuccess(response, '保存启动器设置')
    return confirmConfigWrite(response.data)?.launcher
  },

  async saveGame(config: GameConfig): Promise<GameConfig | void> {
    const response = await backend.config.set('game', config)
    assertSuccess(response, '保存设置')
    return confirmConfigWrite(response.data)?.game
  },

  async patchDownload(patch: Partial<DownloadConfig>): Promise<DownloadConfig> {
    const data = assertSuccess(await backend.command('settings_download_patch', patch), '保存下载设置')
    const download = parseSettingsSnapshot({ download: data }).download
    setConfigSectionSnapshot('download', download)
    return download
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
    return result.data ?? null
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
