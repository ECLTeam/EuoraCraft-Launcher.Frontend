import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { pinia } from '@/app/stores'
import { customDownloadApi, type CustomDownloadIntent } from '@/features/download/api/customDownloadApi'
import { downloadValidationKey, type HeaderRow } from '@/features/download/customDownloadValidation'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { i18n } from '@/i18n'
import { isFinishedOperation } from '@/types/operations'
import { getErrorMessage } from '@/utils/error'

const defineCustomDownloadStore = defineStore('customDownload', () => {
  const url = ref('')
  const downloadDirectory = ref('')
  const namingMode = ref<'original' | 'custom'>('original')
  const customName = ref('')
  const userAgent = ref('')
  const defaultUserAgent = ref('EuoraCraft-Launcher')
  const headerRows = ref<HeaderRow[]>([])
  const nextHeaderId = ref(0)
  const overwrite = ref(false)
  const operationId = ref('')
  const isSubmittingDownload = ref(false)
  const error = ref('')
  const lastSubmittedDownload = ref<CustomDownloadIntent | null>(null)
  const operations = useApplicationOperationStore()
  const operation = computed(() => operations.operations[operationId.value] ?? null)
  const isRequestingCancel = computed(() => operations.cancellingOperations.includes(operationId.value))
  const isCancellationRequested = computed(() => operation.value?.cancellationRequested === true)
  const queryError = computed(() => operations.queryErrors[operationId.value] || '')
  const isTaskRunning = computed(() => operation.value?.status === 'running')
  const hasActiveDownload = computed(() => !!operation.value && !isFinishedOperation(operation.value))
  const busy = computed(() => isSubmittingDownload.value || hasActiveDownload.value)
  const validationKey = computed(() =>
    downloadValidationKey({
      namingMode: namingMode.value,
      customName: customName.value,
      userAgent: userAgent.value,
      headerRows: headerRows.value,
    })
  )
  let defaultsPromise: Promise<void> | null = null
  let generation = 0

  function initialize(): Promise<void> {
    if (defaultsPromise) return defaultsPromise
    const currentGeneration = generation
    const request = (async () => {
      try {
        const defaults = await customDownloadApi.defaults()
        if (currentGeneration !== generation) return
        if (!downloadDirectory.value) downloadDirectory.value = defaults.downloadDirectory
        defaultUserAgent.value = defaults.userAgent
      } catch (cause) {
        if (currentGeneration === generation) error.value = getErrorMessage(cause)
      } finally {
        if (currentGeneration === generation) defaultsPromise = null
      }
    })()
    defaultsPromise = request
    if (operationId.value && operation.value && !isFinishedOperation(operation.value)) void refresh()
    return request
  }

  async function submit(isRetry = false): Promise<void> {
    if (busy.value || (!isRetry && validationKey.value)) return
    if (isRetry && (!operation.value || !['failed', 'cancelled'].includes(operation.value.status))) return
    const previousOperationId = operationId.value
    const headerByName = Object.fromEntries(
      headerRows.value.filter((header) => header.name || header.value).map((header) => [header.name, header.value])
    )
    const intent: CustomDownloadIntent = {
      url: url.value.trim(),
      download_directory: downloadDirectory.value.trim(),
      naming_mode: namingMode.value,
      ...(namingMode.value === 'custom' ? { custom_name: customName.value } : {}),
      user_agent: userAgent.value,
      headers: headerByName,
      overwrite: overwrite.value,
    }
    const currentGeneration = generation
    isSubmittingDownload.value = true
    error.value = ''
    try {
      const accepted = isRetry
        ? await customDownloadApi.retry(previousOperationId)
        : await customDownloadApi.start(intent)
      if (currentGeneration !== generation) return
      if (!isRetry) lastSubmittedDownload.value = structuredClone(intent)
      operationId.value = accepted.operationId
      await operations.track(accepted, i18n.global.t('advanced.downloadTitle'))
    } catch (cause) {
      if (currentGeneration === generation) error.value = getErrorMessage(cause)
    } finally {
      if (currentGeneration === generation) isSubmittingDownload.value = false
    }
  }

  async function cancel(): Promise<void> {
    if (isRequestingCancel.value || !operationId.value || !operation.value || isFinishedOperation(operation.value))
      return
    const targetId = operationId.value
    const currentGeneration = generation
    try {
      await operations.cancel(targetId)
      if (currentGeneration !== generation || targetId !== operationId.value) return
    } catch (cause) {
      if (currentGeneration === generation && targetId === operationId.value) error.value = getErrorMessage(cause)
    }
  }

  async function refresh(): Promise<void> {
    if (operationId.value) await operations.refresh(operationId.value)
  }

  function dispose(): void {
    generation++
    defaultsPromise = null
    isSubmittingDownload.value = false
  }

  return {
    url,
    downloadDirectory,
    namingMode,
    customName,
    userAgent,
    defaultUserAgent,
    headerRows,
    nextHeaderId,
    overwrite,
    operationId,
    operation,
    isSubmittingDownload,
    isRequestingCancel,
    isCancellationRequested,
    error,
    queryError,
    isTaskRunning,
    busy,
    validationKey,
    lastSubmittedDownload,
    initialize,
    start: () => submit(),
    retry: () => submit(true),
    cancel,
    refresh,
    dispose,
  }
})

/** 下载控制状态属于应用会话，组件卸载不会解除提交互斥或丢失结果。 */
export const useCustomDownloadStore = () => defineCustomDownloadStore(pinia)
