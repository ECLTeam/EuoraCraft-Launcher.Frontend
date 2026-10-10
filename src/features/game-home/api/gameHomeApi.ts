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

  async cancelLaunch(): Promise<void> {
    const result = await backend.command('game_launch_cancel')
    if (!result.success) throw new Error(result.message || '取消启动失败')
  },
}
