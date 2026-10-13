import { queryKeys } from '@/app/queryKeys'
import { aboutApi } from '@/features/settings/api/aboutApi'
import type { LauncherInfo } from '@/types/system'
import { invalidateResource, readResource } from './refreshCoordinator'

/** 宿主运行信息跨页面共享；首次未就绪时不将空结果长期缓存。 */
export async function launcherInfoQuery(): Promise<LauncherInfo | null> {
  const info = await readResource({
    queryKey: queryKeys.launcherInfo,
    load: () => aboutApi.getLauncherInfo(3000),
    staleTime: Infinity,
  })
  if (info === null) await invalidateResource(queryKeys.launcherInfo)
  return info
}
