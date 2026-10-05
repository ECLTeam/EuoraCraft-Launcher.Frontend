import { toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import type { InstanceTargetPayload } from '@/types/instances'
import { gamePathIdentity } from '@/utils/path'

/** 只在当前实例的操作执行成功后刷新一次；跨页的结果仍由应用任务列表保留。 */
export function useTargetOperationRefresh(
  target: MaybeRefOrGetter<InstanceTargetPayload | null>,
  refresh: () => Promise<void>
): void {
  const store = useApplicationOperationStore()
  const processed = new Set(
    Object.values(store.operations)
      .filter((operation) => operation.status === 'completed')
      .map((operation) => operation.operationId)
  )
  watch(
    () => [store.operations, store.targets],
    () => {
      const current = toValue(target)
      if (!current) return
      let shouldRefresh = false
      for (const operation of Object.values(store.operations)) {
        const operationTarget = store.targets[operation.operationId]
        if (operation.status !== 'completed' || processed.has(operation.operationId) || !operationTarget) continue
        processed.add(operation.operationId)
        if (
          gamePathIdentity(operationTarget.game_path) === gamePathIdentity(current.game_path) &&
          operationTarget.version_id === current.version_id &&
          !!operationTarget.version_isolation === !!current.version_isolation
        )
          shouldRefresh = true
      }
      if (shouldRefresh) void refresh().catch((error) => console.warn('刷新实例操作结果失败', error))
    },
    { deep: true, flush: 'post' }
  )
}
