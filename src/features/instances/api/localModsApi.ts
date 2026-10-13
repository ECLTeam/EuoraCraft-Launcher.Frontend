import backend from '@/api/client'
import { invalidateResource, readResource } from '@/app/data/refreshCoordinator'
import type { ModItem } from '@/types/mods'
import { gamePathIdentity } from '@/utils/path'

function requireData<T>(response: { success: boolean; data?: T; message?: string }, operation: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || `${operation} 失败`)
  }
  return response.data
}

export const localModsApi = {
  /** 获取指定实例路径下的已安装模组列表 */
  async list(gamePath: string): Promise<ModItem[]> {
    return readResource({
      queryKey: ['local-mods', gamePathIdentity(gamePath)],
      staleTime: 0,
      load: async () => requireData(await backend.command('get_mods', { game_path: gamePath }), '获取模组列表'),
    })
  },

  /** 启用/禁用模组 */
  async toggle(gamePath: string, filename: string): Promise<{ enabled: boolean }> {
    const result = requireData(await backend.command('toggle_mod', { game_path: gamePath, filename }), '切换模组状态')
    await invalidateResource(['local-mods', gamePathIdentity(gamePath)])
    return result
  },

  /** 删除模组 */
  async remove(gamePath: string, filename: string): Promise<void> {
    const response = await backend.command('remove_mod', { game_path: gamePath, filename })
    if (!response.success) throw new Error(response.message || '删除模组失败')
    await invalidateResource(['local-mods', gamePathIdentity(gamePath)])
  },

  /** 通过文件选择器添加模组 */
  async add(gamePath: string, sourcePath: string): Promise<{ filename: string }> {
    const result = requireData(
      await backend.command('add_mod', { game_path: gamePath, source_path: sourcePath }),
      '添加模组'
    )
    await invalidateResource(['local-mods', gamePathIdentity(gamePath)])
    return result
  },

  /** 打开模组文件夹 */
  async openFolder(gamePath: string): Promise<void> {
    const response = await backend.command('open_mods_folder', { game_path: gamePath })
    if (!response.success) throw new Error(response.message || '打开模组文件夹失败')
  },
}
