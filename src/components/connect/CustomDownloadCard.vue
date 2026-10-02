<template>
  <UiCard class="custom-download-card">
    <template #header
      ><strong>{{ t('advanced.downloadTitle') }}</strong></template
    >
    <div class="custom-download-form">
      <label
        >{{ t('advanced.downloadUrl')
        }}<NInput v-model:value="url" placeholder="https://example.com/file.zip" :disabled="busy"
      /></label>
      <label
        >{{ t('advanced.downloadFolder') }}
        <div class="custom-download-path">
          <NInput v-model:value="downloadDirectory" :disabled="busy" /><UiButton
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="browse"
            >{{ t('common.browse') }}</UiButton
          >
        </div></label
      >
      <div class="custom-download-naming">
        <span class="custom-download-label">{{ t('advanced.downloadNaming') }}</span>
        <NRadioGroup v-model:value="namingMode" :disabled="busy" :name="'download-naming'">
          <NRadio value="original">{{ t('advanced.downloadOriginalName') }}</NRadio>
          <NRadio value="custom">{{ t('advanced.downloadCustomName') }}</NRadio>
        </NRadioGroup>
        <label v-if="namingMode === 'custom'">
          {{ t('advanced.downloadFileName') }}
          <NInput v-model:value="customName" :disabled="busy" placeholder="archive.zip" />
          <span class="custom-download-hint">{{ t('advanced.downloadFileNameHint') }}</span>
        </label>
        <p v-else class="custom-download-hint">{{ t('advanced.downloadOriginalHint', { name: estimatedName }) }}</p>
      </div>
      <details class="custom-download-advanced">
        <summary>{{ t('advanced.downloadAdvanced') }}</summary>
        <div class="custom-download-advanced-body">
          <label>
            {{ t('advanced.downloadUserAgent') }}
            <NInput v-model:value="userAgent" :placeholder="defaultUserAgent" :disabled="busy" />
          </label>
          <div class="custom-download-header-title">
            <span class="custom-download-label">{{ t('advanced.downloadHeaders') }}</span>
            <UiButton size="sm" variant="outline" :disabled="busy || headers.length >= 64" @click="addHeader">
              {{ t('advanced.downloadAddHeader') }}
            </UiButton>
          </div>
          <div v-for="header in headers" :key="header.id" class="custom-download-header-row">
            <NInput
              v-model:value="header.name"
              :placeholder="t('advanced.downloadHeaderName')"
              :inputProps="{ 'aria-label': t('advanced.downloadHeaderName') }"
              :disabled="busy"
            />
            <NInput
              v-model:value="header.value"
              :placeholder="t('advanced.downloadHeaderValue')"
              :inputProps="{ 'aria-label': t('advanced.downloadHeaderValue') }"
              :disabled="busy"
            />
            <UiButton size="sm" variant="outline" :disabled="busy" @click="removeHeader(header.id)">{{
              t('common.remove')
            }}</UiButton>
          </div>
          <p class="custom-download-hint">{{ t('advanced.downloadHeadersHint') }}</p>
        </div>
      </details>
      <label class="custom-download-overwrite"
        ><NCheckbox v-model:checked="overwrite" :disabled="busy" />{{ t('advanced.downloadOverwrite') }}</label
      >
      <p v-if="error || validationError" class="custom-download-error" role="alert">{{ error || validationError }}</p>
      <div v-if="operation" role="status">
        <UiProgress :percentage="operation.percent" />
        <p>{{ operation.message }}</p>
        <p v-if="operation.path" class="custom-download-target">{{ operation.path }}</p>
      </div>
      <div class="custom-download-actions">
        <UiButton
          :disabled="busy || !url.trim() || !downloadDirectory.trim() || !!validationError"
          :loading="starting"
          @click="start"
          >{{ t('advanced.downloadStart') }}</UiButton
        >
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
import { NCheckbox, NInput, NRadio, NRadioGroup } from 'naive-ui'
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
const {
  url,
  downloadDirectory,
  namingMode,
  customName,
  userAgent,
  defaultUserAgent,
  headers,
  nextHeaderId,
  overwrite,
  operationId,
  operation,
} = storeToRefs(useCustomDownloadStore())
const starting = ref(false)
const cancelling = ref(false)
const error = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let active = true
const busy = computed(
  () => starting.value || (!!operation.value && ['pending', 'running'].includes(operation.value.status))
)

const estimatedName = computed(() => {
  try {
    return decodeURIComponent(new URL(url.value).pathname.split('/').pop() || 'download.bin')
  } catch {
    return 'download.bin'
  }
})

const validationError = computed(() => {
  const name = customName.value
  if (
    namingMode.value === 'custom' &&
    (!name ||
      /[<>:"/\\|?*]/u.test(name) ||
      Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      /[ .]$/.test(name) ||
      /^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(name) ||
      new TextEncoder().encode(name).length > 255)
  ) {
    return t('advanced.downloadInvalidName')
  }
  if (userAgent.value.length > 4096 || hasInvalidHeaderCharacters(userAgent.value))
    return t('advanced.downloadInvalidHeaders')
  const seen = new Set<string>()
  let size = 0
  for (const header of headers.value) {
    if (!header.name && !header.value) continue
    const key = header.name.toLowerCase()
    if (key === 'user-agent') return t('advanced.downloadUaHeader')
    if (seen.has(key) || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.name) || hasInvalidHeaderCharacters(header.value))
      return t('advanced.downloadInvalidHeaders')
    seen.add(key)
    size += header.name.length + header.value.length
  }
  return seen.size > 64 || size > 32768 ? t('advanced.downloadInvalidHeaders') : ''
})

function hasInvalidHeaderCharacters(value: string) {
  return Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126)
}

function addHeader() {
  headers.value.push({ id: nextHeaderId.value++, name: '', value: '' })
}

function removeHeader(id: number) {
  headers.value = headers.value.filter((header) => header.id !== id)
}

async function loadDefaults() {
  try {
    const defaults = unwrapResponse(await backend.command('custom_download_defaults'), t('advanced.downloadTitle'))
    if (!active) return
    if (!downloadDirectory.value) downloadDirectory.value = defaults.downloadDirectory
    defaultUserAgent.value = defaults.userAgent
  } catch (cause) {
    if (active) error.value = getErrorMessage(cause)
  }
}

async function browse() {
  try {
    const result = unwrapResponse(
      await backend.command('select_directory', {
        purpose: 'custom-download',
        default_directory: downloadDirectory.value || undefined,
      }),
      t('advanced.downloadFolder')
    )
    if (active && result.path) downloadDirectory.value = result.path
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
  if (busy.value || validationError.value) return
  starting.value = true
  error.value = ''
  try {
    const result = unwrapResponse(
      await backend.command('custom_download_start', {
        url: url.value.trim(),
        download_directory: downloadDirectory.value.trim(),
        naming_mode: namingMode.value,
        ...(namingMode.value === 'custom' ? { custom_name: customName.value } : {}),
        user_agent: userAgent.value,
        headers: Object.fromEntries(
          headers.value.filter((header) => header.name || header.value).map((header) => [header.name, header.value])
        ),
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
  void loadDefaults()
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
.custom-download-card,
.custom-download-form > *,
.custom-download-path > .n-input {
  min-width: 0;
}
.custom-download-path > .n-input {
  flex: 1;
}
.custom-download-path > .ui-btn {
  flex-shrink: 0;
}
.custom-download-form > label,
.custom-download-naming > label,
.custom-download-advanced-body > label {
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
.custom-download-form > .custom-download-overwrite {
  display: flex;
  align-items: center;
}
p {
  margin: 0;
  font-size: 12px;
  color: var(--ecl-text-secondary);
}
.custom-download-error {
  color: var(--error);
}
.custom-download-naming,
.custom-download-advanced-body {
  display: grid;
  gap: 10px;
}
.custom-download-label {
  font-size: 12px;
}
.custom-download-naming :deep(.n-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}
.custom-download-hint {
  color: var(--ecl-text-secondary);
  font-size: 11px;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.custom-download-advanced {
  border-top: 1px solid var(--ecl-border);
  padding-top: 12px;
}
.custom-download-advanced summary {
  cursor: pointer;
  font-size: 12px;
}
.custom-download-advanced-body {
  padding-top: 12px;
}
.custom-download-header-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.custom-download-header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  gap: 8px;
}
.custom-download-actions {
  flex-wrap: wrap;
}
.custom-download-target {
  margin-top: 6px;
  overflow-wrap: anywhere;
}
@container (max-width: 400px) {
  .custom-download-header-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .custom-download-header-row > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
