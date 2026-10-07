<template>
  <FullscreenModal
    v-model:visible="panelVisible"
    :showFooter="false"
    :title="t('taskQueue.title')"
    bodyClass="task-queue-body"
    wrapperClass="task-queue-wrapper"
  >
    <div class="tq-content">
      <PluginSlotHost slotId="plugin-slot-task-queue-top" class="plugin-slot-container" />
      <!-- 空状态 -->
      <div v-if="tasks.length === 0" class="tq-empty">
        <UiIcon name="download" :size="64" class="tq-empty-icon" />
        <p class="tq-empty-text">
          {{ t('taskQueue.empty') }}
        </p>
        <p class="tq-empty-hint">
          {{ t('taskQueue.emptyHint') }}
        </p>
      </div>

      <div v-else class="tq-body">
        <!-- 任务列表：全大卡片 -->
        <div class="tq-list">
          <div class="tq-toolbar">
            <span class="tq-status-text">
              {{ activeCount > 0 ? t('taskQueue.runningCount', { count: activeCount }) : t('taskQueue.allFinished') }}
            </span>
            <button class="tq-clear-btn" :disabled="finishedCount === 0" @click="clearFinishedTasks">
              {{ t('taskQueue.clearFinishedTasks', { count: finishedCount }) }}
            </button>
          </div>
          <div v-for="task in tasks" :key="task.id" :class="['tq-task', `tq-task--${task.status}`]">
            <div class="tq-task-top">
              <div
                class="tq-task-header"
                role="button"
                tabindex="0"
                :aria-expanded="task.expanded"
                @click="toggleExpand(task.id)"
                @keydown.enter.self="toggleExpand(task.id)"
                @keydown.space.self.prevent="toggleExpand(task.id)"
              >
                <div class="tq-task-main">
                  <div class="tq-task-icon">
                    <UiLoading v-if="task.status === 'running'" mode="inline" size="md" decorative />
                    <UiIcon v-else-if="task.status === 'completed'" name="check" :size="18" class="tq-icon-success" />
                    <UiIcon v-else-if="task.status === 'error'" name="x-mark" :size="18" class="tq-icon-error" />
                    <UiIcon v-else-if="task.status === 'canceled'" name="x-mark" :size="18" class="tq-icon-muted" />
                    <UiIcon v-else name="package" :size="18" class="tq-icon-muted" />
                  </div>
                  <div class="tq-task-info">
                    <div class="tq-task-name" :title="task.name">{{ task.name }}</div>
                    <div class="tq-task-meta">
                      <span class="tq-task-state">{{ t(`taskQueue.states.${task.status}`) }}</span>
                      <span v-if="task.loaderType" class="tq-task-type">{{ getLoaderLabel(task.loaderType) }}</span>
                      <span v-if="task.versionId" class="tq-task-ver">{{ task.versionId }}</span>
                      <span
                        v-if="task.status === 'running' || task.status === 'pending'"
                        class="tq-task-phase"
                        :title="task.message"
                        >{{ task.message }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div class="tq-task-actions">
                <button
                  v-if="task.operationId && (task.status === 'pending' || task.status === 'running')"
                  class="tq-clear-btn"
                  :disabled="
                    operationStore.cancellingOperations.includes(task.operationId) ||
                    operationStore.operations[task.operationId]?.canCancel === false ||
                    operationStore.operations[task.operationId]?.cancellationRequested
                  "
                  @click="cancelOperation(task.operationId)"
                >
                  {{
                    operationStore.operations[task.operationId]?.cancellationRequested
                      ? t('operations.cancelRequested')
                      : t('common.cancel')
                  }}
                </button>
                <button
                  v-if="task.operationId && operationStore.queryErrors[task.operationId]"
                  class="tq-clear-btn"
                  @click="operationStore.refresh(task.operationId)"
                >
                  {{ t('operations.refresh') }}
                </button>
                <button
                  v-if="task.status === 'completed' || task.status === 'error' || task.status === 'canceled'"
                  class="tq-remove-btn"
                  :title="t('common.remove')"
                  :aria-label="t('common.remove')"
                  @click="removeTask(task.id)"
                >
                  <UiIcon name="x-mark" :size="14" />
                </button>
              </div>
            </div>
            <div class="tq-task-progress">
              <UiProgress
                :percentage="taskProgress(task)"
                :processing="(task.status === 'pending' || task.status === 'running') && taskProgress(task) <= 0"
                :height="4"
              />
              <span class="tq-progress-text">{{ taskProgress(task) > 0 ? taskProgress(task) + '%' : '...' }}</span>
            </div>
            <div
              v-if="showTaskStats(task) || (task.operationId && operationStore.queryErrors[task.operationId])"
              class="tq-task-stats"
            >
              <span v-if="task.totalFiles != null" class="tq-stat tq-stat-files">
                <UiIcon name="file-text" :size="12" />
                {{ task.downloadedFiles ?? 0 }} / {{ task.totalFiles }} {{ t('taskQueue.files') }}
              </span>
              <span v-if="task.progressType === 'bytes' && task.total" class="tq-stat tq-stat-bytes">
                {{ formatBytes(task.done ?? 0) }} / {{ formatBytes(task.total) }}
              </span>
              <span v-if="task.status === 'running' && task.speedBytesPerSecond" class="tq-stat tq-stat-speed">
                <UiIcon name="download" :size="12" />
                {{ formatSpeed(task.speedBytesPerSecond) }}
              </span>
              <span
                v-if="task.operationId && operationStore.queryErrors[task.operationId]"
                class="tq-query-error"
                role="alert"
                >{{ t('operations.queryFailed') }}</span
              >
            </div>

            <Transition name="tq-expand">
              <div v-if="task.expanded" class="tq-task-detail">
                <div class="tq-task-message">
                  <span class="tq-msg-label">{{ t('taskQueue.currentStatus') }}</span>
                  <span>{{ task.message }}</span>
                </div>

                <div v-if="task.subtasks.length > 0" class="tq-subtasks">
                  <div v-for="sub in task.subtasks" :key="sub.id" :class="['tq-subtask', `tq-subtask--${sub.status}`]">
                    <UiLoading v-if="sub.status === 'running'" mode="inline" size="xs" decorative />
                    <UiIcon v-else-if="sub.status === 'completed'" name="check" :size="12" class="tq-icon-success" />
                    <UiIcon v-else-if="sub.status === 'error'" name="x-mark" :size="12" class="tq-icon-error" />
                    <UiIcon v-else name="circle" :size="8" class="tq-icon-muted" />
                    <span class="tq-subtask-name">{{ sub.name }}</span>
                    <span class="tq-subtask-msg">{{ sub.message }}</span>
                  </div>
                </div>
              </div>
            </Transition>
            <PluginSlotHost
              slotId="plugin-slot-task-queue-item-actions"
              :contextKey="task.id"
              class="plugin-slot-container"
            />
          </div>
        </div>

        <!-- 实时下载详情卡：仅存在下载指标的任务时显示 -->
        <Transition name="tq-fade">
          <div v-if="activeDownload" class="tq-live">
            <div class="tq-live-header">
              <div class="tq-live-title">
                <UiIcon name="download" :size="16" class="tq-live-title-icon" />
                <span>{{ t('taskQueue.liveTitle') }}</span>
              </div>
              <span v-if="activeDownload.totalFiles != null" class="tq-live-filecount">
                {{
                  t('taskQueue.filesProgress', {
                    done: activeDownload.downloadedFiles ?? 0,
                    total: activeDownload.totalFiles,
                  })
                }}
              </span>
            </div>

            <div class="tq-live-name">{{ activeDownload.name }}</div>
            <div class="tq-live-msg">{{ activeDownload.message }}</div>

            <!-- 实时网速曲线图 -->
            <div class="tq-live-chart">
              <span class="tq-live-chart-badge">
                {{
                  activeDownload.speedBytesPerSecond && activeDownload.speedBytesPerSecond > 0
                    ? formatSpeed(activeDownload.speedBytesPerSecond)
                    : '—'
                }}
              </span>
              <svg class="tq-live-chart-svg" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
                <polygon v-if="chartArea" :points="chartArea" class="tq-live-chart-area" />
                <polyline v-if="chartLine" :points="chartLine" class="tq-live-chart-line" />
              </svg>
              <span class="tq-live-chart-window">
                {{ t('taskQueue.chartWindow', { seconds: speedSamples.length }) }}
              </span>
              <span v-if="chartPeak" class="tq-live-chart-peak">
                {{ t('taskQueue.peakLabel') }} {{ formatSpeed(chartPeak) }}
              </span>
            </div>

            <div class="tq-live-metrics">
              <div class="tq-live-metric">
                <span class="tq-live-metric-label">{{ t('taskQueue.elapsedLabel') }}</span>
                <span class="tq-live-metric-value">{{ formatDuration(elapsed) }}</span>
              </div>
              <div class="tq-live-metric">
                <span class="tq-live-metric-label">{{ t('taskQueue.remainingLabel') }}</span>
                <span class="tq-live-metric-value">{{ remainingText }}</span>
              </div>
            </div>

            <div class="tq-live-progress">
              <UiProgress class="tq-live-bar" :percentage="livePct" :processing="livePct <= 0" :height="6" />
              <span class="tq-live-pct">
                {{ livePct > 0 ? livePct + '%' : '...' }}
              </span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </FullscreenModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiProgress from '@/components/ui/Progress.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { globalTaskQueue, type TaskItem } from '@/composables/useTaskQueue'
import { getLoaderLabel } from '@/config/version'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'

defineOptions({ name: 'TaskQueuePanel' })

const { t } = useI18n()
const operationStore = useApplicationOperationStore()
const { run } = useAsyncAction()
const cancelOperation = (operationId: string) => run(() => operationStore.cancel(operationId))

const { tasks, panelVisible, activeCount, removeTask, clearFinishedTasks: queueClearFinishedTasks } = globalTaskQueue

const finishedCount = computed(
  () => tasks.value.filter((t) => t.status === 'completed' || t.status === 'error' || t.status === 'canceled').length
)

/** 正在下载且携带下载指标（字节/速度优先，其次文件数）的任务，作为实时下载卡的数据源 */
const activeDownload = computed(() => {
  const running = tasks.value.filter((t) => t.status === 'running')
  return (
    running.find((t) => t.progressType === 'bytes' || (t.speedBytesPerSecond != null && t.speedBytesPerSecond > 0)) ??
    running.find((t) => t.totalFiles != null || t.downloadedFiles != null) ??
    null
  )
})

function normalizeProgress(value: number): number {
  return Number.isFinite(value) ? Math.round(Math.min(100, Math.max(0, value))) : 0
}

function taskProgress(task: TaskItem): number {
  return task.status === 'completed' ? 100 : normalizeProgress(task.progress)
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

function formatSpeed(speed: number): string {
  return `${formatBytes(speed)}/s`
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

const livePct = computed(() => {
  const task = activeDownload.value
  if (!task) return 0
  if (task.totalFiles != null && task.totalFiles > 0) {
    return normalizeProgress(((task.downloadedFiles ?? 0) / task.totalFiles) * 100)
  }
  if (task.progressType === 'bytes' && task.total) {
    return normalizeProgress(((task.done ?? 0) / task.total) * 100)
  }
  return taskProgress(task)
})

/** 下载中实时刷新经过时间与网速采样（从任务创建时刻起） */
const elapsed = ref(0)
const MAX_SAMPLES = 60
const speedSamples = ref<number[]>([])
let liveTimer: ReturnType<typeof setInterval> | null = null

function updateTick(): void {
  const task = activeDownload.value
  elapsed.value = task ? Math.floor((Date.now() - task.timestamp) / 1000) : 0
  const speed = task?.speedBytesPerSecond != null && task.speedBytesPerSecond > 0 ? task.speedBytesPerSecond : 0
  speedSamples.value.push(speed)
  if (speedSamples.value.length > MAX_SAMPLES) speedSamples.value.shift()
}

watch(activeDownload, (task) => {
  if (liveTimer) {
    clearInterval(liveTimer)
    liveTimer = null
  }
  speedSamples.value = []
  if (task) {
    updateTick()
    liveTimer = setInterval(updateTick, 1000)
  } else {
    elapsed.value = 0
  }
})

onBeforeUnmount(() => {
  if (liveTimer) clearInterval(liveTimer)
})

/** 网速曲线图几何：以窗口内最大速率归一化绘制折线与填充区域 */
const CHART_W = 100
const CHART_H = 36
const chartPeak = computed(() => {
  const peak = Math.max(0, ...speedSamples.value)
  return peak > 0 ? peak : 0
})
const chartLine = computed(() => {
  const n = speedSamples.value.length
  if (n === 0) return ''
  const max = chartPeak.value || 1
  return speedSamples.value
    .map((s, i) => {
      const x = n === 1 ? 0 : (i / (n - 1)) * CHART_W
      const y = CHART_H - Math.min(1, s / max) * (CHART_H - 4) - 2
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})
const chartArea = computed(() => {
  const n = speedSamples.value.length
  if (n < 2) return ''
  const line = chartLine.value
  if (!line) return ''
  const lastX = n === 1 ? 0 : CHART_W
  return `0,${CHART_H} ${line} ${lastX},${CHART_H}`
})

/** 字节进度依据实时速度估算剩余时间；文件/无量纲进度无剩余时间 */
const remainingText = computed(() => {
  const task = activeDownload.value
  const speed = task?.speedBytesPerSecond ?? 0
  if (task?.progressType === 'bytes' && task.total && speed > 0) {
    return formatDuration((task.total - (task.done ?? 0)) / speed)
  }
  return '—'
})

function showTaskStats(task: TaskItem): boolean {
  return (
    task.totalFiles != null ||
    (task.progressType === 'bytes' && !!task.total) ||
    (task.status === 'running' && !!task.speedBytesPerSecond)
  )
}

function clearFinishedTasks() {
  queueClearFinishedTasks()
  if (tasks.value.length === 0) {
    panelVisible.value = false
  }
}

function toggleExpand(taskId: string) {
  globalTaskQueue.toggleTaskExpansion(taskId)
}
</script>

<style scoped src="@/styles/components/panels/TaskQueuePanel.css"></style>
