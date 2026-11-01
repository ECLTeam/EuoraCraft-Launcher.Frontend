import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { modpackApi, parseModpackResult } from '@/features/instances/api/modpackApi'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { i18n } from '@/i18n'
import type { MinecraftPathEntry } from '@/types/config'
import type { ModpackPreview } from '@/types/modpack'

function derivePackName(path: string): string {
  if (!path) return ''
  const base = path.split(/[\\/]/).pop() || ''
  const stem = base.replace(/\.(zip|mrpack)$/i, '')
  return stem.replace(/[\\/:*?"<>|]/g, ' ').trim() || ''
}

export { derivePackName }

/**
 * 从拖放的 File 列表中提取首个整合包文件绝对路径（.zip / .mrpack）。
 * 供全局拖放使用；模组(.jar)/存档(.zip) 由各自面板的 @drop.prevent 先行拦截。
 */
export function extractPackPath(files: ArrayLike<File> | undefined): string | undefined {
  if (!files) return undefined
  return Array.from(files)
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path))
    .find((path) => /\.(zip|mrpack)$/i.test(path))
}

/**
 * 在线整合包安装的预填信息：来源平台、项目与文件 ID、展示标题。
 */
export interface OnlinePackTarget {
  source: 'modrinth' | 'curseforge' | 'ftb'
  projectId: string
  fileId: string
  title: string
}

/**
 * 整合包导入对话框的全局状态。
 * 由「导入整合包」按钮与全局文件拖放共同打开；导入为全新安装，用户选择安装目录与实例名。
 * 在线安装（下载页整合包 Tab）复用同一对话框，仅预填来源与文件标识，跳过本地文件选择。
 */
export const useModpackImportStore = defineStore('modpackImport', () => {
  const visible = ref(false)
  const sourcePath = ref('')
  const versionName = ref('')
  const gamePath = ref('')
  const gamePaths = ref<{ value: string; label: string }[]>([])
  const isSubmittingImport = ref(false)
  const onlinePack = ref<OnlinePackTarget | null>(null)
  const step = ref<'source' | 'preparing' | 'preview' | 'confirm' | 'installing' | 'result'>('source')
  const preview = ref<ModpackPreview | null>(null)
  const preparationId = ref('')
  const preparationOperationId = ref('')
  const installOperationId = ref('')
  const excludedFileIds = ref<string[]>([])
  const error = ref('')
  const cleanupError = ref('')
  const search = ref('')
  const canPrepareAgain = ref(true)
  const installInputs = new Map<
    string,
    { sourcePath: string; onlinePack: OnlinePackTarget | null; gamePath: string; versionName: string }
  >()
  const operations = useApplicationOperationStore()
  let generation = 0
  let isLoadingPreview = false

  const isOnline = computed(() => Boolean(onlinePack.value))
  const onlineTitle = computed(() => onlinePack.value?.title || '')
  const canPrepare = computed(() => Boolean(onlinePack.value || sourcePath.value))
  const canImport = computed(() =>
    Boolean(preview.value && preparationId.value && versionName.value.trim() && gamePath.value)
  )
  const preparationOperation = computed(() => operations.operations[preparationOperationId.value])
  const installOperation = computed(() => operations.operations[installOperationId.value])
  const result = computed(() => parseModpackResult(installOperation.value?.result))
  const optionalFiles = computed(() => preview.value?.files.filter((file) => file.requirement === 'optional') || [])
  const requiredFiles = computed(() => preview.value?.files.filter((file) => file.requirement === 'required') || [])
  const unsupportedFiles = computed(
    () => preview.value?.files.filter((file) => file.requirement === 'unsupported') || []
  )
  const visibleOptionalFiles = computed(() =>
    optionalFiles.value.filter((file) => file.path.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))
  )
  const selectedFiles = computed(
    () =>
      preview.value?.files.filter(
        (file) => file.requirement !== 'unsupported' && !excludedFileIds.value.includes(file.fileId)
      ) || []
  )
  const knownBytes = computed(() => selectedFiles.value.reduce((sum, file) => sum + (file.size ?? 0), 0))
  const unknownSizeCount = computed(() => selectedFiles.value.filter((file) => file.size === null).length)

  async function release(id: string) {
    if (!id) return
    try {
      await modpackApi.release(id)
    } catch {
      cleanupError.value = i18n.global.t('modpackWizard.releaseFailed')
    }
  }

  function resetPreparation() {
    generation++
    const previous = preparationId.value
    preparationId.value = ''
    preparationOperationId.value = ''
    preview.value = null
    excludedFileIds.value = []
    search.value = ''
    error.value = ''
    isLoadingPreview = false
    void release(previous)
  }

  async function loadGamePaths(): Promise<string> {
    const settings = useSettingsStore()
    if (settings.status !== 'ready') await settings.load()
    const paths = settings.game.minecraft_paths || []
    gamePaths.value = paths.map((p: MinecraftPathEntry) => {
      const value = typeof p === 'string' ? p : p.path || ''
      const label = typeof p === 'object' && p.name ? p.name : value
      return { value, label }
    })
    return settings.game.last_install_path || gamePaths.value[0]?.value || ''
  }

  async function open(opts?: { sourcePath?: string }) {
    if (isSubmittingImport.value) return
    resetPreparation()
    const requestGeneration = generation
    onlinePack.value = null
    canPrepareAgain.value = true
    sourcePath.value = opts?.sourcePath || ''
    versionName.value = derivePackName(sourcePath.value)
    installOperationId.value = ''
    step.value = 'source'
    visible.value = true
    try {
      const path = await loadGamePaths()
      if (requestGeneration === generation) gamePath.value = path
    } catch {
      if (requestGeneration === generation) error.value = i18n.global.t('modpackWizard.pathsFailed')
    }
  }

  async function openOnline(target: OnlinePackTarget) {
    if (isSubmittingImport.value) return
    const expectedGeneration = generation + 1
    await open()
    if (!visible.value || generation !== expectedGeneration) return
    onlinePack.value = { ...target }
    versionName.value = target.title
  }

  function close() {
    if (isSubmittingImport.value) return
    resetPreparation()
    visible.value = false
  }

  function setSource(path: string) {
    if (isSubmittingImport.value) return
    resetPreparation()
    sourcePath.value = path
    if (!versionName.value) versionName.value = derivePackName(path)
    step.value = 'source'
  }

  async function prepare() {
    if (!canPrepare.value || step.value === 'preparing' || isSubmittingImport.value) return
    resetPreparation()
    const requestGeneration = generation
    step.value = 'preparing'
    const target = onlinePack.value
    try {
      const prepared = await modpackApi.prepare(
        target
          ? { source: target.source, project_id: target.projectId, file_id: target.fileId }
          : { source: 'local', source_path: sourcePath.value }
      )
      if (requestGeneration !== generation) {
        void release(prepared.preparationId)
        return
      }
      preparationId.value = prepared.preparationId
      preparationOperationId.value = prepared.operationId
      void operations.track({ operationId: prepared.operationId, kind: 'modpack_prepare', status: 'pending' })
    } catch (reason) {
      if (requestGeneration !== generation) return
      error.value = reason instanceof Error ? reason.message : i18n.global.t('modpackWizard.prepareFailed')
      step.value = 'source'
    }
  }

  watch([preparationOperation, step], async ([operation, currentStep]) => {
    if (currentStep !== 'preparing' || !operation || isLoadingPreview) return
    if (operation.status === 'failed' || operation.status === 'cancelled') {
      error.value =
        operation.error ||
        i18n.global.t(operation.status === 'cancelled' ? 'modpackWizard.cancelled' : 'modpackWizard.prepareFailed')
      step.value = 'source'
      return
    }
    if (operation.status !== 'completed') return
    const requestGeneration = generation
    const id = preparationId.value
    isLoadingPreview = true
    try {
      const prepared = await modpackApi.get(id)
      if (requestGeneration !== generation) return
      if (prepared.status !== 'ready' || !prepared.preview)
        throw new Error(i18n.global.t('modpackWizard.previewExpired'))
      preview.value = prepared.preview
      step.value = optionalFiles.value.length ? 'preview' : 'confirm'
    } catch (reason) {
      if (requestGeneration === generation) {
        error.value = reason instanceof Error ? reason.message : i18n.global.t('modpackWizard.prepareFailed')
        step.value = 'source'
      }
    } finally {
      if (requestGeneration === generation) isLoadingPreview = false
    }
  })

  function selectFile(fileId: string, selected: boolean) {
    if (!optionalFiles.value.some((file) => file.fileId === fileId)) return
    excludedFileIds.value = selected
      ? excludedFileIds.value.filter((id) => id !== fileId)
      : [...new Set([...excludedFileIds.value, fileId])]
  }

  function selectAll(selected: boolean) {
    excludedFileIds.value = selected ? [] : optionalFiles.value.map((file) => file.fileId)
  }

  async function importPack(): Promise<{ ok: boolean; error?: string }> {
    if (!canImport.value || isSubmittingImport.value || step.value !== 'confirm') return { ok: false }
    isSubmittingImport.value = true
    error.value = ''
    try {
      const submitted = await modpackApi.install(preparationId.value, gamePath.value, versionName.value.trim(), [
        ...excludedFileIds.value,
      ])
      installOperationId.value = submitted.operationId
      installInputs.set(submitted.operationId, {
        sourcePath: sourcePath.value,
        onlinePack: onlinePack.value ? { ...onlinePack.value } : null,
        gamePath: gamePath.value,
        versionName: versionName.value,
      })
      step.value = 'installing'
      void operations.track({
        operationId: submitted.operationId,
        kind: isOnline.value ? 'modpack_online_install' : 'instance_import',
        status: 'pending',
      })
      return { ok: true }
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : i18n.global.t('modpackWizard.installFailed')
      return { ok: false, error: error.value }
    } finally {
      isSubmittingImport.value = false
    }
  }

  watch([installOperation, step], ([operation, currentStep]) => {
    if (currentStep === 'installing' && operation && ['completed', 'failed', 'cancelled'].includes(operation.status))
      step.value = 'result'
  })

  async function openResult(operationId: string) {
    if (isSubmittingImport.value) return
    resetPreparation()
    installOperationId.value = operationId
    preview.value = null
    const target = operations.targets[operationId]
    const inputs = installInputs.get(operationId)
    canPrepareAgain.value = Boolean(inputs)
    sourcePath.value = inputs?.sourcePath || ''
    onlinePack.value = inputs?.onlinePack || null
    gamePath.value = inputs?.gamePath || target?.game_path || ''
    versionName.value = inputs?.versionName || target?.version_id || ''
    step.value = 'result'
    visible.value = true
    await operations.refresh(operationId)
  }

  function backToSource() {
    resetPreparation()
    installOperationId.value = ''
    step.value = 'source'
  }

  return {
    visible,
    sourcePath,
    versionName,
    gamePath,
    gamePaths,
    isSubmittingImport,
    onlinePack,
    isOnline,
    onlineTitle,
    canImport,
    canPrepare,
    canPrepareAgain,
    step,
    preview,
    preparationId,
    preparationOperationId,
    installOperationId,
    preparationOperation,
    installOperation,
    result,
    excludedFileIds,
    error,
    cleanupError,
    search,
    optionalFiles,
    requiredFiles,
    unsupportedFiles,
    visibleOptionalFiles,
    selectedFiles,
    knownBytes,
    unknownSizeCount,
    open,
    openOnline,
    close,
    setSource,
    prepare,
    selectFile,
    selectAll,
    importPack,
    openResult,
    backToSource,
  }
})
