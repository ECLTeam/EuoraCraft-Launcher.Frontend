import backend from '@/api/client'
import type { LauncherInfo } from '@/types/system'

export const aboutApi = {
  async getLauncherInfo(timeoutMs?: number): Promise<LauncherInfo | null> {
    if (!backend.runtime.isDesktop) return null

    const result = await backend.command('launcher_info', undefined, timeoutMs)
    if (!result.success || !result.data) return null
    return result.data
  },
}
