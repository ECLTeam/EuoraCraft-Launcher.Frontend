import { beforeEach, describe, expect, it } from 'vitest'
import { pinia } from '@/app/stores'
import { useTaskQueueStore } from './useTaskQueue'

describe('全局任务队列', () => {
  beforeEach(() => {
    useTaskQueueStore(pinia).tasks = []
  })
  it('事件与回执重复登记同一标识时只保留一个任务', () => {
    const queue = useTaskQueueStore(pinia)
    const task = { type: 'download' as const, name: 'file', versionId: '', loaderType: '' }
    expect(queue.addTask(task, 'backend-id')).toBe('backend-id')
    expect(queue.addTask(task, 'backend-id')).toBe('backend-id')
    expect(queue.tasks).toHaveLength(1)
  })
  it('迟到进度不能复活失败任务或覆盖原因', () => {
    const queue = useTaskQueueStore(pinia)
    const id = queue.addTask({ type: 'download', name: 'file', versionId: '', loaderType: '' })
    queue.updateTask(id, { status: 'error', message: 'failed' })
    queue.updateTask(id, { status: 'running', message: 'old progress' })
    expect(queue.tasks[0]?.status).toBe('error')
    expect(queue.tasks[0]?.message).toBe('failed')
  })
  it('清理已结束包含失败和取消，保留等待及运行任务', () => {
    const queue = useTaskQueueStore(pinia)
    for (const status of ['completed', 'error', 'canceled', 'pending', 'running'] as const) {
      const id = queue.addTask({ type: 'download', name: status, versionId: '', loaderType: '' })
      queue.updateTask(id, { status })
    }
    queue.clearFinishedTasks()
    expect(queue.tasks.map((task) => task.status).sort()).toEqual(['pending', 'running'])
  })
})
