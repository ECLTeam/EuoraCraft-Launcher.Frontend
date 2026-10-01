<template>
  <UiCard>
    <template #header
      ><strong>{{ t('advanced.downloadTitle') }}</strong></template
    >
    <div class="custom-download-form">
      <label
        >{{ t('advanced.downloadUrl')
        }}<NInput v-model:value="url" placeholder="https://example.com/file.zip" :disabled="busy"
      /></label>
      <label
        >{{ t('advanced.downloadPath') }}
        <div class="custom-download-path">
          <NInput v-model:value="targetPath" :disabled="busy" /><UiButton
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="browse"
            >{{ t('common.browse') }}</UiButton
          >
        </div></label
      >
      <label class="custom-download-overwrite"
        ><NCheckbox v-model:checked="overwrite" :disabled="busy" />{{ t('advanced.downloadOverwrite') }}</label
      >
      <p v-if="error" class="custom-download-error" role="alert">{{ error }}</p>
      <div v-if="operation" role="status">
        <UiProgress :percentage="operation.percent" />
        <p>{{ operation.message }}</p>
      </div>
      <div class="custom-download-actions">
        <UiButton :disabled="busy || !url.trim() || !targetPath.trim()" :loading="starting" @click="start">{{
          t('advanced.downloadStart')
        }}</UiButton>
        <UiButton v-if="busy && operation" variant="outline" :disabled="cancelling" @click="cancel">{{
          t('common.cancel')
        }}</UiButton>
        <UiButton
          v-if="operation && ['failed', 'cancelled'].includes(operation.status)"
          variant="outline"
          :disabled="starting"
          @click="retry"
          >{{ t('common.retry') }}</UiButton
        >
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { NCheckbox, NInput } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiProgress from '@/components/ui/Progress.vue'
import { useCustomDownloadStore } from '@/features/download/stores/customDownloadStore'
import { getErrorMessage } from '@/utils/error'
const { t } = useI18n()
const { url, targetPath, overwrite, operationId, operation } = storeToRefs(useCustomDownloadStore())
const starting = ref(false)
const cancelling = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let active = true
const busy = computed(
  () => starting.value || (!!operation.value && ['pending', 'running'].includes(operation.value.status))
)

async function browse() {
  try {
    let name = 'download.bin'
    try {
      name = decodeURIComponent(new URL(url.value).pathname.split('/').pop() || name)
    } catch {
      /* 输入尚未完整时使用默认文件名 */
    }
    name = Array.from(name.replace(/[<>:"/\\|?*]/g, '_'))
      .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
      .join('')
    const result = unwrapResponse(
      await backend.command('select_save_file', { purpose: 'custom-download', default_name: name }),
      t('advanced.downloadPath')
    )
    if (result.path) targetPath.value = result.path
  } catch (cause) {
    error.value = getErrorMessage(cause)
  }
}

async function track(id: string) {
  operationId.value = id
  if (timer) clearTimeout(timer)
  await poll()
}

async function poll() {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  if (!active || !operationId.value) return
  try {
    const current = unwrapResponse(
      await backend.command('game_operation_get', { operation_id: operationId.value }),
      t('advanced.downloadTitle')
    )
    if (!active) return
    operation.value = current
    if (['pending', 'running'].includes(current.status)) timer = setTimeout(() => void poll(), 700)
  } catch (cause) {
    if (active) error.value = getErrorMessage(cause)
  }
}

async function start() {
  starting.value = true
  error.value = ''
  try {
    const result = unwrapResponse(
      await backend.command('custom_download_start', {
        url: url.value.trim(),
        target_path: targetPath.value.trim(),
        overwrite: overwrite.value,
      }),
      t('advanced.downloadTitle')
    )
    await track(result.operationId)
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    starting.value = false
  }
}

async function cancel() {
  cancelling.value = true
  try {
    unwrapResponse(
      await backend.command('game_operation_cancel', { operation_id: operationId.value }),
      t('common.cancel')
    )
    await poll()
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    cancelling.value = false
  }
}

async function retry() {
  starting.value = true
  error.value = ''
  try {
    const result = unwrapResponse(
      await backend.command('custom_download_retry', { operation_id: operationId.value }),
      t('common.retry')
    )
    await track(result.operationId)
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    starting.value = false
  }
}

onMounted(() => {
  if (operationId.value) void poll()
})

onBeforeUnmount(() => {
  active = false
  if (timer) clearTimeout(timer)
})
</script>

<style scoped>
.custom-download-form {
  display: grid;
  gap: 12px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.custom-download-path,
.custom-download-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.custom-download-overwrite {
  display: flex;
  align-items: center;
}
p {
  font-size: 12px;
  color: var(--ecl-text-secondary);
}
.custom-download-error {
  color: var(--error);
}
</style>
