<template>
  <div class="running-instances-page">
    <section class="running-instances-library">
      <header class="running-instances-toolbar">
        <div class="running-instances-heading">
          <UiIcon name="play" :size="16" />
          <strong>{{ t('versions.running.title') }}</strong>
        </div>
        <div class="running-instances-toolbar-actions">
          <span :class="['running-instances-count', { inactive: instances.length === 0 }]">
            <i></i>
            {{ t('versions.running.count', { count: instances.length }) }}
          </span>
          <button
            class="running-refresh"
            :title="t('versions.running.refresh')"
            :disabled="loading"
            @click="loadInstances"
          >
            <UiIcon name="refresh" :size="14" :className="loading ? 'spin' : ''" />
            {{ t('versions.running.refresh') }}
          </button>

          <button class="running-terminal" :title="t('versions.running.terminal')" @click="emit('openTerminal')">
            <UiIcon name="terminal" :size="14" />
            {{ t('versions.running.terminal') }}
          </button>
        </div>
      </header>

      <InstanceContentState
        :loading="loading"
        :empty="instances.length === 0"
        :emptyDescription="t('versions.running.empty')"
        class="running-instances-content"
      >
        <div class="running-instance-table">
          <div class="running-table-header">
            <span class="col-icon"></span>
            <span class="col-name">{{ t('versions.running.nameColumn') }}</span>
            <span class="col-process">{{ t('versions.running.processColumn') }}</span>
            <span class="col-path">{{ t('versions.running.pathLabel') }}</span>
            <span class="col-status">{{ t('versions.running.statusColumn') }}</span>
            <span class="col-actions"></span>
          </div>

          <TransitionGroup name="running-row" tag="div" class="running-table-body">
            <div v-for="instance in instances" :key="instance.id" class="running-instance-row">
              <div class="col-icon">
                <div class="running-version-icon">
                  <img :src="instanceImage(instance)" alt="" />
                </div>
              </div>
              <div class="col-name">
                <span class="running-version-name" :title="instance.name || instance.versionId">
                  {{ instance.name || instance.versionId }}
                </span>
                <span class="running-version-detail">{{ instance.versionId || instance.version || '-' }}</span>
              </div>
              <div class="col-process">
                <span class="running-process-label">{{ t('versions.running.pidLabel') }}</span>
                <span class="running-process-value">{{ instance.pid ?? '-' }}</span>
              </div>
              <div class="col-path" :title="instance.gamePath">
                {{ instance.gamePath || t('versions.running.unknownPath') }}
              </div>
              <div class="col-status">
                <span class="running-instance-status">
                  <i></i>
                  {{ t('versions.running.running') }}
                </span>
              </div>
              <div class="col-actions">
                <button
                  class="running-stop-button"
                  :title="t('versions.running.stop')"
                  :disabled="stoppingIds.size > 0"
                  @click="confirmStop(instance)"
                >
                  <UiLoading v-if="stoppingIds.has(instance.id)" mode="inline" size="sm" decorative />
                  <UiIcon v-else name="stop" :size="14" />
                  <span>{{ t('versions.running.stop') }}</span>
                </button>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <template #empty-actions>
          <div class="running-empty-actions">
            <span>{{ t('versions.running.emptyHint') }}</span>
            <NButton secondary size="small" @click="loadInstances">
              <template #icon><UiIcon name="refresh" :size="14" /></template>
              {{ t('versions.running.refresh') }}
            </NButton>
          </div>
        </template>
      </InstanceContentState>
    </section>
    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :content="confirmContent"
      :loading="confirmLoading"
      :danger="confirmDanger"
      :closeOnConfirm="false"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InstanceContentState from '@/components/instances/InstanceContentState.vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { getLoaderImage } from '@/config/version'
import { instanceRuntimeApi } from '@/features/instances/api/instanceRuntimeApi'
import type { GameInstance } from '@/types/instances'

const emit = defineEmits<{ (e: 'openTerminal'): void }>()
const { t } = useI18n()
const message = useLauncherMessage()
const instances = ref<GameInstance[]>([])
const loading = ref(false)
const stoppingIds = ref(new Set<string>())
let requestId = 0
let stopListening: (() => void) | null = null

function instanceImage(instance: GameInstance): string {
  if (instance.loader) return getLoaderImage(instance.loader) || '/img/item/grass.png'
  const name = `${instance.name} ${instance.versionId} ${instance.version ?? ''}`.toLowerCase()
  const loader = ['neoforge', 'fabric', 'quilt', 'optifine', 'forge'].find((candidate) => name.includes(candidate))
  return getLoaderImage(loader) || '/img/item/grass.png'
}

async function loadInstances(): Promise<void> {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const result = await instanceRuntimeApi.list()
    if (currentRequest === requestId) instances.value = result.filter((instance) => instance.isRunning)
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.running.loadFailed'))
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function confirmStop(instance: GameInstance): void {
  openConfirm(
    t('versions.running.stopTitle'),
    t('versions.running.stopConfirm', { name: instance.name || instance.versionId }),
    () => stopInstance(instance),
    true
  )
}

async function stopInstance(instance: GameInstance): Promise<void> {
  const next = new Set(stoppingIds.value)
  next.add(instance.id)
  stoppingIds.value = next
  try {
    await instanceRuntimeApi.stop(instance.id)
    instances.value = instances.value.filter((item) => item.id !== instance.id)
    message.success(t('versions.running.stopped', { name: instance.name || instance.versionId }))
    await loadInstances()
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.running.stopFailed'))
  } finally {
    const remaining = new Set(stoppingIds.value)
    remaining.delete(instance.id)
    stoppingIds.value = remaining
  }
}

onMounted(() => {
  stopListening = instanceRuntimeApi.onChanged(() => {
    void loadInstances()
  })
  void loadInstances()
})

onBeforeUnmount(() => {
  requestId += 1
  stopListening?.()
})

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmDanger = ref(false)
const confirmLoading = ref(false)
let confirmAction: (() => Promise<void>) | null = null

function openConfirm(title: string, content: string, action: () => Promise<void>, danger = false) {
  confirmTitle.value = title
  confirmContent.value = content
  confirmDanger.value = danger
  confirmAction = action
  confirmLoading.value = false
  confirmVisible.value = true
}

async function handleConfirm() {
  if (!confirmAction || confirmLoading.value) return
  confirmLoading.value = true
  try {
    await confirmAction()
    confirmVisible.value = false
    confirmAction = null
  } finally {
    confirmLoading.value = false
  }
}
</script>

<style scoped>
.running-instances-page {
  display: flex;
  min-width: 0;
  width: 100%;
  height: 100%;
  justify-content: center;
  padding: 26px;
  overflow: auto;
}

.running-instances-library {
  display: flex;
  flex: none;
  min-width: 0;
  width: min(1000px, 100%);
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--ecl-border);
  border-radius: var(--r-lg);
  background: var(--card-bg);
}

.running-instances-toolbar {
  display: flex;
  flex: 0 0 auto;
  height: 43px;
  align-items: center;
  justify-content: space-between;
  gap: 11px;
  padding: 0 14px;
  border-bottom: 1px solid var(--divider);
}

.running-instances-heading,
.running-instances-toolbar-actions {
  display: flex;
  align-items: center;
}

.running-instances-heading {
  min-width: 0;
  gap: 7px;
  color: var(--primary);
}

.running-instances-heading strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.running-instances-toolbar-actions {
  flex: 0 0 auto;
  gap: var(--s-xs);
}

.running-instances-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: var(--r-full);
  background: var(--success-alpha);
  color: var(--success);
  font-size: 11px;
  font-weight: 600;
}

.running-instances-count i {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  box-shadow: 0 0 7px currentcolor;
}

.running-instances-count.inactive {
  background: var(--control-bg);
  color: var(--text-tertiary);
}

.running-instances-count.inactive i {
  box-shadow: none;
}

.running-refresh {
  display: inline-flex;
  height: 29px;
  align-items: center;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  transition: all var(--duration-fast) var(--ease-emphasized);
}

.running-refresh:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.running-refresh:disabled {
  cursor: default;
  opacity: 0.55;
}

.running-terminal {
  display: inline-flex;
  height: 29px;
  align-items: center;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid var(--primary-alpha, color-mix(in srgb, var(--primary), transparent 82%));
  border-radius: var(--r-sm);
  background: var(--primary-alpha, color-mix(in srgb, var(--primary), transparent 88%));
  color: var(--primary);
  cursor: pointer;
  font-size: 11px;
  transition: all var(--duration-fast) var(--ease-emphasized);
}

.running-terminal:hover {
  background: var(--primary);
  color: var(--text-on-primary);
}

.running-instances-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.running-instance-table {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  flex-direction: column;
}

.running-table-body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  overflow: auto;
}

.running-table-header,
.running-instance-row {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 0 11px;
}

.running-table-header {
  flex: 0 0 auto;
  height: 30px;
  border-bottom: 1px solid var(--divider);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.running-instance-row {
  flex: 0 0 56px;
  border-bottom: 1px solid var(--divider);
  transition: background var(--duration-fast) var(--ease-emphasized);
}

.running-instance-row:hover {
  background: var(--bg-hover);
}

.running-instance-row:last-child {
  border-bottom: none;
}

.col-icon {
  flex: 0 0 auto;
  width: 38px;
}

.col-name {
  display: flex;
  flex: 1 1 180px;
  min-width: 0;
  flex-direction: column;
}

.col-process {
  display: flex;
  flex: 0 0 82px;
  align-items: baseline;
  gap: 4px;
}

.col-path {
  flex: 1 1 190px;
  min-width: 0;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-status {
  display: flex;
  flex: 0 0 66px;
  justify-content: center;
}

.col-actions {
  display: flex;
  flex: 0 0 64px;
  justify-content: flex-end;
}

.running-version-icon {
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
}

.running-version-icon img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.running-version-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.running-version-detail {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.running-process-label {
  color: var(--text-tertiary);
  font-size: 10px;
}

.running-process-value {
  color: var(--text-secondary);
  font-size: 11px;
}

.running-instance-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--success-alpha);
  color: var(--success);
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.running-instance-status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentcolor;
}

.running-stop-button {
  display: inline-flex;
  height: 25px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 6px;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 10px;
  transition: all var(--duration-fast) var(--ease-emphasized);
}

.running-stop-button:hover:not(:disabled) {
  background: var(--error-alpha);
  color: var(--error);
}

.running-stop-button:disabled {
  cursor: default;
  opacity: 0.5;
}

.running-empty-actions {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: var(--s-sm);
  text-align: center;
}

.running-empty-actions > span {
  max-width: 360px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .col-path {
    display: none;
  }
}

@media (max-width: 520px) {
  .running-instances-count {
    padding: 3px 6px;
  }

  .running-refresh {
    width: 29px;
    padding: 0;
    justify-content: center;
  }

  .running-refresh:not(:disabled) {
    font-size: 0;
  }

  .col-process {
    display: none;
  }
}
</style>
