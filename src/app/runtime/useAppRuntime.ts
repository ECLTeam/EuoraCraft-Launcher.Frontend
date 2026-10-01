import { computed, readonly, ref, type Ref } from 'vue'
import backend from '@/api/client'
import { desktopWindow } from '@/app/runtime/desktopWindow'
import { initPluginBridge, destroyPluginBridge, scopePluginCss } from '@/composables/usePluginBridge'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import { initTheme } from '@/composables/useTheme'
import { useGameHomeStore } from '@/features/game-home/stores/gameHomeStore'
import { useUpdateCheck } from '@/features/settings/composables/useUpdateCheck'
import { shouldShowStartupUpdate } from '@/features/settings/model/updateNotice'
import { i18n, supportedLocales } from '@/i18n'
import type { BackendEvents } from '@/types/api'
import type { DownloadConfig, GameConfig } from '@/types/config'
import type { InstallProgress } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'
import { launcherErrorQueue } from './errorPresentation'
import { installDesktopInteractionPolicy } from './interactionPolicy'
import { launcherPopupQueue, notifyLauncherPopup } from './useLauncherPopupQueue'
import type { Router } from 'vue-router'
/** 版本检测共享状态，启动自动检测与设置页手动检测共用。 */
const updateCheck = useUpdateCheck()

interface MessageService {
  warning(message: string, options?: number | { title?: string; duration?: number }): unknown
  info(message: string, options?: number | { title?: string; duration?: number }): unknown
  error(message: string, options?: number | { title?: string; duration?: number }): unknown
}

interface UseAppRuntimeOptions {
  router: Router
  t: (key: string) => string
  message: MessageService
  markAgreementNotAccepted: () => void
  showAgreementModal: Ref<boolean>
}

export function useAppRuntime(options: UseAppRuntimeOptions) {
  const isDevMode = ref(false)
  const launcherVersion = ref('')
  const launcherVersionType = ref<'alpha' | 'beta' | 'rc' | 'release'>('release')
  const gameConfig = ref<GameConfig | null>(null)
  const downloadConfig = ref<DownloadConfig | null>(null)

  const popupQueue = launcherPopupQueue
  // 公告弹窗视图只消费非错误条目；错误条目由 ErrorModal 渲染，避免两个弹窗同时显示。
  const activePopup = computed(() => {
    const popup = popupQueue.activePopup.value
    return popup && !popup.errorId ? popup : null
  })
  const popupVisible = computed(() => activePopup.value !== null)
  const showErrorModal = launcherErrorQueue.visible
  const errorTitle = computed(() => {
    const error = launcherErrorQueue.activeError.value
    return error?.kind === 'game_crash' ? options.t('error.crash.title') : (error?.title ?? '')
  })
  const errorMessage = computed(() => {
    const error = launcherErrorQueue.activeError.value
    if (error?.kind !== 'game_crash' || !error.crash) return error?.message ?? ''
    const key = error.crash.detectedBy.includes('manual') ? 'error.crash.manualMessage' : 'error.crash.autoMessage'
    return i18n.global.t(key, {
      version: error.crash.versionId,
      exitCode: error.crash.exitCode ?? i18n.global.t('error.crash.unknown'),
    })
  })
  const errorDetail = computed(() => launcherErrorQueue.activeError.value?.detail ?? '')
  const errorId = computed(() => launcherErrorQueue.activeError.value?.error_id ?? '')
  const errorKind = computed(() => launcherErrorQueue.activeError.value?.kind)
  const crashAnalysis = computed(() => launcherErrorQueue.activeError.value?.crash)

  const cleanupCallbacks: Array<() => void> = []
  let started = false
  let syncingPendingErrors = false
  let notifySeq = 0

  async function applyConfig(payload: BackendEvents['config:init']): Promise<void> {
    const launcher = payload.launcher
    if (launcher) {
      isDevMode.value = launcher.debug === true
    }

    if (payload.game) gameConfig.value = payload.game
    if (payload.download) downloadConfig.value = payload.download

    const ui = payload.ui
    if (!ui) return
    if (ui.locale) {
      const locale = supportedLocales.find(({ code }) => code === ui.locale)?.code
      if (locale) {
        i18n.global.locale.value = locale
        document.documentElement.setAttribute('lang', locale)
      }
    }
    try {
      await initTheme(ui)
    } catch (error) {
      notifyLauncherPopup({
        id: 'ui-config-load-failed',
        title: '界面配置加载失败',
        content: getErrorMessage(error),
        level: 'warning',
      })
    }
  }

  function getSubtaskLabel(subtask: string): string {
    const labels: Record<string, string> = {
      download_json: options.t('task.subtask.downloadJson'),
      download_assets: options.t('task.subtask.downloadAssets'),
      check_files: options.t('task.subtask.checkFiles'),
    }
    return labels[subtask] || subtask
  }

  function handleInstallProgress(payload: InstallProgress): void {
    const taskId = payload.task_id
    if (!taskId) return

    // 任务尚未创建（如启动期由后端上报的内置下载）且带显示名时，自动建队列条目。
    if (!globalTaskQueue.tasks.value.some((t) => t.id === taskId)) {
      if (!payload.name) return
      globalTaskQueue.addTask({ type: 'download', name: payload.name, versionId: '', loaderType: '' }, taskId)
    }

    const phase = payload.phase || ''
    const message = payload.message || ''
    const done = payload.done ?? 0
    const total = payload.total ?? 1
    const subtask = payload.subtask || ''
    const progressType =
      payload.progress_type === 'bytes' || payload.progress_type === 'files' ? payload.progress_type : undefined

    if (phase === 'done') {
      globalTaskQueue.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: message || '安装完成',
        progressType,
        done,
        total,
        totalFiles: payload.total_files,
        downloadedFiles: payload.downloaded_files,
        speed: 0,
      })
    } else if (phase === 'error') {
      globalTaskQueue.updateTask(taskId, {
        status: 'error',
        message: message || '安装失败',
        progressType,
        done,
        total,
        totalFiles: payload.total_files,
        downloadedFiles: payload.downloaded_files,
        speed: 0,
      })
    } else {
      // 所有阶段按 done/total 线性计算真实进度，下载阶段使用字节/文件进度
      const progress = total > 0 ? Math.round((done / total) * 100) : 3
      globalTaskQueue.updateTask(taskId, {
        status: 'running',
        progress: Math.max(1, Math.min(100, progress)),
        message,
        progressType,
        done,
        total,
        totalFiles: payload.total_files,
        downloadedFiles: payload.downloaded_files,
        speed: payload.speed,
      })
    }

    if (subtask) {
      globalTaskQueue.addSubtask(taskId, {
        id: subtask,
        name: getSubtaskLabel(subtask),
        status: phase === 'done' ? 'completed' : phase === 'error' ? 'error' : 'running',
        message,
      })
    }
  }

  function registerBackendEvents(): void {
    cleanupCallbacks.push(
      backend.on('launcher:notify', (payload) => {
        const source = payload.source === 'plugin' ? 'plugin' : 'launcher'
        // 警告与错误影响功能使用，升级为弹窗按优先级排队展示；info 仍是瞬时通知。
        if (payload.type === 'warning' || payload.type === 'error') {
          popupQueue.enqueuePopup({
            id: `notify-${payload.type}-${Date.now()}-${notifySeq++}`,
            title: payload.title || (payload.type === 'error' ? '启动器错误' : '启动器警告'),
            content: payload.message,
            level: payload.type === 'error' ? 'critical' : 'warning',
            source,
          })
          return
        }
        options.message.info(payload.message, { title: payload.title, duration: 8000 })
      }),
      backend.on('launcher:agreement_required', () => {
        options.markAgreementNotAccepted()
        options.showAgreementModal.value = true
      }),
      backend.on('launcher:error', (payload) => {
        launcherErrorQueue.enqueue(payload)
      }),
      backend.on('launcher:popup', popupQueue.enqueuePopup),
      backend.on('launcher:open_page', ({ page }) => {
        const routes = {
          games: '/',
          instances: '/versions',
          download: '/download',
          settings: '/settings',
          more: '/more',
        }
        if (page in routes) void options.router.push(routes[page])
      }),
      backend.on('launcher:visibility', (payload) => {
        const action = payload?.action
        if (action === 'minimize') void desktopWindow.minimize()
        else if (action === 'quit') void desktopWindow.close()
      }),
      backend.on('update:check_completed', (result) => {
        updateCheck.setStartupCheckResult(result)
        if (shouldShowStartupUpdate(result)) updateCheck.updateDialogVisible.value = true
      }),
      backend.on('config:init', (payload) => {
        if (backend.isShowcaseActive) return
        void applyConfig(payload)
      }),
      backend.on('config:updated', (payload) => {
        if (payload.section !== 'launcher') return
        const launcher = (payload.data as { debug?: boolean } | null) ?? {}
        isDevMode.value = launcher.debug === true
      }),
      backend.on('plugin:css_injected', (payload) => {
        const pluginName = payload.plugin || 'unknown'
        const styleKey =
          payload.key !== null && payload.key !== undefined ? encodeURIComponent(payload.key) : crypto.randomUUID()
        const id = `plugin-css-${pluginName}-${styleKey}`
        let styleElement = document.getElementById(id) as HTMLStyleElement | null
        if (!styleElement) {
          styleElement = document.createElement('style')
          styleElement.id = id
          styleElement.setAttribute('data-plugin', pluginName)
          document.head.appendChild(styleElement)
        }
        styleElement.textContent = scopePluginCss(pluginName, payload.css || '')
      }),
      backend.on('game:install_progress', handleInstallProgress)
    )
  }

  async function notifyFrontendReady(): Promise<void> {
    await options.router.isReady()
    await document.fonts.ready
    const result = await backend.command('frontend_ready')
    if (!result.success) console.error('[AppRuntime] 通知后端前端已就绪失败:', result.message)
  }

  async function syncPendingErrors(): Promise<void> {
    if (syncingPendingErrors || backend.isShowcaseActive) return
    syncingPendingErrors = true
    try {
      const result = await backend.command('launcher_errors_pending')
      if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return
      const errorIds: string[] = []
      for (const error of result.data) {
        launcherErrorQueue.enqueue(error)
        if (error.error_id) errorIds.push(error.error_id)
      }
      if (errorIds.length > 0) {
        await backend.command('launcher_errors_ack', { error_ids: errorIds })
      }
    } finally {
      syncingPendingErrors = false
    }
  }

  async function loadInitialConfig(): Promise<void> {
    const result = await backend.config.getMany(['launcher', 'game', 'download', 'ui'])
    if (result.success && result.data) {
      await applyConfig(result.data as unknown as BackendEvents['config:init'])
    } else if (!result.success) {
      notifyLauncherPopup({
        id: 'launcher-config-load-failed',
        title: '读取启动器配置失败',
        content: result.message || '读取启动器配置失败，部分功能可能无法正常使用。',
        level: 'warning',
      })
    }
  }

  async function loadRuntimeLauncherInfo(): Promise<void> {
    const result = await backend.command('launcher_info')
    if (!result.success || !result.data) return

    launcherVersion.value = result.data.version || ''
    const versionType = result.data.version_type
    launcherVersionType.value =
      versionType === 'alpha' || versionType === 'beta' || versionType === 'rc' || versionType === 'release'
        ? versionType
        : 'release'
  }

  async function start(): Promise<void> {
    if (started || !backend.runtime.isAvailable) return
    started = true

    // 必须在 registerBackendEvents 之前检查展示模式，
    // 否则 notifyFrontendReady 后后端发送的 config:init 事件会先于 swap 被处理
    const launcherResult = await backend.config.get('launcher')
    if (launcherResult.success && (launcherResult.data as Record<string, unknown>)?.showcase === true) {
      backend.swapToShowcase()
    }

    registerBackendEvents()
    cleanupCallbacks.push(installDesktopInteractionPolicy(readonly(isDevMode)))
    initPluginBridge(options.router)
    await backend.waitForEventListeners()
    await loadInitialConfig()
    await loadRuntimeLauncherInfo()
    await notifyFrontendReady()
    await syncPendingErrors()
    // 首屏与事件监听已就绪后再预热低优先级数据，任何失败均不影响启动器可用性。
    if (backend.runtime.isDesktop) {
      void useGameHomeStore()
        .load()
        .catch(() => undefined)
      void backend.command('launcher_preload_connector').catch(() => undefined)
    }
    // 启动时同步一次积压错误；此后依赖 launcher:error 事件实时推送，低频轮询仅作兜底
    const pendingErrorTimer = window.setInterval(() => void syncPendingErrors(), 1_000)
    cleanupCallbacks.push(() => window.clearInterval(pendingErrorTimer))
  }

  function stop(): void {
    if (!started) return
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup())
    destroyPluginBridge()
    started = false
  }

  return {
    runtimeMode: backend.runtime.modeState,
    isShowcaseMode: backend.runtime.isShowcaseState,
    isDevMode: readonly(isDevMode),
    launcherVersion: readonly(launcherVersion),
    launcherVersionType: readonly(launcherVersionType),
    gameConfig: readonly(gameConfig),
    downloadConfig: readonly(downloadConfig),
    showErrorModal,
    errorTitle: readonly(errorTitle),
    errorMessage: readonly(errorMessage),
    errorDetail: readonly(errorDetail),
    errorId: readonly(errorId),
    errorKind,
    crashAnalysis,
    dismissActiveError: launcherErrorQueue.dismissActive,
    activePopup,
    popupVisible,
    dismissActivePopup: popupQueue.dismissActivePopup,
    start,
    stop,
  }
}
