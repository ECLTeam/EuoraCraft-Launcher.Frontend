import backend from '@/api/client'
import { accountsQuery, configQuery, pluginRegistryQuery } from '@/app/data'
import { confirmConfigWrite, serializeConfigWrite } from '@/app/data/configQueries'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { pluginHostApi } from '@/features/plugins/api/pluginHostApi'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import type { AccountListData, ImageDataUrl, ImageSelection, MinecraftAccount, SelectResult } from '@/types/accounts'
import type { ApiResponse, JsonDict } from '@/types/api'
import type { ConfigSection } from '@/types/config'
import type { InstallVersionResult, JavaInstallation, MinecraftVersion, ScannedVersion } from '@/types/instances'
import type { PluginInfo, PluginRoute, PluginSettingsData } from '@/types/plugins'
import type { FileContent, FsEntry, PathInfo } from '@/types/system'
import { getErrorMessage } from '@/utils/error'

/** 将 feature API 的已解包结果包装回 ApiResponse，保持插件侧返回契约。 */
function toApiResponse<T>(promise: Promise<T>): Promise<ApiResponse<T>> {
  return promise.then(
    (data) => ({ success: true, data, timestamp: Date.now() }),
    (error: unknown) => ({ success: false, message: getErrorMessage(error), timestamp: Date.now() })
  )
}

// ── 插件命令 ──

/**
 * 调用插件暴露的命令。
 * @param command - 命令名称
 * @param params - 命令参数
 * @returns 插件命令返回结果
 */
export function callPluginCommand<T = unknown>(command: string, params?: JsonDict): Promise<ApiResponse<T>> {
  return pluginHostApi.callCommand(command, params) as Promise<ApiResponse<T>>
}

// ── 插件设置 ──

/**
 * 获取插件的设置定义。
 * @param pluginName - 插件名称
 */
export function getPluginSettings(pluginName: string): Promise<ApiResponse<PluginSettingsData>> {
  return toApiResponse(pluginManagementApi.getSettings(pluginName))
}

/**
 * 更新插件设置项。
 * @param pluginName - 插件名称
 * @param key - 设置键
 * @param value - 设置值
 */
export function updatePluginSetting(
  pluginName: string,
  key: string,
  value: unknown,
  expectedRevision?: number
): Promise<ApiResponse<{ revision: number } | undefined>> {
  return toApiResponse(pluginManagementApi.updateSetting(pluginName, key, value, expectedRevision))
}

// ── 插件路由 ──

/**
 * 获取已注册插件路由列表。
 * @param pluginId - 可选的插件 ID 过滤（后端当前忽略该参数，返回全部路由）
 */
export function getPluginRoutes(pluginId?: string): Promise<ApiResponse<PluginRoute[]>> {
  void pluginId
  return toApiResponse(pluginRegistryQuery().then((snapshot) => snapshot.routes))
}

// ── 启动器配置 ──

/**
 * 获取启动器配置节。
 * @param section - 配置节名称
 */
export function getLauncherConfig<T = JsonDict>(section: ConfigSection): Promise<ApiResponse<T>>
export async function getLauncherConfig(section: ConfigSection): Promise<ApiResponse<unknown>> {
  if (
    section === 'ui' ||
    section === 'game' ||
    section === 'launcher' ||
    section === 'download' ||
    section === 'connector'
  ) {
    return toApiResponse(configQuery().then((config) => config[section]))
  }
  return backend.config.get(section)
}

/**
 * 设置启动器配置节。
 * @param section - 配置节名称
 * @param data - 配置数据
 */
export function setLauncherConfig(section: ConfigSection, data: JsonDict): Promise<ApiResponse<void>> {
  return serializeConfigWrite(section, async () => {
    const response = await backend.config.set(section, data)
    if (response.success) confirmConfigWrite(response.data)
    return { ...response, data: undefined }
  })
}

// ── 版本 ──

/**
 * 获取 Minecraft 版本列表。
 * @param filterType - 版本过滤类型
 */
export function getMinecraftVersions(filterType?: string): Promise<ApiResponse<MinecraftVersion[]>> {
  return backend.command('game_versions', { filter_type: filterType }) as Promise<ApiResponse<MinecraftVersion[]>>
}

/**
 * 扫描指定路径下的版本。
 * @param path - 实例路径，支持单个或多个路径；不传时由后端按配置路径扫描
 */
export function scanGameVersions(path?: string | string[]): Promise<ApiResponse<ScannedVersion[]>> {
  const paths = path ? (Array.isArray(path) ? path : [path]) : undefined
  return backend.command('game_scan', { paths })
}

/**
 * 安装版本。
 * @param params - 安装参数，包括版本 ID、加载器、任务 ID 等
 * @returns 已创建的安装任务信息
 */
export function installGameVersion(params: {
  version_id: string
  version_name?: string
  loader_type?: 'fabric' | 'forge' | 'neoforge' | 'quilt'
  loader_version?: string
  task_id?: string
  game_path: string
}): Promise<ApiResponse<InstallVersionResult>> {
  return toApiResponse(instanceInstallApi.install(params))
}

// ── Java ──

/**
 * 扫描系统中的 Java 安装。
 */
export function scanJavaInstallations(): Promise<ApiResponse<JavaInstallation[]>> {
  return backend.command('game_java_scan')
}

/**
 * 获取已记录的 Java 安装列表。
 */
export function getJavaInstallations(): Promise<ApiResponse<JavaInstallation[]>> {
  return backend.command('game_java_scan')
}

// ── 账户 ──

/**
 * 获取账户列表。
 */
export function getAccountList(): Promise<ApiResponse<AccountListData>> {
  return toApiResponse(accountsApi.list())
}

/**
 * 获取当前选中的账户。
 */
export function getCurrentAccount(): Promise<ApiResponse<MinecraftAccount | null>> {
  return toApiResponse(accountsQuery().then((snapshot) => snapshot.current))
}

// ── 文件系统 ──

/**
 * 读取目录内容。
 * @param path - 目录路径
 */
export function readDirectory(path: string): Promise<ApiResponse<FsEntry[]>> {
  return backend.fs.readDir(path)
}

/**
 * 读取文件内容。
 * @param path - 文件路径
 * @param mode - 读取模式，text 或 base64
 */
export function readFileContent(path: string, mode?: 'text' | 'base64'): Promise<ApiResponse<FileContent>> {
  return backend.fs.readFile(path, mode)
}

/**
 * 检查路径是否存在。
 * @param path - 路径
 */
export function checkPathExists(path: string): Promise<ApiResponse<PathInfo>> {
  return backend.fs.exists(path)
}

// ── 文件选择器 ──

/**
 * 打开目录选择对话框。
 */
export function selectDirectory(): Promise<ApiResponse<SelectResult>> {
  return toApiResponse(instanceInstallApi.selectDirectory()) as Promise<ApiResponse<SelectResult>>
}

/**
 * 打开文件选择对话框。
 */
export function selectFile(): Promise<ApiResponse<SelectResult>> {
  return backend.command('select_file')
}

/**
 * 打开图片选择对话框。
 */
export function selectImage(): Promise<ApiResponse<ImageSelection>> {
  return backend.command('select_image')
}

/**
 * 使用系统默认程序打开文件夹。
 * @param path - 文件夹路径
 */
export function openFolder(path: string): Promise<ApiResponse<void>> {
  return toApiResponse(instanceInstallApi.openFolder(path))
}

// ── 图片 ──

/**
 * 将图片 URL 转换为 Data URL。
 * @param url - 图片 URL
 */
export function fetchImageDataUrl(url: string): Promise<ApiResponse<ImageDataUrl>> {
  return backend.command('image_fetch_data_url', { url })
}

// ── 插件信息 ──

/**
 * 获取所有插件信息。
 */
export function getPluginList(): Promise<ApiResponse<PluginInfo[]>> {
  return toApiResponse(pluginManagementApi.list())
}

/**
 * 获取单个插件信息。
 * @param pluginName - 插件名称
 */
export function getPluginInfo(pluginName: string): Promise<ApiResponse<PluginInfo>> {
  return backend.command('plugin_info', { plugin_name: pluginName })
}
