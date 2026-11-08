<template>
  <UiCard class="custom-download-card" :title="t('tools.download.title')" icon="download">
    <div class="custom-download-form">
      <div class="custom-download-row">
        <label for="custom-download-url">{{ t('tools.download.url') }}</label>
        <UiInput id="custom-download-url" v-model="url" placeholder="https://example.com/file.zip" :disabled="busy" />
      </div>
      <div class="custom-download-row">
        <label for="custom-download-folder">{{ t('tools.download.folder') }}</label>
        <div class="custom-download-path">
          <UiInput id="custom-download-folder" v-model="downloadDirectory" :disabled="busy" />
          <UiButton variant="secondary" icon="folder-open" :disabled="busy" @click="browse">{{
            t('common.browse')
          }}</UiButton>
        </div>
      </div>
      <p class="custom-download-hint custom-download-name-summary">
        {{
          t('tools.downloadNameSummary', {
            name:
              namingMode === 'custom' ? customName || t('tools.download.customName') : t('tools.download.originalName'),
          })
        }}
      </p>
      <div class="custom-download-advanced tool-options" :class="{ 'is-open': optionsOpen }">
        <button
          type="button"
          class="custom-download-advanced__toggle tool-options__toggle"
          :aria-expanded="optionsOpen"
          @click="optionsOpen = !optionsOpen"
        >
          <UiIcon name="chevron-right" :size="16" class="tool-options__chevron" />{{ t('tools.downloadOptions') }}
        </button>
        <CollapsiblePanel :open="optionsOpen">
          <div class="custom-download-advanced-body">
            <div class="custom-download-row">
              <span id="custom-download-naming-label" class="custom-download-label">{{
                t('tools.download.naming')
              }}</span>
              <div class="custom-download-naming">
                <NRadioGroup
                  v-model:value="namingMode"
                  role="radiogroup"
                  aria-labelledby="custom-download-naming-label"
                  name="download-naming"
                  :disabled="busy"
                  :themeOverrides="namingTheme"
                >
                  <NRadioButton value="original">{{ t('tools.download.originalName') }}</NRadioButton>
                  <NRadioButton value="custom">{{ t('tools.download.customName') }}</NRadioButton>
                </NRadioGroup>
                <div v-if="namingMode === 'custom'" class="custom-download-name">
                  <label for="custom-download-name">{{ t('tools.download.fileName') }}</label>
                  <UiInput id="custom-download-name" v-model="customName" :disabled="busy" placeholder="archive.zip" />
                  <p class="custom-download-hint">{{ t('tools.download.fileNameHint') }}</p>
                </div>
                <p v-else class="custom-download-hint">
                  {{
                    url.trim()
                      ? t('tools.download.originalHint', { name: estimatedName })
                      : t('tools.download.originalRule')
                  }}
                </p>
              </div>
            </div>
            <NCheckbox
              v-model:checked="overwrite"
              class="custom-download-overwrite"
              :themeOverrides="toolCheckboxTheme"
              :disabled="busy"
              >{{ t('tools.download.overwrite') }}</NCheckbox
            >
            <div class="custom-download-row">
              <label for="custom-download-ua">{{ t('tools.download.userAgent') }}</label>
              <UiInput id="custom-download-ua" v-model="userAgent" :placeholder="defaultUserAgent" :disabled="busy" />
            </div>
            <div class="custom-download-row">
              <span class="custom-download-label">{{ t('tools.download.headers') }}</span>
              <div class="custom-download-headers">
                <div v-for="header in headers" :key="header.id" class="custom-download-header-row">
                  <UiInput
                    v-model="header.name"
                    :placeholder="t('tools.download.headerName')"
                    :aria-label="t('tools.download.headerName')"
                    :disabled="busy"
                  />
                  <UiInput
                    v-model="header.value"
                    :placeholder="t('tools.download.headerValue')"
                    :aria-label="t('tools.download.headerValue')"
                    :disabled="busy"
                  />
                  <UiButton variant="text" :disabled="busy" @click="removeHeader(header.id)">{{
                    t('common.remove')
                  }}</UiButton>
                </div>
                <div class="custom-download-header-actions">
                  <UiButton
                    variant="secondary"
                    icon="plus"
                    :disabled="busy || headers.length >= 64"
                    @click="addHeader"
                    >{{ t('tools.download.addHeader') }}</UiButton
                  >
                </div>
                <p class="custom-download-hint">{{ t('tools.download.headersHint') }}</p>
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>
      <p v-if="error || validationError" class="custom-download-error" role="alert">{{ error || validationError }}</p>
      <div v-if="queryError" class="custom-download-error" role="alert">
        <p>{{ t('operations.queryFailed') }}</p>
        <UiButton variant="secondary" @click="refresh">{{ t('operations.refresh') }}</UiButton>
      </div>
      <div v-if="operation" class="custom-download-status" role="status">
        <UiProgress :percentage="operation.percent" :processing="isTaskRunning && (operation.percent ?? 0) <= 0" />
        <p>{{ operation.message }}</p>
        <p v-if="isCancellationRequested && busy">{{ t('operations.cancelRequested') }}</p>
        <p v-if="operation.path" class="custom-download-target">{{ operation.path }}</p>
      </div>
      <div class="custom-download-footer">
        <div class="custom-download-actions">
          <UiButton
            v-if="busy && operation"
            variant="secondary"
            size="lg"
            :disabled="cancelling || isCancellationRequested"
            @click="cancel"
            >{{ t('common.cancel') }}</UiButton
          >
          <UiButton
            v-if="operation && ['failed', 'cancelled'].includes(operation.status)"
            variant="secondary"
            size="lg"
            :disabled="starting"
            @click="retry"
            >{{ t('operations.retryOriginal') }}</UiButton
          >
          <UiButton
            size="lg"
            icon="download"
            :disabled="busy || !url.trim() || !downloadDirectory.trim() || !!validationError"
            :loading="starting"
            @click="start"
            >{{ t('tools.download.start') }}</UiButton
          >
        </div>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { NCheckbox, NRadioButton, NRadioGroup } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CollapsiblePanel, UiButton, UiCard, UiIcon, UiInput, UiProgress } from '@/components/ui'
import { customDownloadApi } from '@/features/download/api/customDownloadApi'
import { useCustomDownloadStore } from '@/features/download/stores/customDownloadStore'
import { toolCheckboxTheme } from '@/features/tools/toolCheckboxTheme'
import { getErrorMessage } from '@/utils/error'
const { t } = useI18n()
const namingTheme = {
  buttonHeightMedium: 'var(--ecl-control-height-sm, 32px)',
  fontSizeMedium: '12px',
  buttonBorderRadius: 'var(--r-sm)',
  buttonColor: 'var(--ecl-control-fill)',
  buttonColorActive: 'var(--primary-alpha)',
  buttonBorderColor: 'var(--border-strong)',
  buttonBorderColorActive: 'var(--primary)',
  buttonBorderColorHover: 'var(--control-border-hover)',
  buttonTextColor: 'var(--text-primary)',
  buttonTextColorActive: 'var(--primary)',
  buttonTextColorHover: 'var(--text-primary)',
  buttonBoxShadowFocus: 'var(--control-ring)',
}
const downloadStore = useCustomDownloadStore()
const {
  url,
  downloadDirectory,
  namingMode,
  customName,
  userAgent,
  defaultUserAgent,
  headerRows: headers,
  nextHeaderId,
  overwrite,
  operation,
  isSubmittingDownload: starting,
  isRequestingCancel: cancelling,
  isCancellationRequested,
  error,
  queryError,
  busy,
  isTaskRunning,
  validationKey,
} = storeToRefs(downloadStore)
const { start, cancel, retry, refresh } = downloadStore
const optionsOpen = ref(false)
let active = true
const estimatedName = computed(() => {
  try {
    return decodeURIComponent(new URL(url.value).pathname.split('/').pop() || 'download.bin')
  } catch {
    return 'download.bin'
  }
})

const validationError = computed(() => (validationKey.value ? t(validationKey.value) : ''))

watch(
  validationError,
  (message) => {
    // 校验失败时自动展开选项，让用户看到需要修正的字段
    if (message) optionsOpen.value = true
  },
  { immediate: true }
)

function addHeader() {
  headers.value.push({ id: nextHeaderId.value++, name: '', value: '' })
}

function removeHeader(id: number) {
  headers.value = headers.value.filter((header) => header.id !== id)
}

async function browse() {
  try {
    const result = await customDownloadApi.browse(downloadDirectory.value)
    if (active && result.path) downloadDirectory.value = result.path
  } catch (cause) {
    if (active) error.value = getErrorMessage(cause)
  }
}

onMounted(() => void downloadStore.initialize())
onBeforeUnmount(() => {
  active = false
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
/* 标签覆盖了 17px 行高，naive 依赖按钮行高的居中随之失效，
   改为按钮内 flex 居中，单行与换行两种情况都保持垂直居中。 */
.custom-download-naming :deep(.n-radio-button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
.custom-download-advanced__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 4px 6px;
  margin-left: -6px;
  border: none;
  background: transparent;
  border-radius: var(--r-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 20px;
}
.custom-download-advanced__toggle:hover {
  background: var(--control-bg-hover);
  color: var(--text-primary);
}
.custom-download-advanced__toggle:focus-visible {
  outline: none;
  box-shadow: var(--control-ring);
}
.custom-download-advanced__toggle > .icon {
  transition: transform var(--duration-fast) var(--ease-emphasized);
}
.custom-download-advanced.is-open .custom-download-advanced__toggle > .icon {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: reduce) {
  .custom-download-advanced__toggle > .icon {
    transition: none;
  }
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

<style scoped src="@/styles/components/tools/ToolOptions.css"></style>
