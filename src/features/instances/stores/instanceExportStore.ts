import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { instanceExportApi, parseExportPreview, parseExportResult } from '@/features/instances/api/instanceExportApi'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { i18n } from '@/i18n'
import type { ExportCategory, ExportResourceMode, InstanceExportPreview } from '@/types/instanceExport'
import type { InstanceTargetPayload } from '@/types/instances'
import { isFinishedOperation } from '@/types/operations'
import { getErrorMessage } from '@/utils/error'
import { gamePathIdentity } from '@/utils/path'

function targetKey(target: InstanceTargetPayload): string {
  return `${gamePathIdentity(target.game_path)}\0${target.version_id}`
}

export const useInstanceExportStore = defineStore('instanceExport', () => {
  const visible = ref(false)
  const target = shallowRef<InstanceTargetPayload | null>(null)
  const displayName = ref('')
  const preview = shallowRef<InstanceExportPreview | null>(null)
  const scanOperationId = ref('')
  const exportOperationId = ref('')
  const selectedFileIds = ref<string[]>([])
  const packName = ref('')
  const packVersion = ref('1.0.0')
  const summary = ref('')
  const resourceMode = ref<ExportResourceMode>('references')
  const search = ref('')
  const error = ref('')
  const isSubmitting = ref(false)
  const isPreparing = ref(false)
  const operations = useApplicationOperationStore()
  const lastExportByTarget = new Map<string, string>()
  let generation = 0
  let acceptedScanId = ''

  const scanOperation = computed(() => operations.operations[scanOperationId.value])
  const exportOperation = computed(() => operations.operations[exportOperationId.value])
  const selectedIds = computed(() => new Set(selectedFileIds.value))
  const selectedFiles = computed(() => preview.value?.files.filter((file) => selectedIds.value.has(file.fileId)) ?? [])
  const selectedBytes = computed(() => selectedFiles.value.reduce((size, file) => size + file.size, 0))
  const hasPersonalFiles = computed(() =>
    selectedFiles.value.some((file) => ['saves', 'screenshots', 'servers'].includes(file.category))
  )
  const isExporting = computed(() => !!exportOperation.value && !isFinishedOperation(exportOperation.value))
  const result = computed(() => parseExportResult(exportOperation.value?.result))
  const canExport = computed(
    () =>
      !!preview.value &&
      !!packName.value.trim() &&
      packName.value.trim().length <= 100 &&
      !!packVersion.value.trim() &&
      packVersion.value.trim().length <= 100 &&
      summary.value.length <= 2000 &&
      !isSubmitting.value &&
      !isPreparing.value &&
      !exportOperationId.value
  )

  async function cancelScan(id: string): Promise<void> {
    if (!id) return
    const requestGeneration = generation
    try {
      await operations.cancel(id)
    } catch (reason) {
      if (requestGeneration === generation && scanOperationId.value === id && visible.value)
        error.value = getErrorMessage(reason, i18n.global.t('instanceExport.cancelFailed'))
      else console.warn('[InstanceExport] 请求取消旧扫描失败:', reason)
    }
  }

  function hide(): void {
    generation++
    visible.value = false
    const previous = scanOperationId.value
    scanOperationId.value = ''
    isPreparing.value = false
    void cancelScan(previous)
  }

  function close(): void {
    if (isSubmitting.value) return
    hide()
  }

  // 页面卸载必须使原生保存对话框的迟到响应失效，但已提交的任务由应用继续跟踪。
  function detach(): void {
    hide()
  }

  async function scan(): Promise<void> {
    if (!target.value || isSubmitting.value || isPreparing.value || isExporting.value) return
    generation++
    const requestGeneration = generation
    const source = { ...target.value }
    const previous = scanOperationId.value
    scanOperationId.value = ''
    exportOperationId.value = ''
    lastExportByTarget.delete(targetKey(source))
    acceptedScanId = ''
    preview.value = null
    selectedFileIds.value = []
    error.value = ''
    search.value = ''
    isPreparing.value = true
    void cancelScan(previous)
    try {
      const operation = await instanceExportApi.preview(source)
      void operations.track({ operationId: operation.operationId, kind: 'instance_export_preview', status: 'pending' })
      if (requestGeneration !== generation || !visible.value) {
        void cancelScan(operation.operationId)
        return
      }
      scanOperationId.value = operation.operationId
    } catch (reason) {
      if (requestGeneration === generation) {
        isPreparing.value = false
        error.value = getErrorMessage(reason, i18n.global.t('instanceExport.scanFailed'))
      }
    }
  }

  async function open(source: InstanceTargetPayload, name: string): Promise<void> {
    if (isSubmitting.value) return
    const previous = scanOperationId.value
    generation++
    scanOperationId.value = ''
    isPreparing.value = false
    void cancelScan(previous)
    target.value = { ...source }
    displayName.value = name
    packName.value = name
    packVersion.value = '1.0.0'
    summary.value = ''
    resourceMode.value = 'references'
    error.value = ''
    preview.value = null
    selectedFileIds.value = []
    search.value = ''
    visible.value = true
    exportOperationId.value = lastExportByTarget.get(targetKey(source)) ?? ''
    if (!exportOperationId.value) await scan()
  }

  watch(scanOperation, (operation) => {
    if (
      !visible.value ||
      !operation ||
      operation.operationId !== scanOperationId.value ||
      acceptedScanId === operation.operationId
    )
      return
    if (!isFinishedOperation(operation)) return
    acceptedScanId = operation.operationId
    isPreparing.value = false
    if (operation.status !== 'completed') {
      error.value =
        operation.error ||
        i18n.global.t(operation.status === 'cancelled' ? 'instanceExport.cancelled' : 'instanceExport.scanFailed')
      return
    }
    try {
      const next = parseExportPreview(operation.result)
      if (next.versionId !== target.value?.version_id) throw new Error(i18n.global.t('instanceExport.invalidResponse'))
      preview.value = next
      selectedFileIds.value = next.files.filter((file) => file.recommended).map((file) => file.fileId)
    } catch (reason) {
      error.value = getErrorMessage(reason, i18n.global.t('instanceExport.invalidResponse'))
    }
  })

  function setSelection(keys: Array<string | number>): void {
    if (isSubmitting.value || exportOperationId.value) return
    const allowed = new Set(preview.value?.files.map((file) => file.fileId))
    selectedFileIds.value = [
      ...new Set(keys.filter((key): key is string => typeof key === 'string' && allowed.has(key))),
    ]
  }

  function selectAll(mode: 'all' | 'none' | 'recommended'): void {
    const files = preview.value?.files ?? []
    setSelection(
      mode === 'none' ? [] : files.filter((file) => mode === 'all' || file.recommended).map((file) => file.fileId)
    )
  }

  function selectCategory(category: ExportCategory, selected: boolean): void {
    const ids = new Set(selectedFileIds.value)
    for (const file of preview.value?.files ?? []) {
      if (file.category !== category) continue
      if (selected) ids.add(file.fileId)
      else ids.delete(file.fileId)
    }
    setSelection([...ids])
  }

  async function submit(): Promise<void> {
    if (!canExport.value || !target.value || !preview.value) return
    isSubmitting.value = true
    error.value = ''
    const requestGeneration = generation
    const source = { ...target.value }
    const snapshot = preview.value
    try {
      const output = await instanceExportApi.chooseOutput(packName.value.trim(), packVersion.value.trim())
      if (!output || requestGeneration !== generation || !visible.value) return
      const operation = await instanceExportApi.export({
        ...source,
        output_path: output,
        pack_format: 'modrinth',
        source_revision: snapshot.sourceRevision,
        selected_file_ids: [...selectedFileIds.value],
        pack_name: packName.value.trim(),
        pack_version: packVersion.value.trim(),
        summary: summary.value.trim(),
        resource_mode: resourceMode.value,
      })
      lastExportByTarget.set(targetKey(source), operation.operationId)
      operations.targets[operation.operationId] = source
      void operations.track({ operationId: operation.operationId, kind: 'instance_export', status: 'pending' })
      if (requestGeneration === generation) exportOperationId.value = operation.operationId
    } catch (reason) {
      if (requestGeneration === generation)
        error.value = getErrorMessage(reason, i18n.global.t('instanceExport.exportFailed'))
    } finally {
      isSubmitting.value = false
    }
  }

  async function cancelExport(): Promise<void> {
    if (!exportOperationId.value) return
    const id = exportOperationId.value
    const requestGeneration = generation
    try {
      await operations.cancel(id)
    } catch (reason) {
      if (requestGeneration === generation && exportOperationId.value === id)
        error.value = getErrorMessage(reason, i18n.global.t('instanceExport.cancelFailed'))
      else console.warn('[InstanceExport] 请求取消导出失败:', reason)
    }
  }

  return {
    visible,
    target,
    displayName,
    preview,
    scanOperationId,
    exportOperationId,
    scanOperation,
    exportOperation,
    selectedFileIds,
    selectedFiles,
    selectedBytes,
    hasPersonalFiles,
    packName,
    packVersion,
    summary,
    resourceMode,
    search,
    error,
    isSubmitting,
    isPreparing,
    isExporting,
    result,
    canExport,
    open,
    close,
    detach,
    scan,
    setSelection,
    selectAll,
    selectCategory,
    submit,
    cancelExport,
  }
})
