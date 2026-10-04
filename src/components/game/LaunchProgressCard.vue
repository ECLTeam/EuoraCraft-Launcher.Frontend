<template>
  <div class="launch-progress-card">
    <div class="lp-header">
      <div class="lp-icon-wrap" :class="{ 'has-item-image': visual.image }">
        <img v-if="visual.image" :src="visual.image" alt="" class="lp-version-icon-img" />
        <UiIcon v-else :name="visual.icon" :size="22" />
      </div>
      <div class="lp-title-area">
        <h3 class="lp-title">
          {{ title }}
        </h3>
        <p class="lp-version">
          {{ versionName }}
        </p>
      </div>
    </div>

    <div class="lp-bar-wrapper">
      <UiProgress class="lp-progress" :percentage="displayPercent" :processing="displayPercent < 0" :height="4" />
      <span class="lp-bar-percent">{{ displayPercent >= 0 ? Math.round(displayPercent) + '%' : '...' }}</span>
    </div>

    <div class="lp-info">
      <div class="lp-info-row">
        <span class="lp-info-label">当前步骤</span>
        <span class="lp-info-value">{{ stage }}</span>
      </div>
      <div v-if="message" class="lp-info-row">
        <span class="lp-info-label">详细信息</span>
        <span class="lp-info-value lp-info-detail">{{ message }}</span>
      </div>
    </div>

    <button v-if="cancelable" class="lp-cancel-btn" @click="emit('cancel')">
      <UiIcon name="close" :size="14" />
      {{ t('common.cancel') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import UiProgress from '@/components/ui/Progress.vue'

defineProps<{
  title: string
  versionName: string
  displayPercent: number
  stage: string
  message: string
  cancelable: boolean
  visual: { image: string; icon: string }
}>()

const emit = defineEmits<{
  cancel: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.launch-progress-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 32px 28px 24px;
  border: 1px solid var(--ecl-border);
  border-radius: var(--r-sm);
  background: var(--card-bg);
}

.lp-header {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.lp-icon-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-sm);
  background: var(--primary-alpha);
  color: var(--primary);
}

.lp-icon-wrap.has-item-image {
  background: transparent;
}

.lp-version-icon-img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  image-rendering: pixelated;
}

.lp-title-area {
  flex: 1;
  min-width: 0;
}

.lp-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}

.lp-version {
  margin: 2px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.lp-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.lp-progress {
  flex: 1;
  min-width: 0;
  width: auto;
}

.lp-bar-percent {
  min-width: 36px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.lp-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--ecl-surface-muted);
}

.lp-info-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.lp-info-label {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.lp-info-value {
  color: var(--text-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.lp-info-detail {
  overflow: hidden;
  max-width: 200px;
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 28px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-emphasized);
}

.lp-cancel-btn:hover {
  border-color: var(--error);
  background: rgba(232, 93, 93, 0.06);
  color: var(--error);
}
</style>
