/**
 * 分区子页面的运行期记忆。
 *
 * 「设置」「更多」这类页面包含多个子页面，用户离开分区再回来时应回到上次
 * 停留的子页面与滚动位置。记忆只保存在本次运行内，不写入配置文件：
 * 重启后回到各分区的默认子页面，避免配置被浏览行为污染。
 */

/** 分区根路径 → 最近访问的子页面路径 */
const lastPathBySection = new Map<string, string>()

/** 子页面路径 → 滚动位置（px） */
const scrollTopByPath = new Map<string, number>()

/**
 * 记录分区最近访问的子页面。
 *
 * :param sectionPath: 分区根路径，例如 ``/settings``
 * :param path: 实际停留的子页面路径，例如 ``/settings/game``
 */
export function rememberSectionPath(sectionPath: string, path: string): void {
  if (!sectionPath || !path) return
  lastPathBySection.set(sectionPath, path)
}

/**
 * 读取分区最近访问的子页面。
 *
 * :param sectionPath: 分区根路径
 * :param fallbackPath: 尚未访问过该分区时使用的默认子页面
 * :return: 记忆中的子页面路径，未记录时返回 ``fallbackPath``
 */
export function recallSectionPath(sectionPath: string, fallbackPath: string): string {
  return lastPathBySection.get(sectionPath) ?? fallbackPath
}

/**
 * 记录子页面的滚动位置，供返回该子页面时恢复。
 *
 * :param path: 子页面路径
 * :param scrollTop: 滚动容器当前的垂直偏移
 */
export function rememberSectionScroll(path: string, scrollTop: number): void {
  if (!path) return
  scrollTopByPath.set(path, Math.max(0, Math.round(scrollTop)))
}

/**
 * 读取子页面上次的滚动位置。
 *
 * :param path: 子页面路径
 * :return: 上次的垂直偏移，未记录时为 0
 */
export function recallSectionScroll(path: string): number {
  return scrollTopByPath.get(path) ?? 0
}

/** 清空全部记忆，供测试与需要重置界面状态的场景使用 */
export function resetSectionMemory(): void {
  lastPathBySection.clear()
  scrollTopByPath.clear()
}
