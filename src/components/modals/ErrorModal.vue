<template>
  <Modal
    :visible="visible"
    :title="title || t('error.defaultTitle')"
    :icon="isGameCrash ? 'bug' : 'alert-triangle'"
    wrapperClass="error-modal-container"
    bodyClass="error-modal-body"
    width="620px"
    :showCloseBtn="false"
    :priority="100"
    @update:visible="handleVisibilityUpdate"
    @close="emit('close')"
    @opened="emit('opened')"
    @closed="emit('closed')"
  >
    <p class="error-message">
      {{ message }}
    </p>
    <p v-if="errorId" class="error-id">{{ t('error.id') }}：{{ errorId }}</p>
    <template v-if="isGameCrash && crash">
      <div class="crash-summary-grid">
        <div class="crash-summary-item">
          <span>{{ t('error.crash.instance') }}</span>
          <strong>{{ crash.versionId }}</strong>
        </div>
        <div class="crash-summary-item">
          <span>{{ t('error.crash.exitCode') }}</span>
          <strong>{{ crash.exitCode ?? t('error.crash.unknown') }}</strong>
        </div>
      </div>

      <section class="crash-reasons" :aria-label="t('error.crash.reasonsLabel')">
        <article v-for="(reason, index) in crash.reasons" :key="`${reason.code}-${index}`" class="crash-reason">
          <div class="crash-reason-header">
            <div>
              <span class="crash-reason-index">{{ t('error.crash.reasonIndex', { index: index + 1 }) }}</span>
              <h4>{{ reasonTitle(reason.code) }}</h4>
            </div>
            <span class="confidence-badge" :class="`confidence-${reason.confidence}`">
              {{ t(`error.crash.confidence.${reason.confidence}`) }}
            </span>
          </div>
          <div v-if="reason.evidence.length" class="crash-evidence">
            <span>{{ t('error.crash.evidence') }}</span>
            <code v-for="line in reason.evidence" :key="line">{{ line }}</code>
          </div>
          <div v-if="reason.mods?.length" class="crash-evidence">
            <span>{{ t('error.crash.suspectedMods') }}</span>
            <code v-for="mod in reason.mods" :key="mod">{{ mod }}</code>
          </div>
          <div class="crash-suggestions">
            <span>{{ t('error.crash.suggestions') }}</span>
            <ol>
              <li v-for="suggestion in reasonSuggestions(reason.code)" :key="suggestion">{{ suggestion }}</li>
            </ol>
          </div>
        </article>
      </section>

      <div v-if="outputVisible" class="error-detail-box crash-output-box">
        <div class="error-detail-header">
          <span class="error-detail-label">{{ outputName || t('error.crash.output') }}</span>
        </div>
        <pre class="error-detail-text crash-output">{{ outputContent }}</pre>
      </div>
    </template>
    <div v-else-if="detail" class="error-detail-box">
      <div class="error-detail-header">
        <span class="error-detail-label">{{ t('error.detail') }}</span>
      </div>
      <pre class="error-detail-text">{{ detail }}</pre>
    </div>

    <template #footer>
      <NButton @click="handleClose">
        {{ t('error.close') }}
      </NButton>
      <NButton v-if="isGameCrash && crash?.hasOutput" secondary :loading="outputLoading" @click="handleOutput">
        <UiIcon :name="outputVisible ? 'chevron-up' : 'file-text'" :size="14" />
        {{ outputVisible ? t('error.crash.hideOutput') : t('error.crash.viewOutput') }}
      </NButton>
      <NButton type="primary" :loading="exporting" @click="handleExportLogs">
        <UiIcon name="download" :size="14" />
        {{ isGameCrash ? t('error.crash.exportReport') : t('error.exportLogs') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import type { CrashAnalysisResult } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'

defineOptions({ name: 'ErrorModal' })

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  title: '',
  message: '',
  detail: '',
  errorId: '',
  kind: undefined,
  crash: undefined,
})

const emit = defineEmits<Emits>()

const { t, te, tm } = useI18n()
const launcherMessage = useLauncherMessage()

interface Props {
  visible?: boolean
  title?: string
  message?: string
  detail?: string
  errorId?: string
  kind?: 'game_crash'
  crash?: CrashAnalysisResult
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'open'): void
  (e: 'opened'): void
  (e: 'closed'): void
  (e: 'exported'): void
}

const exporting = ref(false)
const outputLoading = ref(false)
const outputVisible = ref(false)
const outputName = ref('')
const outputContent = ref('')
const isGameCrash = computed(() => props.kind === 'game_crash' && Boolean(props.crash))

function reasonLocaleKey(code: string): string {
  return `error.crash.reasons.${code.replace(/[^a-zA-Z0-9]+/g, '_')}`
}

function reasonTitle(code: string): string {
  const key = `${reasonLocaleKey(code)}.title`
  return te(key) ? t(key) : code
}

function reasonSuggestions(code: string): string[] {
  const key = `${reasonLocaleKey(code)}.suggestions`
  if (!te(key)) return [t('error.crash.genericSuggestion')]
  const value = tm(key)
  return Array.isArray(value) ? value.map((item) => String(item)) : [t('error.crash.genericSuggestion')]
}

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const handleVisibilityUpdate = (visible: boolean) => {
  emit('update:visible', visible)
}

const handleExportLogs = async () => {
  if (exporting.value) return
  exporting.value = true
  try {
    const purpose = isGameCrash.value ? 'crash-report' : 'launcher-logs'
    const selection = unwrapResponse(
      await backend.command('select_save_file', { purpose }),
      isGameCrash.value ? t('error.crash.exportFailed') : t('error.exportFailed')
    )
    if (!selection.path) return
    if (isGameCrash.value && props.crash) {
      const exported = unwrapResponse(
        await backend.command('game_crash_export', {
          report_id: props.crash.reportId,
          output_path: selection.path,
        }),
        t('error.crash.exportFailed')
      )
      launcherMessage.success(t('error.crash.exported', { path: exported.path }), { duration: 8000 })
    } else {
      unwrapResponse(await backend.command('export_logs', { output_path: selection.path }), t('error.exportFailed'))
      launcherMessage.success(t('error.exported'))
    }
    emit('exported')
  } catch (error) {
    launcherMessage.error(getErrorMessage(error, t('error.exportFailed')))
  } finally {
    exporting.value = false
  }
}

const handleOutput = async () => {
  if (outputVisible.value) {
    outputVisible.value = false
    return
  }
  if (!props.crash || outputLoading.value) return
  if (outputContent.value) {
    outputVisible.value = true
    return
  }
  outputLoading.value = true
  try {
    const result = unwrapResponse(
      await backend.command('game_crash_output', { report_id: props.crash.reportId }),
      t('error.crash.outputFailed')
    )
    outputName.value = result.name
    outputContent.value = result.content
    outputVisible.value = true
  } catch (error) {
    launcherMessage.error(getErrorMessage(error, t('error.crash.outputFailed')))
  } finally {
    outputLoading.value = false
  }
}

watch(
  () => props.crash?.reportId,
  () => {
    outputVisible.value = false
    outputName.value = ''
    outputContent.value = ''
  }
)

defineExpose({ close: handleClose })
</script>

<style src="@/styles/components/modals/ErrorModal.css"></style>
