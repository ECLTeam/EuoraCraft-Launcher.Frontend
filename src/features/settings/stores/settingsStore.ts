import { defineStore, storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { toJavaInstallations, useJavaRuntimeStore } from '@/features/java/stores/javaRuntimeStore'
import { resolveLocalImageUrl, settingsApi } from '@/features/settings/api/settingsApi'
import type {
  BackgroundConfig,
  BackgroundImageConfig,
  BackgroundVideoConfig,
  BackgroundVideoSource,
  ConnectorConfig,
  DownloadConfig,
  GameConfig,
  LauncherConfig,
  UiConfig,
} from '@/types/config'
import type { JavaInstallation } from '@/types/instances'

const DEFAULT_GAME_CONFIG: GameConfig = {
  minecraft_paths: [],
  java_auto: true,
  java_path: '',
  memory_auto: true,
  memory_size: 4096,
  lock_memory: false,
  process_priority: 'normal',
  game_width: 854,
  game_height: 480,
  jvm_args: [],
  renderer: 'default',
  fullscreen: false,
  instance_isolation_policy: 'all',
  game_args_tail: '',
  pre_launch_command: '',
  wrapper_command: '',
  post_exit_command: '',
  env_vars: '',
  window_title_template: '',
  launcher_visibility: 'none',
  prefer_high_performance_gpu: false,
  use_java_exe: false,
  disable_crash_analysis: false,
  active_path: '',
}

const DEFAULT_DOWNLOAD_CONFIG: DownloadConfig = {
  mirror_source: 'official',
}

const DEFAULT_LAUNCHER_CONFIG: LauncherConfig = {
  debug: false,
  disable_ssl_verify: false,
  api_proxy_mode: 'none',
  api_proxy_url: '',
  proxy_mode: 'none',
  proxy_url: '',
  request_timeout: 15,
  request_retries: 2,
}

function readImageBackground(background: Partial<BackgroundConfig> | undefined): BackgroundImageConfig {
  if (background?.image) return background.image
  return {
    type: background?.type,
    path: background?.path,
    image_base64: background?.image_base64,
    mode: background?.mode,
    interval: background?.interval,
    urls: background?.urls,
  }
}

function readVideoBackground(background: Partial<BackgroundConfig> | undefined): BackgroundVideoSource {
  const video = background?.video as unknown
  if (video && typeof video === 'object' && ('path' in video || 'options' in video)) {
    return video as BackgroundVideoSource
  }
  return {
    path: background?.media_type === 'video' ? background.path : undefined,
    poster_path: background?.media_type === 'video' ? background.poster_path : undefined,
    options: video as BackgroundVideoConfig | undefined,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const ui = ref<UiConfig>({})
  const game = ref<GameConfig>({ ...DEFAULT_GAME_CONFIG })
  const download = ref<DownloadConfig>({ ...DEFAULT_DOWNLOAD_CONFIG })
  const launcher = ref<LauncherConfig>({ ...DEFAULT_LAUNCHER_CONFIG })
  const connector = ref<ConnectorConfig>({ mode: 'automatic', nodes: [] })
  const { status, isLoading } = useAsyncState()
  const javaStore = useJavaRuntimeStore()
  const { status: javaStatus, isLoading: isJavaLoading, installations: javaInstallations } = storeToRefs(javaStore)
  const error = ref('')
  let loadPromise: Promise<void> | null = null
  let latestLoadId = 0
  let configRevision = 0
  const writeQueues = new Map<string, Promise<void>>()

  async function load(force = false): Promise<void> {
    if (!force && status.value === 'ready') return
    if (!force && loadPromise) return loadPromise
    const loadId = ++latestLoadId
    const revisionAtStart = configRevision
    status.value = 'loading'
    error.value = ''
    const request: Promise<void> = (async () => {
      try {
        const config = await settingsApi.load()
        // 读取期间若已有本地写入完成，旧快照不能覆盖新状态。
        if (loadId !== latestLoadId) return
        if (revisionAtStart !== configRevision) {
          status.value = 'ready'
          return
        }
        ui.value = config.ui
        game.value = { ...DEFAULT_GAME_CONFIG, ...config.game }
        download.value = { ...DEFAULT_DOWNLOAD_CONFIG, ...config.download }
        launcher.value = { ...config.launcher }
        connector.value = config.connector ?? { mode: 'automatic', nodes: [] }
        status.value = 'ready'
      } catch (reason) {
        if (loadId === latestLoadId) {
          status.value = 'error'
          error.value = reason instanceof Error ? reason.message : '读取设置失败'
        }
        throw reason
      } finally {
        if (loadId === latestLoadId) loadPromise = null
      }
    })()
    loadPromise = request
    return request
  }

  async function loadJavaInstallations(force = false): Promise<JavaInstallation[]> {
    return toJavaInstallations((await javaStore.load(force)).runtimes)
  }

  function invalidateJavaInstallations(): void {
    javaStore.invalidate()
  }

  /**
   * 同一配置区的“读取当前值 → 合并 → 写回”必须串行执行，避免并发局部更新互相覆盖。
   */
  function enqueueWrite<T>(section: string, action: () => Promise<T>): Promise<T> {
    const previous = writeQueues.get(section) ?? Promise.resolve()
    const request = previous.catch(() => undefined).then(action)
    writeQueues.set(
      section,
      request.then(
        () => undefined,
        () => undefined
      )
    )
    return request
  }

  async function ensureReady(): Promise<void> {
    if (status.value !== 'ready') await load()
  }

  async function refreshAfterWrites(): Promise<void> {
    await Promise.all([...writeQueues.values()])
    await load(true)
  }

  async function patchUi(patch: Partial<UiConfig>): Promise<void> {
    await enqueueWrite('ui', async () => {
      await ensureReady()
      const next = { ...ui.value, ...patch }
      await settingsApi.saveUi(next)
      ui.value = next
      configRevision += 1
    })
  }

  async function patchUiTheme(patch: NonNullable<UiConfig['theme']>): Promise<void> {
    await enqueueWrite('ui', async () => {
      await ensureReady()
      const next = { ...ui.value, theme: { ...ui.value.theme, ...patch } }
      await settingsApi.saveUi(next)
      ui.value = next
      configRevision += 1
    })
  }

  async function patchUiBackground(patch: Partial<NonNullable<UiConfig['background']>>): Promise<void> {
    await enqueueWrite('ui', async () => {
      await ensureReady()
      const current = ui.value.background
      const image = patch.image ? { ...readImageBackground(current), ...patch.image } : readImageBackground(current)
      const video = patch.video
        ? {
            ...readVideoBackground(current),
            ...patch.video,
            options: patch.video.options
              ? { ...readVideoBackground(current).options, ...patch.video.options }
              : readVideoBackground(current).options,
          }
        : readVideoBackground(current)
      const next = {
        ...ui.value,
        background: { ...current, ...patch, image, video },
      }
      await settingsApi.saveUi(next)
      ui.value = next
      configRevision += 1
    })
  }

  async function patchGame(patch: Partial<GameConfig>): Promise<void> {
    await enqueueWrite('game', async () => {
      await ensureReady()
      const next = { ...game.value, ...patch }
      await settingsApi.saveGame(next)
      game.value = next
      configRevision += 1
    })
  }

  async function patchLauncher(patch: Partial<LauncherConfig>): Promise<void> {
    await enqueueWrite('launcher', async () => {
      await ensureReady()
      const next = { ...launcher.value, ...patch }
      await settingsApi.saveLauncher(next)
      launcher.value = next
      configRevision += 1
    })
  }

  async function patchDownload(patch: Partial<DownloadConfig>): Promise<void> {
    const submittedPatch = structuredClone(patch)
    await enqueueWrite('download', async () => {
      await ensureReady()
      download.value = await settingsApi.patchDownload(submittedPatch)
      configRevision += 1
    })
  }

  async function patchConnector(patch: Partial<ConnectorConfig>): Promise<void> {
    await enqueueWrite('connector', async () => {
      await ensureReady()
      const next = { ...connector.value, ...patch }
      await settingsApi.saveConnector(next)
      connector.value = next
      configRevision += 1
    })
  }

  async function chooseBackgroundImage(): Promise<{ path: string; imageUrl: string | null } | null> {
    const path = await settingsApi.selectImage()
    if (!path) return null
    await patchUiBackground({
      media_type: 'image',
      image: { type: 'custom', path, image_base64: '', mode: 'single' },
    })
    return { path, imageUrl: await resolveLocalImageUrl(path) }
  }

  async function chooseBackgroundVideo(): Promise<{ path: string; videoUrl: string | null } | null> {
    const path = await settingsApi.selectBackgroundVideo()
    if (!path) return null
    await patchUiBackground({
      media_type: 'video',
      video: {
        path,
        options: { muted: true, volume: 0, fit: 'cover', pause_when_inactive: true },
      },
    })
    return { path, videoUrl: await settingsApi.openBackgroundVideo() }
  }

  async function saveRemoteBackground(url: string): Promise<{ path: string; imageUrl: string | null } | null> {
    const result = await settingsApi.saveImageUrl(url)
    if (!result) return null
    // 后端已将图片落盘到本地数据目录，配置只存路径，不再保存大体积 base64
    const localPath = result.path || result.url
    await patchUiBackground({
      media_type: 'image',
      image: { type: 'custom', path: localPath, mode: 'single', image_base64: '' },
    })
    return { path: localPath, imageUrl: result.dataUrl }
  }

  return {
    refreshAfterWrites,
    ui,
    game,
    download,
    launcher,
    connector,
    status,
    javaStatus,
    error,
    isLoading,
    isJavaLoading,
    javaInstallations,
    load,
    loadJavaInstallations,
    invalidateJavaInstallations,
    patchUi,
    patchUiTheme,
    patchUiBackground,
    patchGame,
    patchLauncher,
    patchDownload,
    patchConnector,
    chooseBackgroundImage,
    chooseBackgroundVideo,
    saveRemoteBackground,
  }
})
