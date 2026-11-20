/** 文件集媒体类型：图片与视频。 */
export type FileSetKind = 'image' | 'video'

/**
 * 文件集条目。
 *
 * 不含本地绝对路径；文件由内容摘要标识，改名只影响显示名。
 */
export interface FileSetItem {
  id: string
  kind: FileSetKind
  name: string
  sha256: string
  /** 含点的小写扩展名，例如 `.png`。 */
  extension: string
  byteSize: number
  /** 视频条目没有尺寸。 */
  width: number | null
  height: number | null
  createdAt: string
  updatedAt: string
}

/** 批量导入结果；单文件失败不影响其余文件。 */
export interface FileSetImportResult {
  imported: FileSetItem[]
  duplicated: FileSetItem[]
  failed: Array<{ path: string; message: string }>
}

/** 删除结果；`inUse` 为正被背景配置引用而未删除的条目。 */
export interface FileSetDeleteResult {
  deleted: string[]
  inUse: string[]
}

/** 条目定位结果，`url` 可直接用于 `img` 或 `video` 的 src。 */
export interface FileSetResolved {
  path: string
  url: string
  kind: FileSetKind
}

/** 图片缩略图地址；视频条目返回空值，由界面自行取首帧。 */
export interface FileSetThumbnail {
  path: string | null
  url: string | null
}
