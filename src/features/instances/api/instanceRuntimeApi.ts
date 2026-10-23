import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import type {
  CrashAnalysisResult,
  CrashCandidateFile,
  GameInstance,
  GameInstancesChangedEvent,
  VersionRunStats,
} from '@/types/instances'

let listRequest: Promise<GameInstance[]> | null = null
// 运行实例的变化版本号：变化事件与停止操作都会递增，用于丢弃已经过期的列表结果。
let listGeneration = 0

function invalidateRunningInstances(): void {
  listGeneration++
  listRequest = null
}

function listRunningInstances(): Promise<GameInstance[]> {
  if (listRequest) return listRequest

  const generation = listGeneration
  const request = backend.command('game_instances').then((response) => {
    if (generation !== listGeneration) {
      // 请求期间收到了变化事件或停止操作，本次快照已经过期，重新读取。
      listRequest = null
      return listRunningInstances()
    }
    return assertSuccess(response, '读取运行实例') ?? []
  })
  listRequest = request
  const removeRequest = () => {
    if (listRequest === request) listRequest = null
  }
  void request.then(removeRequest, removeRequest)
  return request
}

export const instanceRuntimeApi = {
  list: listRunningInstances,

  async stop(instanceId: string): Promise<void> {
    assertSuccess(await backend.command('game_instance_stop', { instance_id: instanceId }), '停止实例')
    // 停止后让进行中的列表请求失效，避免旧快照把已停止的实例又写回列表。
    invalidateRunningInstances()
  },

  async getStats(gamePath: string, versionId: string): Promise<VersionRunStats> {
    return assertSuccess(
      await backend.command('game_version_stats', { game_path: gamePath, version_id: versionId }),
      '读取版本运行统计'
    )
  },

  async listCrashCandidates(gamePath: string, versionId: string): Promise<CrashCandidateFile[]> {
    return (
      assertSuccess(
        await backend.command('game_crash_list', { game_path: gamePath, version_id: versionId }),
        '读取崩溃日志候选'
      ) ?? []
    )
  },

  async analyzeCrash(filePath: string, gamePath: string, versionId: string): Promise<CrashAnalysisResult> {
    return assertSuccess(
      await backend.command('game_crash_analyze', {
        file_path: filePath,
        game_path: gamePath,
        version_id: versionId,
      }),
      '分析崩溃日志'
    )
  },

  onChanged(handler: (payload: GameInstancesChangedEvent) => void): () => void {
    return backend.on('game:instances_changed', (payload) => {
      // 事件先让进行中的请求失效，再由调用方重新读取，保证列表反映最新状态。
      invalidateRunningInstances()
      handler(payload)
    })
  },
}
