import backend from '@/api/client'
import type { CommandPayloadMap } from '@/types/api'
import type { ModInfo, ModInstallResult, ModSearchResult, ModSourceConfig, ModVersion } from '@/types/mods'

function requireData<T>(
  response: { success: boolean; data?: T; message?: string; errorCode?: string },
  operation: string
): T {
  if (!response.success || response.data === undefined)
    throw Object.assign(new Error(response.message || `${operation}失败`), { code: response.errorCode })
  return response.data
}

export const modApi = {
  async search(payload: CommandPayloadMap['search_mods']): Promise<ModSearchResult> {
    return requireData(await backend.command('search_mods', payload), '搜索模组')
  },

  async sourceConfig(): Promise<ModSourceConfig> {
    return requireData(await backend.command('mod_source_config'), '读取资源来源配置')
  },

  async info(payload: CommandPayloadMap['get_mod_info']): Promise<ModInfo> {
    return requireData(await backend.command('get_mod_info', payload), '获取模组信息')
  },

  async versions(payload: CommandPayloadMap['get_mod_versions']): Promise<ModVersion[]> {
    return requireData(await backend.command('get_mod_versions', payload), '获取模组版本')
  },

  async install(payload: CommandPayloadMap['download_mod']): Promise<ModInstallResult> {
    return requireData(await backend.command('download_mod', payload), '安装模组')
  },

  async downloadToPath(payload: CommandPayloadMap['download_mod_to_path']): Promise<{ filename: string }> {
    return requireData(await backend.command('download_mod_to_path', payload), '另存模组')
  },

  async openUrl(url: string): Promise<void> {
    const response = await backend.command('open_url', { url })
    if (!response.success) throw new Error(response.message || '打开链接失败')
  },
}
