<template>
  <div class="info-card">
    <div class="info-card__header">{{ t('versions.detail.versionInfo') }}</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">{{ t('versions.detail.versionId') }}</span>
        <span class="info-value">{{ version?.versionId || '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ t('versions.detail.loader') }}</span>
        <span class="info-value">{{
          version?.installedComponents?.length
            ? version.installedComponents.map((component) => `${component.name} ${component.version}`).join(' · ')
            : getLoaderName(version?.primaryLoader || 'vanilla')
        }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ t('versions.detail.vanillaVersion') }}</span>
        <span class="info-value">{{ version?.vanillaName || '-' }}</span>
      </div>
    </div>
  </div>

  <div class="info-card">
    <div class="info-card__header">{{ t('versions.detail.runStats') }}</div>
    <div v-if="statsLoading" class="settings-loading-state">
      <UiLoading mode="inline" size="sm" decorative />
      <span>{{ t('versions.detail.loadingStats') }}</span>
    </div>
    <div v-else class="info-grid">
      <div class="info-item">
        <span class="info-label">{{ t('versions.detail.launchCount') }}</span>
        <span class="info-value">{{ t('versions.detail.launchCountValue', { count: runStats.launchCount }) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ t('versions.detail.lastRunDuration') }}</span>
        <span class="info-value">{{ formatRunDuration(runStats.lastRunDurationSeconds) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{{ t('versions.detail.totalRunDuration') }}</span>
        <span class="info-value">{{ formatRunDuration(runStats.totalRunDurationSeconds) }}</span>
      </div>
    </div>
  </div>

  <div class="actions-card">
    <div class="actions-card__header">{{ t('versions.detail.quickActions') }}</div>
    <div class="overview-actions">
      <NButton type="primary" secondary @click="emit('launch')">
        <template #icon><UiIcon name="play" :size="15" /></template>
        {{ t('versions.detail.launch') }}
      </NButton>
      <NButton secondary @click="emit('openFolder')">
        <template #icon><UiIcon name="folder" :size="15" /></template>
        {{ t('versions.detail.openFolder') }}
      </NButton>
      <NButton secondary :loading="crashAnalyzing" @click="emit('analyzeCrash')">
        <template #icon><UiIcon name="alert-triangle" :size="15" /></template>
        {{ t('versions.detail.analyzeCrash') }}
      </NButton>
      <NButton secondary @click="emit('action', 'repair')">
        <template #icon><UiIcon name="check" :size="15" /></template>
        校验文件
      </NButton>
      <NButton secondary @click="emit('action', 'clone')">
        <template #icon><UiIcon name="copy" :size="15" /></template>
        复制实例
      </NButton>
      <NButton secondary @click="emit('action', 'export')">
        <template #icon><UiIcon name="archive" :size="15" /></template>
        导出实例
      </NButton>
      <NButton type="error" secondary @click="emit('delete')">
        <template #icon><UiIcon name="trash" :size="15" /></template>
        {{ t('versions.detail.delete') }}
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { getLoaderName } from '@/config/version'
import { formatRunDuration } from '@/features/instances/model/versionStats'
import type { ScannedVersion, VersionRunStats } from '@/types/instances'

defineOptions({ name: 'InstanceDetailOverviewTab' })

defineProps<{
  version: ScannedVersion | null
  runStats: VersionRunStats
  statsLoading: boolean
  crashAnalyzing: boolean
}>()

const emit = defineEmits<{
  launch: []
  openFolder: []
  analyzeCrash: []
  action: [action: string]
  delete: []
}>()

const { t } = useI18n()
</script>

<style scoped src="@/styles/views/instances/InstanceDetailModal.css"></style>
