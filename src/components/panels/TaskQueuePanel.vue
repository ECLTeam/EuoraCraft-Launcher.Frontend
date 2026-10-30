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
            <div class="tq-task-top" :class="{ 'tq-task-top--downloading': isDownloadTask(task) }">
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
                        :title="taskMessage(task)"
                        >{{ taskMessage(task) }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="isDownloadTask(task)"
                class="tq-task-speed"
                role="img"
                :aria-label="t('taskQueue.speedDescription', { speed: speedText(task) })"
              >
                <svg class="tq-speed-graph" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
                  <path v-if="task.chart.area" :d="task.chart.area" class="tq-speed-area" />
                  <path v-if="task.chart.line" :d="task.chart.line" class="tq-speed-line" />
                  <circle
                    v-for="point in task.chart.dots"
                    :key="point.x"
                    :cx="point.x"
                    :cy="point.y"
                    r="1.5"
                    class="tq-speed-dot"
                  />
                </svg>
                <span class="tq-speed-value">{{ speedText(task) }}</span>
              </div>
              <div class="tq-task-actions">
                <button
                  v-if="
                    task.operationId &&
                    ['instance_import', 'modpack_online_install'].includes(task.operationKind || '') &&
                    ['completed', 'error', 'canceled'].includes(task.status)
                  "
                  class="tq-clear-btn"
                  @click="showModpackResult(task.operationId)"
                >
                  {{ t('modpackWizard.viewResult') }}
                </button>
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
            <div v-if="task.installation" class="tq-stage-summary">
              <span>{{ stagePosition(task) }}</span>
              <span v-if="stageAction(task)">{{ stageAction(task) }}</span>
            </div>
            <div class="tq-task-progress">
              <UiProgress :percentage="taskProgress(task)" :processing="taskIndeterminate(task)" :height="4" />
              <span class="tq-progress-text">{{ progressText(task) }}</span>
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
              <span
                v-if="task.installation && task.progressType !== 'bytes' && task.transferredBytes != null"
                class="tq-stat tq-stat-bytes"
              >
                {{ t('taskQueue.installation.transferred', { amount: formatBytes(task.transferredBytes) }) }}
              </span>
              <span v-if="task.installation && task.isDownloading && task.progressType !== 'bytes'" class="tq-stat">
                {{ t('taskQueue.installation.unknownSize') }}
              </span>
              <template v-if="isDownloadTask(task)">
                <span class="tq-stat">{{ t('taskQueue.elapsedLabel') }} {{ elapsedText(task) }}</span>
                <span class="tq-stat">{{ t('taskQueue.remainingLabel') }} {{ remainingText(task) }}</span>
              </template>
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
                  <span>{{ taskMessage(task) }}</span>
                </div>

                <div v-if="isDownloadTask(task)" class="tq-speed-details">
                  <span>{{ t('taskQueue.chartWindow', { seconds: task.chart.sampleCount }) }}</span>
                  <span
                    >{{ t('taskQueue.peakLabel') }} {{ task.chart.hasSpeed ? formatSpeed(task.chart.peak) : '—' }}</span
                  >
                </div>
                <div v-if="task.installation" class="tq-subtasks">
                  <div
                    v-for="stage in task.installation.stages"
                    :key="stage.id"
                    :class="['tq-subtask', `tq-subtask--${stage.status}`]"
                  >
                    <UiLoading v-if="stage.status === 'running'" mode="inline" size="xs" decorative />
                    <UiIcon v-else-if="stage.status === 'completed'" name="check" :size="12" class="tq-icon-success" />
                    <UiIcon
                      v-else-if="stage.status === 'error' || stage.status === 'canceled'"
                      name="x-mark"
                      :size="12"
                      class="tq-icon-error"
                    />
                    <UiIcon v-else name="circle" :size="8" class="tq-icon-muted" />
                    <span class="tq-subtask-name">{{ t(`taskQueue.installation.stages.${stage.id}`) }}</span>
                    <span class="tq-subtask-msg">{{ t(`taskQueue.installation.states.${stage.status}`) }}</span>
                  </div>
                </div>
                <div v-else-if="task.subtasks.length > 0" class="tq-subtasks">
                  <div v-for="sub in task.subtasks" :key="sub.id" :class="['tq-subtask', `tq-subtask--${sub.status}`]">
                    <UiLoading v-if="sub.status === 'running'" mode="inline" size="xs" decorative />
                    <UiIcon v-else-if="sub.status === 'completed'" name="check" :size="12" class="tq-icon-success" />
                    <UiIcon v-else-if="sub.status === 'error'" name="x-mark" :size="12" class="tq-icon-error" />
                    <UiIcon v-else-if="sub.status === 'canceled'" name="x-mark" :size="12" class="tq-icon-muted" />
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
import { useModpackImportStore } from '@/features/instances/stores/modpackImportStore'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { currentInstallationStage, installationPercentage } from '@/types/installation'

defineOptions({ name: 'TaskQueuePanel' })

const { t, te } = useI18n()
const operationStore = useApplicationOperationStore()
const { run } = useAsyncAction()
const cancelOperation = (operationId: string) => run(() => operationStore.cancel(operationId))
const showModpackResult = (operationId: string) => {
  globalTaskQueue.panelVisible.value = false
  void useModpackImportStore().openResult(operationId)
}

const {
  tasks: queueTasks,
  panelVisible,
  activeCount,
  removeTask,
  clearFinishedTasks: queueClearFinishedTasks,
} = globalTaskQueue

interface SpeedHistory {
  stageId: string
  samples: Array<number | null>
}
const speedHistoryByTask = ref(new Map<string, SpeedHistory>())
const now = ref(Date.now())
let sampleTimer: ReturnType<typeof setInterval> | null = null

function downloadStageId(task: TaskItem): string {
  return task.installation?.currentStageId ?? ''
}

function currentSpeed(task: TaskItem): number | null {
  const speed = task.speedBytesPerSecond
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : null
}

function speedChart(task: TaskItem) {
  const history = speedHistoryByTask.value.get(task.id)
  const samples = history?.stageId === downloadStageId(task) ? history.samples : []
  const speeds = samples.filter((speed): speed is number => speed !== null)
  const peak = Math.max(0, ...speeds)
  const segments: Array<Array<{ x: number; y: number }>> = []
  let points: Array<{ x: number; y: number }> = []
  samples.forEach((speed, index) => {
    if (speed === null) {
      if (points.length) segments.push(points)
      points = []
      return
    }
    const x = samples.length === 1 ? 98 : 2 + (index / (samples.length - 1)) * 96
    const y = 33 - (speed / (peak || 1)) * 30
    points.push({ x, y })
  })
  if (points.length) segments.push(points)
  const lines = segments.filter((segment) => segment.length > 1)
  const pathFor = (segment: Array<{ x: number; y: number }>) =>
    segment.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  return {
    line: lines.map(pathFor).join(' '),
    area: lines
      .map(
        (segment) =>
          `${pathFor(segment)} L${segment[segment.length - 1]!.x.toFixed(2)},36 L${segment[0]!.x.toFixed(2)},36 Z`
      )
      .join(' '),
    dots: segments.filter((segment) => segment.length === 1).map((segment) => segment[0]!),
    peak,
    hasSpeed: speeds.length > 0,
    sampleCount: samples.length,
  }
}

function taskView(task: TaskItem) {
  if (!task.installation)
    return { ...task, chart: speedChart(task), isDownloading: undefined, transferredBytes: undefined }
  const stage = currentInstallationStage(task.installation)
  const download = stage?.status === 'running' ? stage.download : null
  return {
    ...task,
    chart: speedChart(task),
    progress: installationPercentage(task.installation) ?? 0,
    progressType: stage?.progress.unit === 'bytes' ? ('bytes' as const) : undefined,
    done: stage?.progress.completed,
    total: stage?.progress.total ?? undefined,
    totalFiles: download?.totalFiles ?? undefined,
    downloadedFiles: download?.completedFiles,
    speedBytesPerSecond: download?.speedBytesPerSecond ?? 0,
    transferredBytes: download?.transferredBytes,
    isDownloading: !!download && stage?.action !== 'preflight',
  }
}
const tasks = computed(() => queueTasks.value.map(taskView))

function taskMessage(task: TaskItem): string {
  const installation = task.installation
  if (task.operationKind?.startsWith('plugin_game_') && !installation) {
    const operation = task.operationId ? operationStore.operations[task.operationId] : undefined
    if (task.status !== 'running') {
      const errorKey = `plugins.errors.${operation?.errorCode}`
      if (task.status === 'error' && te(errorKey)) return t(errorKey)
      if (task.status !== 'error') return t(`taskQueue.states.${task.status}`)
    }
    if (task.status === 'running' && task.operationKind === 'plugin_game_stop')
      return t('operations.pluginPhases.stopping')
    if (task.status === 'running' && task.operationKind === 'plugin_game_launch') {
      switch (operation?.stage) {
        case 'checking':
        case 'inherited_version':
        case 'files_checked':
        case 'downloading':
          return t('operations.pluginPhases.checking')
        case 'launching':
        case 'about_to_launch':
        case 'launched':
          return t('operations.pluginPhases.creating')
        default:
          return t('operations.pluginPhases.preparing')
      }
    }
  }
  if (!installation) return task.message
  if (installation.cancellationRequested && installation.status === 'running') return t('operations.cancelRequested')
  if (installation.status === 'error' || installation.status === 'canceled') return installation.message
  const stage = currentInstallationStage(installation)
  return stage ? t(`taskQueue.installation.stages.${stage.id}`) : task.message
}
function stagePosition(task: TaskItem): string {
  const installation = task.installation
  if (!installation) return ''
  return t('taskQueue.installation.step', {
    current: Math.max(1, installation.stages.findIndex((stage) => stage.id === installation.currentStageId) + 1),
    total: installation.stages.length,
  })
}
function stageAction(task: TaskItem): string {
  const stage = currentInstallationStage(task.installation)
  if (!stage || stage.status !== 'running' || stage.action === 'working') return ''
  return t(`taskQueue.installation.actions.${stage.action}`)
}
function taskIndeterminate(task: TaskItem): boolean {
  if (task.status !== 'pending' && task.status !== 'running') return false
  return task.installation ? installationPercentage(task.installation) === null : taskProgress(task) <= 0
}
function progressText(task: TaskItem): string {
  if (task.installation) {
    if (task.status === 'completed') return '100%'
    const percentage = installationPercentage(task.installation)
    return percentage === null ? '—' : `${percentage}%`
  }
  return taskProgress(task) > 0 ? `${taskProgress(task)}%` : '...'
}

const finishedCount = computed(
  () => tasks.value.filter((t) => t.status === 'completed' || t.status === 'error' || t.status === 'canceled').length
)

function isDownloadTask(task: ReturnType<typeof taskView>): boolean {
  if (task.status !== 'running') return false
  if (task.installation) return task.isDownloading === true
  return (
    task.progressType === 'bytes' ||
    task.speedBytesPerSecond != null ||
    task.totalFiles != null ||
    task.downloadedFiles != null
  )
}

const downloadingTasks = computed(() => tasks.value.filter(isDownloadTask))

function stopSampling(): void {
  if (sampleTimer) clearInterval(sampleTimer)
  sampleTimer = null
  speedHistoryByTask.value.clear()
}

function sampleDownloads(): void {
  now.value = Date.now()
  for (const task of downloadingTasks.value) {
    const history = speedHistoryByTask.value.get(task.id)
    if (!history || history.stageId !== downloadStageId(task)) continue
    history.samples.push(currentSpeed(task))
    if (history.samples.length > 60) history.samples.shift()
  }
}

watch(
  () =>
    panelVisible.value
      ? JSON.stringify(downloadingTasks.value.map((task) => [task.id, downloadStageId(task)]).sort())
      : '',
  () => {
    if (!panelVisible.value || downloadingTasks.value.length === 0) {
      stopSampling()
      return
    }
    const activeIds = new Set(downloadingTasks.value.map((task) => task.id))
    for (const id of speedHistoryByTask.value.keys()) {
      if (!activeIds.has(id)) speedHistoryByTask.value.delete(id)
    }
    now.value = Date.now()
    for (const task of downloadingTasks.value) {
      const history = speedHistoryByTask.value.get(task.id)
      if (history?.stageId !== downloadStageId(task)) {
        speedHistoryByTask.value.set(task.id, { stageId: downloadStageId(task), samples: [currentSpeed(task)] })
      }
    }
    if (!sampleTimer) sampleTimer = setInterval(sampleDownloads, 1000)
  },
  { immediate: true }
)
onBeforeUnmount(stopSampling)

function speedText(task: TaskItem): string {
  const speed = currentSpeed(task)
  return speed === null ? '—' : formatSpeed(speed)
}

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

function elapsedText(task: TaskItem): string {
  const startedAt = currentInstallationStage(task.installation)?.startedAt ?? task.timestamp
  return formatDuration((now.value - startedAt) / 1000)
}

function remainingText(task: TaskItem): string {
  const speed = currentSpeed(task)
  if (task.progressType === 'bytes' && task.total && speed !== null && speed > 0) {
    return formatDuration(Math.max(0, task.total - (task.done ?? 0)) / speed)
  }
  return '—'
}

function showTaskStats(task: ReturnType<typeof taskView>): boolean {
  return (
    isDownloadTask(task) ||
    (currentInstallationStage(task.installation)?.status === 'running' &&
      !!currentInstallationStage(task.installation)?.download) ||
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
