import { storeToRefs } from 'pinia'
import { reactive, ref, type Ref, type UnwrapNestedRefs } from 'vue'
import { useRouter } from 'vue-router'
import backend from '@/api/client'
import { notifyLauncherPopup } from '@/app/runtime/useLauncherPopupQueue'
import { useRecentInstances } from '@/composables/useRecentInstances'
import {
  LAUNCH_PROGRESS,
  LAUNCH_SUCCESS_HIDE_DELAY,
  LAUNCH_ERROR_HIDE_DELAY,
  STATUS_MESSAGE_AUTO_HIDE,
} from '@/config/game'
import { instanceDisplayName } from '@/features/instances/model/instancePresentation'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { LaunchProgress } from '@/types/system'
import { normalizeGamePath } from '@/utils/path'
import { useLauncherMessage } from './useLauncherMessage'
import { globalLaunchProgress } from './useLaunchProgress'
export interface VersionItem {
  id: string
  type: string
  versionType: string
  gamePath: string
}

export interface InstanceManagerStateShape {
  versions: Ref<VersionItem[]>
  selectedVersion: Ref<string>
  currentGamePath: Ref<string>
  loading: Ref<boolean>
  launching: Ref<boolean>
  javaRecoveryMessage: Ref<string>
  isRescanningJava: Ref<boolean>
  rescanJava: () => Promise<void>
  statusMsg: Ref<string>
  statusType: Ref<'info' | 'success' | 'error'>
  loadVersions: () => Promise<void>
  selectVersion: (id: string, gamePath?: string) => void
  launchGame: (currentAccount: { id: string } | null) => Promise<void>
  setGamePath: (path: string) => void
  showStatus: (msg: string, type?: 'info' | 'success' | 'error') => void
}

export type InstanceManagerState = UnwrapNestedRefs<InstanceManagerStateShape>

export function useInstanceManager(t: (key: string, ...args: unknown[]) => string): InstanceManagerState {
  const message = useLauncherMessage()
  const router = useRouter()
  const instanceStore = useInstanceStore()
  const { versions, selectedVersion, currentGamePath } = storeToRefs(instanceStore)
  const { show: showLaunchProgress, hide: hideLaunchProgress, setProgress: setLaunchProgress } = globalLaunchProgress

  const loading = ref(false)
  const launching = ref(false)
  const javaRecoveryMessage = ref('')
  const isRescanningJava = ref(false)
  async function rescanJava() {
    if (isRescanningJava.value) return
    isRescanningJava.value = true
    try {
      await useSettingsStore().loadJavaInstallations(true)
      message.success(t('javaRecovery.scanned'))
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('game.status.scanFailed'))
    } finally {
      isRescanningJava.value = false
    }
  }
  const statusMsg = ref<string>('')
  const statusType = ref<'info' | 'success' | 'error'>('info')

  async function loadVersions() {
    loading.value = true
    try {
      await instanceStore.loadAll()
    } catch {
      loading.value = false
      showStatus(t('game.status.scanFailed'), 'error')
      return
    }
    loading.value = false
    if (!versions.value.length) {
      showStatus(t('game.status.noGameDir'), 'error')
    } else {
      showStatus(t('game.status.foundVersions', { count: versions.value.length }), 'success')
    }
  }

  function selectVersion(id: string, gamePath?: string) {
    instanceStore.selectVersion(id, gamePath)
  }

  function setGamePath(path: string) {
    instanceStore.setGamePath(path)
  }

  /** 启动成功后写入"最近启动"列表，启动失败/取消不记录 */
  function recordRecentLaunch() {
    const scanned = instanceStore.scannedVersions.find(
      (item) =>
        item.versionId === selectedVersion.value &&
        normalizeGamePath(item.path) === normalizeGamePath(currentGamePath.value)
    )
    const instanceName = scanned ? instanceDisplayName(scanned) : selectedVersion.value
    useRecentInstances().recordLaunch(selectedVersion.value, instanceName, currentGamePath.value)
  }

  async function launchGame(currentAccount: { id: string } | null) {
    // 防重入：启动进行中时忽略重复触发，避免并发 game_launch 与重复事件监听
    if (launching.value) return
    javaRecoveryMessage.value = ''
    const selected = instanceStore.scannedVersions.find(
      (item) =>
        item.versionId === selectedVersion.value &&
        normalizeGamePath(item.path) === normalizeGamePath(currentGamePath.value)
    )
    if (!selectedVersion.value) {
      showStatus(t('game.status.selectVersionFirst'), 'error')
      return
    }

    if (!currentAccount) {
      showStatus(t('game.status.noAccount'), 'error')
      message.error(t('game.status.noAccount'))
      return
    }

    if (!currentGamePath.value) {
      showStatus(t('game.status.noGamePath'), 'error')
      message.error(t('game.status.noGamePath'))
      return
    }

    launching.value = true
    showStatus(t('game.status.launching'), 'info')

    router.push({ name: 'game' })
    showLaunchProgress({ cancelable: true })

    const unlisten = backend.on('game:launch_progress', (payload: LaunchProgress) => {
      if (globalLaunchProgress.progress.value.canceled) {
        unlisten()
        return
      }

      const phase = payload?.phase || ''
      const msg = payload?.message || ''
      const pct = payload?.percent

      if (phase === 'launched') {
        recordRecentLaunch()
        setLaunchProgress(100, 'success', msg)
        setTimeout(hideLaunchProgress, LAUNCH_SUCCESS_HIDE_DELAY)
        unlisten()
      } else if (phase === 'error') {
        setLaunchProgress(0, 'error', msg)
        setTimeout(hideLaunchProgress, LAUNCH_ERROR_HIDE_DELAY)
        unlisten()
      } else if (phase === 'preparing') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.preparing!, 'preparing', msg)
      } else if (phase === 'account') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.account!, 'account', msg)
      } else if (phase === 'microsoft_token') {
        setLaunchProgress(
          typeof pct === 'number' ? pct : LAUNCH_PROGRESS.microsoft_token!,
          'refreshing_microsoft_token',
          msg
        )
      } else if (phase === 'authlib_token') {
        setLaunchProgress(
          typeof pct === 'number' ? pct : LAUNCH_PROGRESS.authlib_token!,
          'validating_authlib_token',
          msg
        )
      } else if (phase === 'offline_account') {
        setLaunchProgress(
          typeof pct === 'number' ? pct : LAUNCH_PROGRESS.offline_account!,
          'loading_offline_account',
          msg
        )
      } else if (phase === 'account_ready') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.account_ready!, 'account_ready', msg)
      } else if (phase === 'authlib') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.authlib!, 'preparing_authlib', msg)
      } else if (phase === 'downloading' && typeof pct === 'number') {
        setLaunchProgress(pct, 'downloading_assets', msg)
      } else if (phase === 'checking') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.checking!, 'checking_files', msg)
      } else if (phase === 'files_checked') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.files_checked!, 'files_checked', msg)
      } else if (phase === 'building_args') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.building_args!, 'building_params', msg)
      } else if (phase === 'args_built') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.args_built!, 'args_built', msg)
      } else if (phase === 'natives_done') {
        setLaunchProgress(LAUNCH_PROGRESS.natives_done!, 'natives_done', msg)
      } else if (phase === 'about_to_launch') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.about_to_launch!, 'about_to_launch', msg)
      } else if (phase === 'launching') {
        setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.launching!, 'launching', msg)
      } else {
        setLaunchProgress(2, 'prepare', msg)
      }
    })

    // 确保 Tauri 事件监听已经落地，再让后端开始执行；否则启动较快时会漏掉前几个真实阶段。
    await backend.waitForEventListeners()

    setLaunchProgress(0, 'prepare', `正在准备启动 ${selectedVersion.value}...`)

    const launchResult = await backend.command('game_launch', {
      version_id: selectedVersion.value,
      game_path: currentGamePath.value,
    })

    unlisten()
    launching.value = false

    if (!launchResult.success) {
      if (
        ['JAVA_NOT_FOUND', 'JAVA_VERSION_NOT_FOUND', 'JAVA_DISABLED', 'JAVA_INVALID_RUNTIME'].includes(
          launchResult.errorCode || ''
        )
      ) {
        const requirement = selected?.requiredJava
          ? t('javaRecovery.requiredMajor', { major: selected.requiredJava })
          : t('javaRecovery.unknownRequirement')
        javaRecoveryMessage.value = `${launchResult.message || t('javaRecovery.missing')} · ${requirement}`
      }
      const isCanceled = launchResult.message === '启动已取消'
      if (isCanceled) {
        setLaunchProgress(0, 'error', '已取消')
      } else if (!globalLaunchProgress.progress.value.canceled) {
        setLaunchProgress(0, 'error', launchResult.message || '启动失败')
        // 启动失败直接阻断核心功能，使用高优先级弹窗确保用户知晓。
        notifyLauncherPopup({
          id: `game-launch-failed-${selectedVersion.value}`,
          title: '游戏启动失败',
          content: launchResult.message || '启动失败，请检查实例配置与日志后重试。',
          level: 'critical',
          priority: 80,
        })
      }
      setTimeout(hideLaunchProgress, 2000)
      return
    }

    if (!globalLaunchProgress.progress.value.canceled) {
      setLaunchProgress(100, 'launched', `游戏 ${selectedVersion.value} 已启动`)
      message.success(`游戏 ${selectedVersion.value} 已启动`)
    }
    setTimeout(hideLaunchProgress, LAUNCH_SUCCESS_HIDE_DELAY)
  }

  let statusId = 0
  function showStatus(msg: string, type: 'info' | 'success' | 'error' = 'info') {
    const id = ++statusId
    statusMsg.value = msg
    statusType.value = type
    setTimeout(() => {
      if (statusId === id) {
        statusMsg.value = ''
      }
    }, STATUS_MESSAGE_AUTO_HIDE)
  }

  return reactive({
    versions,
    selectedVersion,
    currentGamePath,
    loading,
    launching,
    javaRecoveryMessage,
    isRescanningJava,
    rescanJava,
    statusMsg,
    statusType,
    loadVersions,
    selectVersion,
    launchGame,
    setGamePath,
    showStatus,
  }) as InstanceManagerState
}
