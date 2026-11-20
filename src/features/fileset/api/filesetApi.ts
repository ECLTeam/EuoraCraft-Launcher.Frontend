import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import type {
  FileSetDeleteResult,
  FileSetImportResult,
  FileSetItem,
  FileSetResolved,
  FileSetThumbnail,
} from '@/types/fileset'

/**
 * 文件集相关 IPC 调用。
 *
 * 命令名与后端 `IpcCommandRegistry.command_names` 一一对应；所有写操作都在
 * 后端原子完成，这里只负责请求与结果校验。
 */
export const filesetApi = {
  /** 读取全部条目，按最近更新时间倒序。 */
  async list(): Promise<FileSetItem[]> {
    return assertSuccess(await backend.command('fileset_list'), '读取文件集') ?? []
  },

  /** 打开原生多选对话框，返回用户选择的本地路径。 */
  async selectFiles(): Promise<string[]> {
    const result = assertSuccess(await backend.command('select_files', { purpose: 'fileset-import' }), '选择媒体文件')
    return result?.paths ?? []
  },

  /** 批量导入本地文件；重复内容与失败项在结果中分开返回。 */
  async importFiles(paths: string[]): Promise<FileSetImportResult> {
    return assertSuccess(await backend.command('fileset_import', { paths }), '导入媒体文件')
  },

  /** 修改条目显示名，不移动磁盘文件。 */
  async rename(itemId: string, name: string): Promise<FileSetItem> {
    return assertSuccess(await backend.command('fileset_rename', { item_id: itemId, name }), '重命名条目')
  },

  /** 删除条目；被背景配置引用的条目会在 `inUse` 中返回且不会被删除。 */
  async remove(itemIds: string[]): Promise<FileSetDeleteResult> {
    return assertSuccess(await backend.command('fileset_delete', { item_ids: itemIds }), '删除条目')
  },

  /** 取得条目的真实路径与可直接加载的协议地址。 */
  async resolve(itemId: string): Promise<FileSetResolved> {
    return assertSuccess(await backend.command('fileset_resolve', { item_id: itemId }), '定位条目')
  },

  /** 取得图片缩略图地址；视频条目返回空值。 */
  async thumbnail(itemId: string): Promise<FileSetThumbnail> {
    return assertSuccess(await backend.command('fileset_thumbnail', { item_id: itemId }), '读取缩略图')
  },
}
