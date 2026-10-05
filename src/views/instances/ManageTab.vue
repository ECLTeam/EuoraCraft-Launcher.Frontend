<template>
  <div class="manage-page">
    <PluginSlotHost slotId="plugin-slot-versions-manage-top" class="plugin-slot-container" />
    <!-- 统一容器：路径列表 + 版本列表 -->
    <div class="manage-container">
      <InstancePathSidebar
        :paths="gamePaths"
        :selectedIndex="selectedPathIndex"
        :versionCounts="pathVersionCounts"
        @add="addNewPath"
        @select="selectPath"
        @edit="editPath"
        @remove="removePath"
        @openFolder="openPathFolder"
      />

      <!-- 分隔线 -->
      <div class="path-divider"></div>

      <InstalledInstanceList
        v-model:searchQuery="searchQuery"
        :versions="currentPathVersions"
        :selectedPathIndex="selectedPathIndex"
        :pathCount="gamePaths.length"
        :pathName="currentPathName"
        :pathLocation="currentPath?.path"
        :loading="loading"
        :refreshLoading="refreshLoading"
        :selectedVersion="instanceStore.selectedVersion"
        @refresh="handleRefresh"
        @changed="handleProfileChanged"
        @install="navigateToInstall"
        @addPath="addNewPath"
        @selectVersion="handleSelectVersion"
        @detail="handleOpenDetail"
        @launch="handleLaunch"
        @remove="handleDelete"
        @action="handleInstanceAction"
      />
    </div>

    <!-- 确认弹窗 -->
    <ConfirmDialog
      v-model:visible="showConfirmModal"
      :title="confirmTitle"
      :content="confirmContent"
      :loading="confirmLoading"
      :closeOnConfirm="false"
      danger
      @confirm="handleConfirmAction"
    />

    <!-- 添加/编辑路径弹窗 -->
    <Modal
      v-model:visible="showPathModal"
      :title="isEditing ? t('versions.manage.editGamePath') : t('versions.manage.addGamePath')"
      width="420px"
    >
      <div class="path-form">
        <div class="path-form-item">
          <div class="path-form-header">
            <label class="path-form-label">{{ t('versions.manage.pathName') }}</label>
            <span class="path-form-desc">{{ t('versions.manage.pathNameDesc') }}</span>
          </div>
          <UiInput
            v-model="pathForm.name"
            :placeholder="t('versions.manage.pathNamePlaceholder')"
            :disabled="pathSaving"
            prefixIcon="folder"
            class="path-form-input"
          />
        </div>
        <div class="path-form-item">
          <div class="path-form-header">
            <label class="path-form-label">{{ t('versions.manage.pathLocation') }}</label>
            <span class="path-form-desc">{{ t('versions.manage.pathLocationDesc') }}</span>
          </div>
          <div class="path-form-control">
            <UiInput
              v-model="pathForm.path"
              :placeholder="t('versions.manage.pathLocationPlaceholder')"
              :readonly="isDefaultPath"
              :disabled="pathSaving"
              class="path-form-input path-location-input"
            />
            <UiButton
              variant="secondary"
              size="lg"
              :disabled="isDefaultPath || pathSaving"
              icon="folder"
              @click="browseForPath"
            >
              {{ t('common.browse') }}
            </UiButton>
          </div>
        </div>
        <p v-if="pathFormError" class="path-form-feedback" role="alert">{{ pathFormError }}</p>
      </div>

      <template #footer>
        <UiButton variant="secondary" :disabled="pathSaving" @click="showPathModal = false">
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!pathForm.name || !pathForm.path"
          :loading="pathSaving"
          @click="savePath"
        >
          {{ isEditing ? t('common.save') : t('common.add') }}
        </UiButton>
      </template>
    </Modal>

    <!-- 版本详情全屏弹窗 -->
    <InstanceDetailModal
      v-model:visible="showDetailModal"
      :version="detailVersion"
      :initialTab="detailInitialTab"
      @launch="handleDetailLaunch"
      @delete="handleDetailDelete"
      @updated="handleProfileChanged"
      @action="handleInstanceAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import backend from '@/api/client'
import { notifyLauncherPopup } from '@/app/runtime/useLauncherPopupQueue'
import InstalledInstanceList from '@/components/instances/InstalledInstanceList.vue'
import InstancePathSidebar from '@/components/instances/InstancePathSidebar.vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import Modal from '@/components/modals/Modal.vue'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { globalLaunchProgress } from '@/composables/useLaunchProgress'
import { useRecentInstances } from '@/composables/useRecentInstances'
import { useRequestScope } from '@/composables/useRequestScope'
import { LAUNCH_PROGRESS, LAUNCH_SUCCESS_HIDE_DELAY, LAUNCH_ERROR_HIDE_DELAY } from '@/config/game'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { instancePathConfigApi } from '@/features/instances/api/instancePathConfigApi'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { findGamePathIndex, type GamePath } from '@/features/instances/model/gamePath'
import { instanceDisplayName } from '@/features/instances/model/instancePresentation'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { MinecraftPathEntry } from '@/types/config'
import type { ScannedVersion } from '@/types/instances'
import type { LaunchProgress } from '@/types/system'
import { getErrorMessage } from '@/utils/error'
import { gamePathIdentity } from '@/utils/path'
import InstanceDetailModal from '@/views/instances/InstanceDetailModal.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useLauncherMessage()
const instanceStore = useInstanceStore()
const settingsStore = useSettingsStore()

const gamePaths = ref<GamePath[]>([])
const selectedPathIndex = ref<number>(-1)
const selectionRequests = useRequestScope(
  () => `${selectedPathIndex.value}\0${gamePaths.value[selectedPathIndex.value]?.path ?? ''}`
)
const pathScanRequests = useRequestScope(
  () => `${selectedPathIndex.value}\0${gamePaths.value[selectedPathIndex.value]?.path ?? ''}`
)
const showPathModal = ref(false)
const isEditing = ref(false)
const editingIndex = ref(-1)

const pathForm = ref<GamePath>({ name: '', path: '' })

const loading = ref(false)
const refreshLoading = ref(false)
const searchQuery = ref('')

const showConfirmModal = ref(false)
const confirmLoading = ref(false)
const showDetailModal = ref(false)
const detailVersion = ref<ScannedVersion | null>(null)
type DetailTab =
  | 'overview'
  | 'mods'
  | 'resourcepacks'
  | 'shaderpacks'
  | 'datapacks'
  | 'schematics'
  | 'worlds'
  | 'screenshots'
  | 'servers'
  | 'profile'
  | 'settings'
const detailInitialTab = ref<DetailTab>('overview')
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmAction = ref<(() => void | Promise<void>) | null>(null)
const pathSaving = ref(false)
const pathFormError = ref('')
let rememberPathQueue = Promise.resolve()

const rememberSelectedPath = (path: string) => {
  rememberPathQueue = rememberPathQueue
    .then(async () => {
      if ((settingsStore.game.last_manage_path ?? '') === path) return
      await settingsStore.patchGame({ last_manage_path: path })
    })
    .catch((error) => {
      console.error(t('versions.manage.saveFailed'), error)
    })
  return rememberPathQueue
}

const openConfirm = (title: string, content: string, action: () => void | Promise<void>) => {
  confirmTitle.value = title
  confirmContent.value = content
  confirmAction.value = action
  confirmLoading.value = false
  showConfirmModal.value = true
}

const handleConfirmAction = async () => {
  if (!confirmAction.value || confirmLoading.value) return
  confirmLoading.value = true
  try {
    await confirmAction.value()
    showConfirmModal.value = false
    confirmAction.value = null
  } catch (error) {
    // 确认动作失败保持弹窗打开并提示，避免静默的未处理 rejection
    console.error('[ManageTab] 确认操作失败:', error)
    message.error(getErrorMessage(error, '操作失败'))
  } finally {
    confirmLoading.value = false
  }
}

const currentPath = computed(() => (selectedPathIndex.value >= 0 ? gamePaths.value[selectedPathIndex.value] : null))

const currentPathName = computed(() => currentPath.value?.name || t('versions.manage.versionList'))

const currentPathVersions = computed(() => {
  if (!currentPath.value) return []
  return instanceStore.scannedVersions.filter(
    (v) => gamePathIdentity(v.path) === gamePathIdentity(currentPath.value!.path)
  )
})

const pathVersionCounts = computed(() =>
  Object.fromEntries(
    gamePaths.value.map(({ path }) => [
      path,
      instanceStore.scannedVersions.filter((version) => gamePathIdentity(version.path) === gamePathIdentity(path))
        .length,
    ])
  )
)

onMounted(async () => {
  await fetchGamePaths()
})

onBeforeUnmount(() => {
  showPathModal.value = false
})

const fetchGamePaths = async () => {
  try {
    await settingsStore.load()
    const paths = settingsStore.game.minecraft_paths || []
    gamePaths.value = paths.map((p: MinecraftPathEntry) => {
      if (typeof p === 'string') {
        return { name: getPathNameFromPath(p), path: p }
      }
      return p
    })
    if (gamePaths.value.length > 0) {
      const requestedPath = typeof route.query.gamePath === 'string' ? route.query.gamePath : ''
      selectedPathIndex.value = findGamePathIndex(gamePaths.value, requestedPath, settingsStore.game.last_manage_path)
      const isCurrent = selectionRequests.begin()
      await Promise.all([scanCurrentPath(), rememberSelectedPath(currentPath.value?.path ?? '')])
      if (!isCurrent()) return
      // 从 ecl.json 恢复该路径的选中实例
      if (currentPath.value) {
        await instanceStore.switchPath(currentPath.value.path)
      }
      openRequestedVersionSettings()
    } else {
      selectedPathIndex.value = -1
      await rememberSelectedPath('')
    }
  } catch (error) {
    console.error(t('versions.manage.fetchConfigFailed'), error)
  }
}

const getPathNameFromPath = (path: string): string => {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || t('versions.manage.gamePath')
}

const handleSelectVersion = (version: ScannedVersion) => {
  instanceStore.selectVersion(version.versionId, currentPath.value?.path)
}

const scanCurrentPath = async (force = false) => {
  if (!currentPath.value) return

  loading.value = true
  const currentPathValue = currentPath.value.path
  const isCurrent = pathScanRequests.begin()
  try {
    await instanceStore.scanPath(currentPathValue, force)
  } catch (error) {
    if (isCurrent()) console.error(t('versions.manage.scanFailed'), error)
  } finally {
    if (isCurrent()) loading.value = false
  }
}

const handleRefresh = async () => {
  const isCurrent = selectionRequests.begin()
  refreshLoading.value = true
  await scanCurrentPath(true)
  if (!isCurrent()) return
  if (currentPath.value) await instanceStore.switchPath(currentPath.value.path, { forceConfig: true })
  refreshLoading.value = false
}

const handleProfileChanged = async () => {
  await scanCurrentPath(true)
  if (detailVersion.value) {
    detailVersion.value =
      currentPathVersions.value.find((version) => version.versionId === detailVersion.value?.versionId) ?? null
  }
}

const selectPath = async (index: number) => {
  const path = gamePaths.value[index]
  if (!path) return
  selectedPathIndex.value = index
  refreshLoading.value = false
  const isCurrent = selectionRequests.begin()
  await Promise.all([scanCurrentPath(), rememberSelectedPath(path.path)])
  if (!isCurrent()) return
  // 扫描完成后，根据该路径的 ecl.json 恢复选中的实例
  await instanceStore.switchPath(path.path)
}

const addNewPath = () => {
  isEditing.value = false
  editingIndex.value = -1
  pathForm.value = { name: '', path: '' }
  pathFormError.value = ''
  showPathModal.value = true
}

const editPath = (index: number) => {
  const path = gamePaths.value[index]
  if (!path) return
  isEditing.value = true
  editingIndex.value = index
  pathForm.value = { ...path }
  pathFormError.value = ''
  showPathModal.value = true
}

const openPathFolder = async (index: number) => {
  const path = gamePaths.value[index]
  if (!path?.path) return
  try {
    await instanceInstallApi.openFolder(path.path)
  } catch (error) {
    console.error(t('versions.manage.openFolderFailed'), error)
    message.error(t('versions.manage.openFolderFailed'))
  }
}

const browseForPath = async () => {
  try {
    const result = await instanceInstallApi.selectDirectory()
    if (result?.path) {
      pathForm.value.path = result.path
      if (!pathForm.value.name) {
        pathForm.value.name = getPathNameFromPath(result.path)
      }
    }
  } catch (error) {
    console.error(t('versions.manage.selectDirFailed'), error)
  }
}

const isDefaultPath = computed(() => {
  if (!isEditing.value || editingIndex.value < 0) return false
  const path = gamePaths.value[editingIndex.value]
  return path?.protected || path?.path.includes('.minecraft') || false
})

const savePath = async () => {
  if (!pathForm.value.name || !pathForm.value.path || pathSaving.value) return

  pathSaving.value = true
  pathFormError.value = ''
  try {
    const previousPath = isEditing.value ? gamePaths.value[editingIndex.value]?.path : undefined
    const updatedPaths = [...gamePaths.value]
    if (isEditing.value && editingIndex.value >= 0) {
      updatedPaths[editingIndex.value] = { ...pathForm.value }
    } else {
      updatedPaths.push({ ...pathForm.value })
    }
    await settingsStore.patchGame({ minecraft_paths: updatedPaths })
    gamePaths.value = updatedPaths
    if (previousPath && previousPath !== pathForm.value.path) {
      instanceInstallApi.invalidateScanCache(previousPath)
      instanceInstallApi.invalidateScanCache(pathForm.value.path)
      instancePathConfigApi.invalidateActiveVersionCache(previousPath)
      instancePathConfigApi.invalidateActiveVersionCache(pathForm.value.path)
    }
    message.success(isEditing.value ? t('versions.manage.pathUpdated') : t('versions.manage.pathAdded'), 2000)
    if (!isEditing.value) {
      selectedPathIndex.value = updatedPaths.length - 1
      await Promise.all([scanCurrentPath(), rememberSelectedPath(currentPath.value?.path ?? '')])
    } else if (editingIndex.value === selectedPathIndex.value) {
      await Promise.all([scanCurrentPath(true), rememberSelectedPath(currentPath.value?.path ?? '')])
    }
    showPathModal.value = false
  } catch (error) {
    console.error(t('versions.manage.saveFailed'), error)
    pathFormError.value = t('versions.manage.saveFailed')
    message.error(t('versions.manage.saveFailed'), 3000)
  } finally {
    pathSaving.value = false
  }
}

const removePath = async (index: number) => {
  const path = gamePaths.value[index]
  if (!path) return
  if (path.protected) {
    message.warning(t('versions.manage.protectedPath'))
    return
  }

  openConfirm(t('common.confirm'), t('versions.manage.confirmDeletePath', { name: path.name }), async () => {
    const removed = gamePaths.value[index]
    if (!removed) return
    gamePaths.value.splice(index, 1)

    try {
      await settingsStore.patchGame({ minecraft_paths: [...gamePaths.value] })
    } catch {
      gamePaths.value.splice(index, 0, removed)
      return
    }

    instanceStore.removePath(removed.path)

    if (index === selectedPathIndex.value) {
      selectedPathIndex.value = Math.min(index, gamePaths.value.length - 1)
      await Promise.all([scanCurrentPath(), rememberSelectedPath(currentPath.value?.path ?? '')])
    } else if (index < selectedPathIndex.value) {
      selectedPathIndex.value--
    }

    message.success(t('versions.manage.pathRemoved', { name: removed.name }))
  })
}

const { show: showLaunchProgress, hide: hideLaunchProgress, setProgress: setLaunchProgress } = globalLaunchProgress

/** 启动成功后写入"最近启动"列表，启动失败/取消不记录 */
function recordRecentLaunch(version: ScannedVersion) {
  useRecentInstances().recordLaunch(version.versionId, instanceDisplayName(version), currentPath.value?.path || '')
}

let launchInFlight = false

const handleLaunch = async (version: ScannedVersion) => {
  if (!currentPath.value) return
  // 防重入：双击或连点会并发发起两次 game_launch 并叠加多份进度监听
  if (launchInFlight) return
  launchInFlight = true

  // 先跳转到页面
  router.push({ name: 'game' })

  showLaunchProgress({ cancelable: true })

  // 监听启动进度事件
  const unlisten = backend.on('game:launch_progress', (payload: LaunchProgress) => {
    // 已取消则忽略后续事件
    if (globalLaunchProgress.progress.value.canceled) {
      unlisten()
      return
    }

    const phase = payload?.phase || ''
    const msg = payload?.message || ''
    const pct = payload?.percent

    if (phase === 'launched') {
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
      setLaunchProgress(typeof pct === 'number' ? pct : LAUNCH_PROGRESS.authlib_token!, 'validating_authlib_token', msg)
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

  // 等待进度监听完成注册，让动画从第一个实际后端阶段开始，而不是事后补跑。
  await backend.waitForEventListeners()

  try {
    setLaunchProgress(0, 'prepare', `正在准备启动 ${version.versionId}...`)

    const launchResult = await backend.command('game_launch', {
      version_id: version.versionId,
      game_path: currentPath.value.path,
    })

    if (!launchResult.success) {
      if (!globalLaunchProgress.progress.value.canceled) {
        setLaunchProgress(0, 'error', launchResult.message || '启动失败')
        notifyLauncherPopup({
          id: `manage-launch-failed-${version.versionId}`,
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
      setLaunchProgress(100, 'launched', ` ${version.versionId} 已启动`)
      message.success(` ${version.versionId} 已启动`)
      recordRecentLaunch(version)
    }
    setTimeout(hideLaunchProgress, LAUNCH_SUCCESS_HIDE_DELAY)
  } catch (e) {
    console.error('启动失败:', e)
    if (!globalLaunchProgress.progress.value.canceled) {
      const reason = getErrorMessage(e, '启动失败')
      setLaunchProgress(0, 'error', reason)
      notifyLauncherPopup({
        id: `manage-launch-failed-${version.versionId}`,
        title: '游戏启动失败',
        content: reason,
        level: 'critical',
        priority: 80,
      })
    }
    setTimeout(hideLaunchProgress, 2000)
  } finally {
    unlisten()
    launchInFlight = false
  }
}

const handleOpenDetail = (version: ScannedVersion, initialTab: DetailTab = 'overview') => {
  detailVersion.value = version
  detailInitialTab.value = initialTab
  showDetailModal.value = true
}

function openRequestedVersionSettings() {
  if (route.query.tab !== 'settings' || typeof route.query.version !== 'string') return
  const requestedVersion = currentPathVersions.value.find(
    (version) => version.versionId === route.query.version || version.id === route.query.version
  )
  if (requestedVersion) handleOpenDetail(requestedVersion, 'settings')
}

const handleDetailLaunch = (version: ScannedVersion) => {
  handleLaunch(version)
}

const handleDetailDelete = (version: ScannedVersion) => {
  handleDelete(version)
}

const handleDelete = async (version: ScannedVersion) => {
  if (!currentPath.value) return
  openConfirm(t('common.confirm'), t('versions.manage.confirmDeleteVersion', { name: version.versionId }), async () => {
    try {
      await instanceWorkspaceApi.deleteInstance(workspaceTarget(version))
      message.success(t('versions.manage.versionDeleted', { name: version.versionId }))
      await scanCurrentPath(true)
    } catch (e) {
      console.error('删除失败:', e)
      message.error(t('versions.manage.deleteFailed'))
    }
  })
}

async function handleInstanceAction(action: string, version: ScannedVersion) {
  if (action === 'launch') return handleLaunch(version)
  if (
    [
      'overview',
      'mods',
      'resourcepacks',
      'shaderpacks',
      'datapacks',
      'schematics',
      'worlds',
      'screenshots',
      'servers',
    ].includes(action)
  ) {
    return handleOpenDetail(version, action as DetailTab)
  }
  if (action.startsWith('folder-')) {
    await instanceWorkspaceApi.folders(
      workspaceTarget(version),
      action.slice(7) as 'instance' | 'mods' | 'saves' | 'screenshots' | 'logs' | 'crash-reports'
    )
    return
  }
  if (action === 'delete') return handleDelete(version)
  if (action === 'repair') {
    const report = (await instanceWorkspaceApi.checkFiles(workspaceTarget(version))) as {
      issues: unknown[]
      downloadBytes: number
      canRepair: boolean
    }
    if (!report.issues.length) return message.success('实例文件完整')
    openConfirm(
      '补全实例文件',
      `发现 ${report.issues.length} 个问题，预计下载 ${Math.ceil(report.downloadBytes / 1024 / 1024)} MiB。确认开始补全？`,
      async () => {
        await instanceWorkspaceApi.repairFiles(workspaceTarget(version))
        message.success('文件补全任务已创建')
      }
    )
    return
  }
  if (action === 'clone') {
    const newId = `${version.versionId}-copy`
    openConfirm('复制实例', `将实例复制为 ${newId}。复制后会重置收藏、隐藏、置顶和运行统计。`, async () => {
      const response = await backend.command('game_instance_clone', {
        ...workspaceTarget(version),
        new_version_id: newId,
      })
      if (!response.success) throw new Error(response.message)
      message.success('实例复制任务已创建')
    })
    return
  }
  if (action === 'export') {
    const selected = await backend.command('select_save_file', { purpose: 'instance-export' })
    if (!selected.success || !selected.data?.path) return
    const response = await backend.command('game_instance_export', {
      ...workspaceTarget(version),
      output_path: selected.data.path,
      pack_format: 'modrinth',
    })
    if (!response.success) throw new Error(response.message)
    message.success('实例导出任务已创建')
    return
  }
}

// ── 版本安装 ──

function navigateToInstall() {
  router.push({ name: 'download', query: { tab: 'instances' } })
}
</script>

<style scoped src="@/styles/views/instances/ManageTab.css"></style>
