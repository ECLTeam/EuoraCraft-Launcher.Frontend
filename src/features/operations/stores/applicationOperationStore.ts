import { defineStore } from 'pinia'
import { ref } from 'vue'
import backend from '@/api/client'
import { pinia } from '@/app/stores'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import { i18n } from '@/i18n'
import type { InstanceTargetPayload } from '@/types/instances'
import { isFinishedOperation, type ApplicationOperation } from '@/types/operations'
import { getErrorMessage } from '@/utils/error'

const defineApplicationOperationStore = defineStore('applicationOperations', () => {
  const operations = ref<Record<string, ApplicationOperation>>({})
  const targets = ref<Record<string, InstanceTargetPayload>>({})
  const queryErrors = ref<Record<string, string>>({})
  const cancellingOperations = ref<string[]>([])
  const pendingQueries = new Map<string, Promise<ApplicationOperation | null>>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const queryFailures = new Map<string, number>()
  let generation = 0

  function accept(operation: ApplicationOperation, displayName?: string): ApplicationOperation {
    const previous = operations.value[operation.operationId]
    if (previous && isFinishedOperation(previous)) return previous
    if (previous?.revision !== undefined && operation.revision !== undefined && operation.revision < previous.revision)
      return previous
    const confirmed =
      previous?.status === 'running' && operation.status === 'pending'
        ? { ...previous, kind: operation.kind || previous.kind }
        : { ...previous, ...operation }
    if (!isFinishedOperation(confirmed)) confirmed.cancellationRequested ||= previous?.cancellationRequested
    operations.value[operation.operationId] = confirmed
    const taskId = globalTaskQueue.addTask(
      {
        type: confirmed.kind === 'custom_download' ? 'download' : 'operation',
        name: displayName || confirmed.name || i18n.global.t(`operations.${confirmed.kind || 'unknown'}`),
        versionId: '',
        loaderType: '',
        operationId: operation.operationId,
        operationKind: confirmed.kind,
      },
      operation.operationId
    )
    globalTaskQueue.updateTask(taskId, {
      status:
        confirmed.status === 'failed' ? 'error' : confirmed.status === 'cancelled' ? 'canceled' : confirmed.status,
      progress: confirmed.percent,
      message: confirmed.error || confirmed.message,
      done: confirmed.done,
      total: confirmed.total,
      speedBytesPerSecond: isFinishedOperation(confirmed) ? 0 : confirmed.speed,
      progressType: confirmed.progressType,
    })
    if (isFinishedOperation(operation)) {
      clearTimeout(timers.get(operation.operationId))
      timers.delete(operation.operationId)
      delete queryErrors.value[operation.operationId]
    }
    return confirmed
  }

  function refresh(operationId: string): Promise<ApplicationOperation | null> {
    const pending = pendingQueries.get(operationId)
    if (pending) return pending
    const requestGeneration = generation
    clearTimeout(timers.get(operationId))
    timers.delete(operationId)
    const request = (async () => {
      try {
        const response = await backend.command('game_operation_get', { operation_id: operationId }, 15000)
        if (requestGeneration !== generation) return null
        if (!response.success) throw new Error(response.message || i18n.global.t('operations.queryFailed'))
        if (!response.data || response.data.operationId !== operationId)
          throw new Error(i18n.global.t('operations.queryFailed'))
        queryFailures.delete(operationId)
        delete queryErrors.value[operationId]
        return accept(response.data)
      } catch (error) {
        if (requestGeneration === generation) {
          queryErrors.value[operationId] = getErrorMessage(error)
          queryFailures.set(operationId, (queryFailures.get(operationId) ?? 0) + 1)
        }
        return null
      } finally {
        if (requestGeneration === generation) {
          pendingQueries.delete(operationId)
          const operation = operations.value[operationId]
          const failures = queryFailures.get(operationId) ?? 0
          if (operation && !isFinishedOperation(operation) && failures < 6)
            timers.set(
              operationId,
              setTimeout(() => void refresh(operationId), Math.min(10000, 700 * 2 ** failures))
            )
        }
      }
    })()
    pendingQueries.set(operationId, request)
    return request
  }

  async function track(operation: ApplicationOperation, displayName?: string): Promise<void> {
    const current = accept(operation, displayName)
    if (!isFinishedOperation(current)) await refresh(operation.operationId)
  }

  async function cancel(operationId: string): Promise<boolean> {
    const operation = operations.value[operationId]
    if (
      !operation ||
      isFinishedOperation(operation) ||
      operation.canCancel === false ||
      cancellingOperations.value.includes(operationId)
    )
      return false
    const currentGeneration = generation
    cancellingOperations.value.push(operationId)
    try {
      const response = await backend.command('game_operation_cancel', { operation_id: operationId }, 15000)
      if (!response.success) throw new Error(response.message || i18n.global.t('operations.queryFailed'))
      if (currentGeneration !== generation) return false
      const latest = operations.value[operationId]
      if (response.data && latest && !isFinishedOperation(latest)) accept({ ...latest, cancellationRequested: true })
      await refresh(operationId)
      return response.data === true
    } finally {
      if (currentGeneration === generation)
        cancellingOperations.value = cancellingOperations.value.filter((id) => id !== operationId)
    }
  }

  function stop(): void {
    generation++
    timers.forEach(clearTimeout)
    timers.clear()
    pendingQueries.clear()
    queryFailures.clear()
    cancellingOperations.value = []
  }

  return { operations, targets, queryErrors, cancellingOperations, accept, refresh, track, cancel, stop }
})

export const useApplicationOperationStore = () => defineApplicationOperationStore(pinia)
