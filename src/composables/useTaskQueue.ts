import { defineStore, storeToRefs } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { pinia } from '@/app/stores'

export interface Subtask {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  message: string
}

export interface TaskItem {
  id: string
  type: 'install' | 'download' | 'operation'
  operationId?: string
  operationKind?: string
  targetKey?: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'canceled'
  progress: number
  message: string
  subtasks: Subtask[]
  expanded: boolean
  timestamp: number
  versionId: string
  loaderType: string
  /** 进度模式：'bytes' 表示 done/total 为字节数，'files' 表示文件数 */
  progressType?: 'bytes' | 'files'
  /** 当前完成量（字节或文件数，取决于 progressType） */
  done?: number
  /** 总量（字节或文件数，取决于 progressType） */
  total?: number
  /** 下载文件总数 */
  totalFiles?: number
  /** 已下载文件数 */
  downloadedFiles?: number
  /** 当前下载速度，字节/秒 */
  speedBytesPerSecond?: number
}

/**
 * 任务队列全局状态（Pinia）。
 * 由 useTaskQueue() 包装暴露，保持原有 ref 语义（tasks.value 等）。
 */
export const useTaskQueueStore = defineStore('taskQueue', () => {
  const tasks = ref<TaskItem[]>([])
  const panelVisible = ref(false)

  let taskIdCounter = 0

  function generateTaskId(): string {
    taskIdCounter++
    return `task_${Date.now()}_${taskIdCounter}`
  }

  function addTask(
    task: Omit<TaskItem, 'id' | 'timestamp' | 'subtasks' | 'expanded' | 'progress' | 'message' | 'status'>,
    preferredId?: string
  ): string {
    // 外部已确定任务 ID（如启动期由后端上报）时沿用，避免进度事件对不上任务。
    const existing = preferredId && tasks.value.find((task) => task.id === preferredId)
    if (existing) {
      existing.operationId ??= task.operationId
      existing.operationKind ??= task.operationKind
      existing.targetKey ??= task.targetKey
      return existing.id
    }
    const id = preferredId || generateTaskId()
    const item: TaskItem = {
      ...task,
      id,
      timestamp: Date.now(),
      subtasks: [],
      expanded: false,
      progress: 0,
      message: '准备中...',
      status: 'pending',
    }
    tasks.value.unshift(item)
    return id
  }

  function updateTask(
    taskId: string,
    updates: Partial<
      Pick<
        TaskItem,
        | 'status'
        | 'progress'
        | 'message'
        | 'subtasks'
        | 'progressType'
        | 'done'
        | 'total'
        | 'totalFiles'
        | 'downloadedFiles'
        | 'speedBytesPerSecond'
      >
    >
  ) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    if (['completed', 'error', 'canceled'].includes(task.status)) return
    if (updates.status !== undefined) task.status = updates.status
    if (updates.status === 'error') task.expanded = true
    if (updates.progress !== undefined) task.progress = Math.min(100, Math.max(0, updates.progress))
    if (updates.message !== undefined) task.message = updates.message
    if (updates.subtasks !== undefined) task.subtasks = updates.subtasks
    if (updates.progressType !== undefined) task.progressType = updates.progressType
    if (updates.done !== undefined) task.done = updates.done
    if (updates.total !== undefined) task.total = updates.total
    if (updates.totalFiles !== undefined) task.totalFiles = updates.totalFiles
    if (updates.downloadedFiles !== undefined) task.downloadedFiles = updates.downloadedFiles
    if (updates.speedBytesPerSecond !== undefined) task.speedBytesPerSecond = updates.speedBytesPerSecond
  }

  function addSubtask(taskId: string, subtask: Subtask) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (!task) return
    const existing = task.subtasks.find((s) => s.id === subtask.id)
    if (existing) {
      existing.status = subtask.status
      existing.message = subtask.message
    } else {
      task.subtasks.push(subtask)
    }
  }

  function removeTask(taskId: string) {
    const idx = tasks.value.findIndex((t) => t.id === taskId)
    if (idx !== -1) tasks.value.splice(idx, 1)
  }

  function toggleTaskExpansion(taskId: string): void {
    const task = tasks.value.find((item) => item.id === taskId)
    if (task) task.expanded = !task.expanded
  }

  function clearFinishedTasks() {
    tasks.value = tasks.value.filter((t) => t.status === 'running' || t.status === 'pending')
  }

  function togglePanel() {
    panelVisible.value = !panelVisible.value
  }

  function openPanel() {
    panelVisible.value = true
  }

  function closePanel() {
    panelVisible.value = false
  }

  const activeCount = computed(() => tasks.value.filter((t) => t.status === 'running' || t.status === 'pending').length)
  const hasActiveTasks = computed(() => activeCount.value > 0)

  return {
    tasks,
    panelVisible,
    activeCount,
    hasActiveTasks,
    addTask,
    updateTask,
    addSubtask,
    removeTask,
    toggleTaskExpansion,
    clearFinishedTasks,
    togglePanel,
    openPanel,
    closePanel,
    generateTaskId,
  }
})

/** 任务队列组合式 API（保持原有返回形状：tasks.value 等 ref 语义） */
export function useTaskQueue() {
  const store = useTaskQueueStore(pinia)
  const { tasks, panelVisible, activeCount, hasActiveTasks } = storeToRefs(store)
  return {
    tasks: readonly(tasks),
    panelVisible,
    activeCount,
    hasActiveTasks,
    addTask: store.addTask,
    updateTask: store.updateTask,
    addSubtask: store.addSubtask,
    removeTask: store.removeTask,
    toggleTaskExpansion: store.toggleTaskExpansion,
    clearFinishedTasks: store.clearFinishedTasks,
    togglePanel: store.togglePanel,
    openPanel: store.openPanel,
    closePanel: store.closePanel,
    generateTaskId: store.generateTaskId,
  }
}

export const globalTaskQueue = useTaskQueue()
