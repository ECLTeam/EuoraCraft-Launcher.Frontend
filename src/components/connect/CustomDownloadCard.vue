<template>
  <UiCard class="custom-download-card" :title="t('advanced.downloadTitle')" icon="download">
    <div class="custom-download-form">
      <div class="custom-download-row">
        <label for="custom-download-url">{{ t('advanced.downloadUrl') }}</label>
        <UiInput id="custom-download-url" v-model="url" placeholder="https://example.com/file.zip" :disabled="busy" />
      </div>
      <div class="custom-download-row">
        <label for="custom-download-folder">{{ t('advanced.downloadFolder') }}</label>
        <div class="custom-download-path">
          <UiInput id="custom-download-folder" v-model="downloadDirectory" :disabled="busy" />
          <UiButton variant="secondary" icon="folder-open" :disabled="busy" @click="browse">{{
            t('common.browse')
          }}</UiButton>
        </div>
      </div>
      <div class="custom-download-row">
        <span id="custom-download-naming-label" class="custom-download-label">{{ t('advanced.downloadNaming') }}</span>
        <div class="custom-download-naming">
          <NRadioGroup
            v-model:value="namingMode"
            role="radiogroup"
            aria-labelledby="custom-download-naming-label"
            name="download-naming"
            :disabled="busy"
            :themeOverrides="namingTheme"
          >
            <NRadioButton value="original">{{ t('advanced.downloadOriginalName') }}</NRadioButton>
            <NRadioButton value="custom">{{ t('advanced.downloadCustomName') }}</NRadioButton>
          </NRadioGroup>
          <div v-if="namingMode === 'custom'" class="custom-download-name">
            <label for="custom-download-name">{{ t('advanced.downloadFileName') }}</label>
            <UiInput id="custom-download-name" v-model="customName" :disabled="busy" placeholder="archive.zip" />
            <p class="custom-download-hint">{{ t('advanced.downloadFileNameHint') }}</p>
          </div>
          <p v-else class="custom-download-hint">
            {{
              url.trim()
                ? t('advanced.downloadOriginalHint', { name: estimatedName })
                : t('advanced.downloadOriginalRule')
            }}
          </p>
        </div>
      </div>
      <NCheckbox
        v-model:checked="overwrite"
        class="custom-download-overwrite"
        :themeOverrides="overwriteTheme"
        :disabled="busy"
        >{{ t('advanced.downloadOverwrite') }}</NCheckbox
      >
      <details class="custom-download-advanced">
        <summary><UiIcon name="chevron-right" :size="16" />{{ t('advanced.downloadAdvanced') }}</summary>
        <div class="custom-download-advanced-body">
          <div class="custom-download-row">
            <label for="custom-download-ua">{{ t('advanced.downloadUserAgent') }}</label>
            <UiInput id="custom-download-ua" v-model="userAgent" :placeholder="defaultUserAgent" :disabled="busy" />
          </div>
          <div class="custom-download-row">
            <span class="custom-download-label">{{ t('advanced.downloadHeaders') }}</span>
            <div class="custom-download-headers">
              <div v-for="header in headers" :key="header.id" class="custom-download-header-row">
                <UiInput
                  v-model="header.name"
                  :placeholder="t('advanced.downloadHeaderName')"
                  :aria-label="t('advanced.downloadHeaderName')"
                  :disabled="busy"
                />
                <UiInput
                  v-model="header.value"
                  :placeholder="t('advanced.downloadHeaderValue')"
                  :aria-label="t('advanced.downloadHeaderValue')"
                  :disabled="busy"
                />
                <UiButton variant="text" :disabled="busy" @click="removeHeader(header.id)">{{
                  t('common.remove')
                }}</UiButton>
              </div>
              <div class="custom-download-header-actions">
                <UiButton variant="secondary" icon="plus" :disabled="busy || headers.length >= 64" @click="addHeader">{{
                  t('advanced.downloadAddHeader')
                }}</UiButton>
              </div>
              <p class="custom-download-hint">{{ t('advanced.downloadHeadersHint') }}</p>
            </div>
          </div>
        </div>
      </details>
      <p v-if="error || validationError" class="custom-download-error" role="alert">{{ error || validationError }}</p>
      <div v-if="operation" class="custom-download-status" role="status">
        <UiProgress :percentage="operation.percent" />
        <p>{{ operation.message }}</p>
        <p v-if="operation.path" class="custom-download-target">{{ operation.path }}</p>
      </div>
      <div class="custom-download-footer">
        <div class="custom-download-actions">
          <UiButton v-if="busy && operation" variant="secondary" size="lg" :disabled="cancelling" @click="cancel">{{
            t('common.cancel')
          }}</UiButton>
          <UiButton
            v-if="operation && ['failed', 'cancelled'].includes(operation.status)"
            variant="secondary"
            size="lg"
            :disabled="starting"
            @click="retry"
            >{{ t('common.retry') }}</UiButton
          >
          <UiButton
            size="lg"
            icon="download"
            :disabled="busy || !url.trim() || !downloadDirectory.trim() || !!validationError"
            :loading="starting"
            @click="start"
            >{{ t('advanced.downloadStart') }}</UiButton
          >
        </div>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { NCheckbox, NRadioButton, NRadioGroup } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiInput from '@/components/ui/Input.vue'
import UiProgress from '@/components/ui/Progress.vue'
import { useCustomDownloadStore } from '@/features/download/stores/customDownloadStore'
import { getErrorMessage } from '@/utils/error'
const { t } = useI18n()
const namingTheme = {
  buttonHeightMedium: '29px',
  fontSizeMedium: '12px',
  buttonBorderRadius: 'var(--r-sm)',
  buttonColor: 'var(--control-bg)',
  buttonColorActive: 'var(--primary-alpha)',
  buttonBorderColor: 'var(--control-border)',
  buttonBorderColorActive: 'var(--primary)',
  buttonBorderColorHover: 'var(--control-border-hover)',
  buttonTextColor: 'var(--text-primary)',
  buttonTextColorActive: 'var(--primary)',
  buttonTextColorHover: 'var(--text-primary)',
  buttonBoxShadowFocus: 'var(--control-ring)',
}
const overwriteTheme = {
  fontSizeMedium: '12px',
  textColor: 'var(--text-secondary)',
  color: 'var(--control-bg)',
  colorChecked: 'var(--primary)',
  border: '1px solid var(--control-border)',
  borderChecked: '1px solid var(--primary)',
  checkMarkColor: 'var(--text-on-primary)',
  boxShadowFocus: 'var(--control-ring)',
}
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
.custom-download-card,
.custom-download-row > *,
.custom-download-path > *,
.custom-download-header-row > * {
  min-width: 0;
}
.custom-download-card {
  container-type: inline-size;
}
.custom-download-card :deep(.card-body) {
  padding: 12px;
}
.custom-download-form,
.custom-download-advanced-body {
  display: grid;
  gap: 12px;
}
.custom-download-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 6px;
}
.custom-download-row > label,
.custom-download-label {
  color: var(--text-primary);
  font-size: 13px;
  line-height: 17px;
  overflow-wrap: anywhere;
}
.custom-download-path,
.custom-download-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.custom-download-path > .ui-input-wrapper {
  flex: 1;
}
.custom-download-path > .ui-btn {
  flex-shrink: 0;
}
.custom-download-naming,
.custom-download-name,
.custom-download-headers,
.custom-download-status {
  display: grid;
  gap: 8px;
}
.custom-download-name > label {
  margin-top: 4px;
  color: var(--text-primary);
  font-size: 12px;
}
.custom-download-naming :deep(.n-radio-group) {
  justify-self: start;
  max-width: 100%;
}
.custom-download-naming :deep(.n-radio-button .n-radio__label) {
  white-space: normal;
  line-height: 17px;
}
p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.custom-download-hint {
  color: var(--text-tertiary);
  font-size: 11px;
}
.custom-download-error {
  color: var(--error);
}
.custom-download-advanced {
  min-width: 0;
}
.custom-download-advanced summary {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 4px 6px;
  margin-left: -6px;
  border-radius: var(--r-sm);
  color: var(--text-secondary);
  cursor: pointer;
  list-style: none;
  font-size: 12px;
  line-height: 20px;
}
.custom-download-advanced summary::-webkit-details-marker {
  display: none;
}
.custom-download-advanced summary:hover {
  background: var(--control-bg-hover);
  color: var(--text-primary);
}
.custom-download-advanced summary:focus-visible {
  outline: none;
  box-shadow: var(--control-ring);
}
.custom-download-advanced summary > .icon {
  transition: transform var(--duration-fast) var(--ease-emphasized);
}
.custom-download-advanced[open] summary > .icon {
  transform: rotate(90deg);
}
.custom-download-advanced-body {
  padding-top: 16px;
}
.custom-download-header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  align-items: center;
  gap: 8px;
}
.custom-download-header-actions {
  display: flex;
}
.custom-download-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px 16px;
}
.custom-download-overwrite {
  justify-self: start;
  max-width: 100%;
}
.custom-download-overwrite :deep(.n-checkbox__label) {
  white-space: normal;
  line-height: 1.6;
}
.custom-download-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}
@container (max-width: 519px) {
  .custom-download-header-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .custom-download-header-row > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
