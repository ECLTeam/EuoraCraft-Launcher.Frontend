<template>
  <div class="locator-color-detail">
    <div v-if="color" class="locator-color-row">
      <span class="locator-color-marker" aria-hidden="true" :style="{ backgroundColor: color.hex }" />
      <code class="locator-color-value">{{ color.hex }}</code>
      <NButton
        size="tiny"
        quaternary
        :loading="isCopying"
        :disabled="isCopying"
        :aria-label="t('accountLocator.copyLabel', { color: color.hex })"
        @click="copyColor"
      >
        <template #icon><UiIcon name="copy" :size="14" /></template>
        {{ t('accountLocator.copy') }}
      </NButton>
    </div>
    <span v-else class="locator-color-unavailable">{{ t('accountLocator.unavailable') }}</span>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { getLocatorColor } from '@/features/accounts/locatorColor'

const props = defineProps<{ uuid?: string }>()
const { t } = useI18n()
const { copy, copied } = useClipboard()
const message = useLauncherMessage()
const isCopying = ref(false)
const color = computed(() => getLocatorColor(props.uuid))

async function copyColor() {
  const hex = color.value?.hex
  if (!hex || isCopying.value) return
  isCopying.value = true
  try {
    await copy(hex)
    if (copied.value) message.success(t('accountLocator.copied'))
    else message.warning(t('accountLocator.copyFailed'))
  } catch {
    message.warning(t('accountLocator.copyFailed'))
  } finally {
    isCopying.value = false
  }
}
</script>

<style scoped>
.locator-color-marker {
  display: inline-block;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border: 1px solid var(--ecl-border);
  border-radius: 3px;
  box-shadow: 0 0 0 1px var(--ecl-surface);
}

.locator-color-detail {
  min-width: 0;
}

.locator-color-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.locator-color-value {
  color: var(--ecl-text);
  font-size: 12px;
  user-select: text;
}

.locator-color-unavailable {
  color: var(--ecl-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}
</style>
