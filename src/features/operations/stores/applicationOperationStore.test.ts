import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pinia } from '@/app/stores'
import { useTaskQueueStore } from '@/composables/useTaskQueue'
import { useApplicationOperationStore } from './applicationOperationStore'

const mocks = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))

describe('应用任务归属与查询', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.command.mockReset()
    const store = useApplicationOperationStore()
    store.stop()
    store.operations = {}
    store.queryErrors = {}
    useTaskQueueStore(pinia).tasks = []
  })
  afterEach(() => {
    useApplicationOperationStore().stop()
    vi.useRealTimers()
  })

  it('事件早于回执只登记一次，终态拒绝迟到进度且清理后不重现', async () => {
    const store = useApplicationOperationStore()
    store.accept({ operationId: 'pack', kind: 'modpack_online_install', status: 'completed', percent: 100 })
    await store.track({ operationId: 'pack', kind: 'modpack_online_install', status: 'pending' })
    store.accept({ operationId: 'pack', status: 'running', percent: 3 })
    const queue = useTaskQueueStore(pinia)
    expect(queue.tasks).toHaveLength(1)
    expect(queue.tasks[0]?.status).toBe('completed')
    queue.clearFinishedTasks()
    store.accept({ operationId: 'pack', status: 'running' })
    expect(queue.tasks).toHaveLength(0)
    expect(mocks.command).not.toHaveBeenCalled()
  })

  it('查询失败保留运行状态和失败提示，延迟查询补齐丢失的终态', async () => {
    mocks.command
      .mockResolvedValueOnce({ success: false, message: 'offline' })
      .mockResolvedValueOnce({ success: true, data: { operationId: 'download', status: 'failed', error: 'disk full' } })
    const store = useApplicationOperationStore()
    await store.track({ operationId: 'download', kind: 'custom_download', status: 'running' })
    expect(store.operations.download?.status).toBe('running')
    expect(store.queryErrors.download).toBe('offline')
    await vi.advanceTimersByTimeAsync(1400)
    expect(store.operations.download?.status).toBe('failed')
    expect(store.queryErrors.download).toBeUndefined()
    expect(useTaskQueueStore(pinia).tasks[0]?.message).toBe('disk full')
  })

  it('旧进度与回执不回退运行状态，取消请求在执行结束前保留', async () => {
    const store = useApplicationOperationStore()
    store.accept({ operationId: 'copy', status: 'running', percent: 60, revision: 4 })
    store.accept({ operationId: 'copy', status: 'pending' })
    store.accept({ operationId: 'copy', status: 'running', percent: 2, revision: 3 })
    expect(store.operations.copy?.percent).toBe(60)
    mocks.command.mockResolvedValueOnce({ success: true, data: true }).mockResolvedValueOnce({
      success: true,
      data: { operationId: 'copy', status: 'running', revision: 4, cancellationRequested: false },
    })
    await store.cancel('copy')
    expect(store.operations.copy?.status).toBe('running')
    expect(store.operations.copy?.cancellationRequested).toBe(true)
    expect(useTaskQueueStore(pinia).activeCount).toBe(1)
    useTaskQueueStore(pinia).clearFinishedTasks()
    expect(useTaskQueueStore(pinia).tasks).toHaveLength(1)
  })

  it('旧查询不得覆盖已有终态；并发查询复用一个请求', async () => {
    let finish!: (value: unknown) => void
    mocks.command.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const store = useApplicationOperationStore()
    const tracking = store.track({ operationId: 'world', status: 'running' })
    const refresh = store.refresh('world')
    store.accept({ operationId: 'world', status: 'cancelled', message: 'stopped' })
    finish({ success: true, data: { operationId: 'world', status: 'running', percent: 10 } })
    await Promise.all([tracking, refresh])
    expect(mocks.command).toHaveBeenCalledOnce()
    expect(store.operations.world?.status).toBe('cancelled')
    await vi.advanceTimersByTimeAsync(10000)
    expect(mocks.command).toHaveBeenCalledOnce()
  })
})
