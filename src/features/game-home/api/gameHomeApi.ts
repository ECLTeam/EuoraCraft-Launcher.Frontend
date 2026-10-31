import backend from '@/api/client'
import type { InfoCardAnnouncement } from '@/types/system'

export const gameHomeApi = {
  async getAnnouncements(): Promise<InfoCardAnnouncement[]> {
    const result = await backend.command('launcher_announcements_get')
    if (!result.success || !result.data) {
      throw new Error(result.message || '读取启动器公告失败')
    }
    return result.data
  },

  /**
   * 请求取消当前启动。
   *
   * @returns 后端是否接受了取消；启动已经结束时返回 false，对调用方不算失败
   */
  async cancelLaunch(): Promise<boolean> {
    const result = await backend.command('game_launch_cancel')
    if (result.success) return true
    // 启动已经结束或本就没有启动任务时无需取消，由调用方决定如何提示。
    if (result.errorCode === 'NO_ACTIVE_LAUNCH') return false
    throw new Error(result.message || '取消启动失败')
  },
}
