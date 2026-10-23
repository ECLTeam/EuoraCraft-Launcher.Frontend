<template>
  <div class="setting-item" data-theme-component="setting-row">
    <div class="setting-info">
      <div class="setting-label">
        <span>{{ label }}</span>
        <NPopover
          v-if="details"
          v-model:show="isDetailsOpen"
          trigger="click"
          placement="bottom-start"
          displayDirective="if"
          :showArrow="false"
          to="#app"
        >
          <template #trigger>
            <NButton
              ref="helpButton"
              class="setting-help"
              text
              :aria-label="t('settings.viewDetails', { label })"
              :aria-expanded="isDetailsOpen"
              :aria-controls="detailsId"
            >
              <UiIcon name="help" :size="15" aria-hidden="true" />
            </NButton>
          </template>
          <div :id="detailsId" class="setting-details" role="note" :aria-label="label" tabindex="0">
            {{ details }}
          </div>
        </NPopover>
      </div>
      <div v-if="description" class="setting-desc">
        {{ description }}
      </div>
    </div>
    <div class="setting-control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopover } from 'naive-ui'
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'

defineProps<{
  label: string
  description?: string
  details?: string
}>()

const { t } = useI18n()
const detailsId = `setting-details-${useId()}`
const isDetailsOpen = ref(false)
const helpButton = ref<InstanceType<typeof NButton> | null>(null)

// 只在详情展开时拦截 Esc，避免它同时关闭设置页所在的弹窗。
watch(isDetailsOpen, (isOpen, _previous, onCleanup) => {
  if (!isOpen) return

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    isDetailsOpen.value = false
    helpButton.value?.$el.focus({ preventScroll: true })
  }
  document.addEventListener('keydown', closeOnEscape, true)
  onCleanup(() => document.removeEventListener('keydown', closeOnEscape, true))
})
</script>

<style scoped>
.setting-item {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ecl-border);
}

.setting-item:last-child {
  border-bottom: 0;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
}

.setting-help {
  flex-shrink: 0;
  color: var(--ecl-text-secondary);
}

.setting-help:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
  border-radius: var(--ecl-radius-control);
}

.setting-details {
  width: min(340px, calc(100vw - 64px));
  max-height: min(360px, calc(100vh - 96px));
  overflow: auto;
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-line;
  user-select: text;
}

.setting-details:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.setting-desc {
  color: var(--ecl-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.setting-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
}
</style>
