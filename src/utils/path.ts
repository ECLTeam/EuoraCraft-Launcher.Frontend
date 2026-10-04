/**
 * 游戏路径规范化工具。
 */

/**
 * 统一分隔符并保留根目录与大小写，避免合并大小写敏感文件系统中的不同目录。
 */
export function normalizeGamePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  const prefix = path.trim().startsWith('\\\\') || path.trim().startsWith('//') ? '/' : ''
  const value = prefix + normalized
  if (value === '/' || /^[A-Za-z]:\/$/.test(value)) return value
  return value.replace(/\/+$/, '')
}

const rootKeyByPath = new Map<string, string>()

/** 后端解析过的实际目录身份，用于选择比较；不修改原始文件路径。 */
export function registerGamePathIdentity(path: string, rootKey: string): void {
  rootKeyByPath.set(normalizeGamePath(path), rootKey)
}

export function gamePathIdentity(path: string): string {
  return rootKeyByPath.get(normalizeGamePath(path)) ?? normalizeGamePath(path)
}
