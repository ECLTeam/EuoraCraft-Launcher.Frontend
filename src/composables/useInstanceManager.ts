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
  LAUNCH_BUSY_RETRY_DELAY,
  LAUNCH_BUSY_RETRY_LIMIT,
  LAUNCH_CANCEL_GUARD_DELAY,
  STATUS_MESSAGE_AUTO_HIDE,
} from '@/config/game'
import { gameHomeApi } from '@/features/game-home/api/gameHomeApi'
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
  cancelLaunch: () => void
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
  // 每次启动分配一个会话号：取消或重新启动都会让旧会话失效，迟到的进度与结果不再影响界面。
  let launchSession = 0
  // 取消后进度卡消失，同一位置可能正是启动按钮；记录时间用于吞掉连点造成的误启动。
  let lastCancelAt = 0
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
  function recordRecentLaunch(target: { versionId: string; gamePath: string }) {
    // 使用启动开始时捕获的目标，而不是当前选中项：启动耗时期间用户可能已切换实例。
    const scanned = instanceStore.scannedVersions.find(
      (item) =>
        item.versionId === target.versionId && normalizeGamePath(item.path) === normalizeGamePath(target.gamePath)
    )
    const instanceName = scanned ? instanceDisplayName(scanned) : target.versionId
    useRecentInstances().recordLaunch(target.versionId, instanceName, target.gamePath)
  }

  async function launchGame(currentAccount: { id: string } | null) {
    // 防重入：启动进行中时忽略重复触发，避免并发 game_launch 与重复事件监听
    if (launching.value) return
    // 刚点过取消时的连点忽略：取消按钮消失后同一位置就是启动按钮。
    if (Date.now() - lastCancelAt < LAUNCH_CANCEL_GUARD_DELAY) return
    javaRecoveryMessage.value = ''
    // 启动可能持续数十秒，期间选中项会变化；记录本次真正启动的目标。
    const launchTarget = { versionId: selectedVersion.value, gamePath: currentGamePath.value }
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
    const sessionId = ++launchSession
    const isCurrentSession = () => sessionId === launchSession
    showStatus(t('game.status.launching'), 'info')

    router.push({ name: 'game' })
    showLaunchProgress({ cancelable: true })

    const unlisten = backend.on('game:launch_progress', (payload: LaunchProgress) => {
      if (!isCurrentSession() || globalLaunchProgress.progress.value.canceled) {
        unlisten()
        return
      }

      const phase = payload?.phase || ''
      const msg = payload?.message || ''
      const pct = payload?.percent

      if (phase === 'launched') {
        recordRecentLaunch(launchTarget)
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

    try {
      // 确保 Tauri 事件监听已经落地，再让后端开始执行；否则启动较快时会漏掉前几个真实阶段。
      await backend.waitForEventListeners()
      if (!isCurrentSession()) return

      setLaunchProgress(0, 'prepare', `正在准备启动 ${selectedVersion.value}...`)

      const launchResult = await requestLaunch(selectedVersion.value, currentGamePath.value, isCurrentSession)
      if (!isCurrentSession()) return

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
        if (launchResult.errorCode === 'LAUNCH_ALREADY_RUNNING') {
          // 取消后立刻重试会撞上仍在退出的上一次启动，这里给普通提示而不是启动失败弹窗。
          message.warning(t('game.status.launchBusy'))
          setLaunchProgress(0, 'error', t('game.status.launchBusy'))
        } else if (isCanceled) {
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
    } catch (error) {
      if (!isCurrentSession()) return
      // 请求本身失败时同样要释放启动锁，否则启动按钮会一直禁用。
      const reason = error instanceof Error ? error.message : '启动请求未能送达后端，请重试。'
      setLaunchProgress(0, 'error', reason)
      notifyLauncherPopup({
        id: `game-launch-failed-${selectedVersion.value}`,
        title: '游戏启动失败',
        content: reason,
        level: 'critical',
        priority: 80,
      })
      setTimeout(hideLaunchProgress, 2000)
    } finally {
      unlisten()
      if (isCurrentSession()) launching.value = false
    }
  }

  /**
   * 发起启动请求；上一次启动仍在退出时短暂重试，避免取消后立刻重试直接失败。
   *
   * @param versionId 要启动的实例版本目录名
   * @param gamePath 该实例所在游戏根目录
   * @param isCurrentSession 判断本次启动会话是否仍然有效
   * @returns 最后一次启动请求的响应
   */
  async function requestLaunch(
    versionId: string,
    gamePath: string,
    isCurrentSession: () => boolean
  ): Promise<Awaited<ReturnType<typeof backend.command>>> {
    const body = { version_id: versionId, game_path: gamePath }
    let result = await backend.command('game_launch', body)
    for (let attempt = 0; attempt < LAUNCH_BUSY_RETRY_LIMIT; attempt += 1) {
      if (result.success || result.errorCode !== 'LAUNCH_ALREADY_RUNNING' || !isCurrentSession()) break
      await new Promise((resolve) => setTimeout(resolve, LAUNCH_BUSY_RETRY_DELAY))
      if (!isCurrentSession()) break
      result = await backend.command('game_launch', body)
    }
    return result
  }

  /**
   * 立即取消当前启动：马上释放启动按钮与进度卡，取消信号在后台送达后端。
   *
   * 后端清理（文件校验、下载收尾）可能还要一小会儿，因此这里只作废本次启动会话，
   * 迟到的进度与结果由会话号丢弃；用户若立刻重新启动，requestLaunch 会自动重试。
   */
  function cancelLaunch(): void {
    if (!launching.value) return
    launchSession += 1
    lastCancelAt = Date.now()
    launching.value = false
    globalLaunchProgress.cancel()
    void gameHomeApi
      .cancelLaunch()
      .then((canceled) => {
        // 取消信号到达时启动已经完成，游戏进程已经创建，必须如实告知用户。
        if (!canceled) message.warning(t('game.status.launchCancelMissed'))
      })
      .catch((error: unknown) => {
        console.warn('[LaunchCancel] 取消请求异常:', error)
      })
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
    cancelLaunch,
    setGamePath,
    showStatus,
  }) as InstanceManagerState
}
