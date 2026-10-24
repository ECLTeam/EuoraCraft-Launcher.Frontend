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
  it.each(['completed', 'error', 'canceled'] as const)('主任务 %s 同步结束活动子阶段并拒绝迟到事件', (status) => {
    const queue = useTaskQueueStore(pinia)
    const id = queue.addTask({ type: 'download', name: 'Fabric', versionId: '', loaderType: '' })
    queue.addSubtask(id, { id: 'metadata', name: '信息', status: 'completed', message: '信息完成' })
    queue.addSubtask(id, { id: 'download_files', name: '下载文件', status: 'running', message: '正在下载 Fabric' })
    queue.addSubtask(id, { id: 'pending', name: '等待阶段', status: 'pending', message: '等待' })
    queue.updateTask(id, { status: 'running', speedBytesPerSecond: 100 })
    queue.updateTask(id, { status, message: '最终结果' })
    expect(queue.tasks[0]?.subtasks.map((sub) => sub.status)).toEqual(['completed', status, status])
    expect(queue.tasks[0]?.subtasks.map((sub) => sub.message)).toEqual(['信息完成', '最终结果', '最终结果'])
    expect(queue.tasks[0]?.speedBytesPerSecond).toBe(0)
    queue.addSubtask(id, { id: 'download_files', name: '下载文件', status: 'running', message: '过期下载' })
    queue.addSubtask(id, { id: 'late', name: '过期阶段', status: 'running', message: '过期下载' })
    queue.updateTask(id, { status: 'running', message: '过期下载' })
    expect(queue.tasks[0]?.status).toBe(status)
    expect(queue.tasks[0]?.subtasks).toHaveLength(3)
    expect(queue.tasks[0]?.subtasks[1]?.message).toBe('最终结果')
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
