<template>
  <div
    class="launcher-app"
    :data-window-chrome="activeWindowChrome"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleGlobalDrop"
  >
    <!-- 背景层 -->
    <AppBackground />
    <div class="aurora-bg" aria-hidden="true"></div>
    <div class="app-background-overlay"></div>

    <!-- 主布局 -->
    <!--<a href="#main-content" class="skip-link">跳到主要内容</a>-->
    <div class="app-layout">
      <!-- 顶部栏 - 始终可交互 -->
      <TitleBar
        class="app-titlebar"
        :class="{ 'titlebar-disabled': !isAgreementAccepted && !agreementLoading }"
        :nativeChrome="activeWindowChrome === 'native'"
      />

      <!-- 主体区域：侧边栏 + 内容区 -->
      <div class="app-body" :class="{ 'app-body-disabled': !isAgreementAccepted && !agreementLoading }">
        <SideBar />

        <!-- 插件：侧栏扩展插槽 -->
        <PluginSlotHost slotId="plugin-slot-sidebar-extra" class="plugin-slot-container plugin-sidebar-slot" />

        <!-- 内容区 - 全屏弹窗仅覆盖此区域 -->
        <main
          id="main-content"
          data-theme-component="page-canvas"
          data-theme-node="shell.main-content"
          class="main-content"
          :class="{
            'content-disabled': !isAgreementAccepted && !agreementLoading,
            'content-managed-scroll': route.path.startsWith('/settings') || route.path.startsWith('/more'),
          }"
          tabindex="-1"
        >
          <!-- 插件：内容区顶部插槽 -->
          <PluginSlotHost slotId="plugin-slot-content-top" class="plugin-slot-container" />
          <div v-if="isAgreementAccepted" class="page-container">
            <RouterView v-slot="{ Component, route: currentRoute }">
              <Transition name="page" mode="out-in">
                <component :is="Component" :key="currentRoute.matched[0]?.path || currentRoute.path" />
              </Transition>
            </RouterView>
            <!-- 插件：页面底部插槽 -->
            <PluginSlotHost slotId="plugin-slot-page-bottom" class="plugin-slot-container" />
          </div>

          <!-- 未同意协议时的占位提示
                  <div v-else class="agreement-placeholder">
                    <UiIcon name="info" />
                    <p>{{ t('agreement.pleaseAccept') }}</p>
                  </div-->

          <!-- 插件：内容区底部插槽 -->
          <PluginSlotHost slotId="plugin-slot-content-bottom" class="plugin-slot-container" />

          <!-- 任务队列全屏面板 -->
          <TaskQueuePanel />

          <!-- 启动器日志悬浮窗（调试界面开关控制，默认隐藏） -->
          <FloatingLauncherLog />

          <!-- 退出确认弹窗 -->
          <ConfirmDialog
            v-model:visible="showQuitConfirmModal"
            :title="t('common.confirm')"
            :content="t('agreement.quitConfirm')"
            :priority="100"
            danger
            @confirm="handleQuitConfirm"
          />

          <!-- 整合包导入对话框（实例详情按钮 / 全局文件拖放触发） -->
          <ModpackImportModal />

          <!-- 全局错误弹窗 -->
          <ErrorModal
            :visible="showErrorModal"
            :title="errorTitle"
            :message="errorMessage"
            :detail="errorDetail"
            :errorId="errorId"
            :kind="errorKind"
            :crash="crashAnalysis"
            @update:visible="handleErrorModalVisibility"
          />

          <!-- 后端主动推送的全局弹窗 -->
          <LauncherPopupModal :visible="popupVisible" :popup="activePopup" @dismiss="dismissActivePopup" />

          <!-- 启动时发现更新后显示；设置页手动检查也复用同一实例。 -->
          <UpdateResultModal v-model:visible="updateDialogVisible" @close="rememberCurrentUpdate" />

          <!-- 用户协议弹窗 -->
          <Modal
            :visible="showAgreementModal"
            type="agreement"
            :priority="95"
            :title="t('agreement.title')"
            :closable="false"
            :showCloseBtn="false"
            :showFooter="true"
            bodyClass="agreement-modal-body"
            @confirm="handleAgreementAccept"
            @cancel="handleAgreementReject"
          >
            <div class="agreement-content agreement-simple">
              <div class="agreement-icon">
                <UiIcon name="file-text" />
              </div>
              <h2>{{ t('agreement.pleaseRead') }}</h2>
              <p class="agreement-desc">
                {{ t('agreement.description') }}
              </p>
              <a href="#" class="agreement-link-btn" @click.prevent="openExternalUrl(agreementUrl)">
                <UiIcon name="external-link" />
                {{ t('agreement.viewFull') }}
              </a>
            </div>
          </Modal>
        </main>
      </div>
    </div>

    <!-- 全局文件拖放反馈层 -->
    <Transition name="drop-fade">
      <div v-if="dragging" class="global-drop-overlay" aria-hidden="true">
        <div class="global-drop-overlay__box">
          <UiIcon name="archive" :size="42" />
          <span>{{ t('modpackImport.dropHint') }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, onUnmounted, provide, readonly, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { loadShowcaseTasks } from '@/api/transport/showcase/fixtures'
import { desktopWindow } from '@/app/runtime/desktopWindow'
import { setErrorNotifier } from '@/app/runtime/errorPresentation'
import { useAppRuntime } from '@/app/runtime/useAppRuntime'
import { notifyLauncherPopup } from '@/app/runtime/useLauncherPopupQueue'
import { useActiveWindowChrome } from '@/app/runtime/windowChrome'
import ModpackImportModal from '@/components/instances/ModpackImportModal.vue'
import AppBackground from '@/components/layout/AppBackground.vue'
import SideBar from '@/components/layout/SideBar.vue'
import TitleBar from '@/components/layout/TitleBar.vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import ErrorModal from '@/components/modals/ErrorModal.vue'
import LauncherPopupModal from '@/components/modals/LauncherPopupModal.vue'
import Modal from '@/components/modals/Modal.vue'
import TaskQueuePanel from '@/components/panels/TaskQueuePanel.vue'
import { useFullscreenModal } from '@/composables/useFullscreenModal'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import { useUserAgreement } from '@/composables/useUserAgreement'
import { useModpackImportStore, extractPackPath } from '@/features/instances/stores/modpackImportStore'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import UpdateResultModal from '@/features/settings/components/UpdateResultModal.vue'
import { useUpdateCheck } from '@/features/settings/composables/useUpdateCheck'
import { rememberShownUpdate } from '@/features/settings/model/updateNotice'
import FloatingLauncherLog from '@/features/terminal/components/FloatingLauncherLog.vue'
import { getErrorMessage } from '@/utils/error'
import { openExternalUrl } from '@/utils/openExternal'

const router = useRouter()
const activeWindowChrome = useActiveWindowChrome()
const route = useRoute()
const { t } = useI18n()
const {
  isAccepted: isAgreementAccepted,
  isLoading: agreementLoading,
  agreementUrl,
  markNotAccepted,
  acceptUserAgreement,
} = useUserAgreement()
const fullscreenModal = useFullscreenModal()
const message = useLauncherMessage()
const modpackImport = useModpackImportStore()
const { lastResult, updateDialogVisible } = useUpdateCheck()

function rememberCurrentUpdate(): void {
  rememberShownUpdate(lastResult.value)
}

// ── 全局文件拖放：识别整合包文件并打开导入对话框（未被子面板拦截时）──
const dragging = ref(false)
let dragDepth = 0
let lastDropAt = 0
const PACK_EXT_RE = /\.(zip|mrpack)$/i
const NATIVE_DRAG_EVENTS = [
  'tauri://drag-enter',
  'tauri://drag-over',
  'tauri://drag-drop',
  'tauri://drag-leave',
] as const
type NativeDragKind = 'enter' | 'over' | 'drop' | 'leave'
const nativeDragUnlisten: Array<() => void> = []

function hasFileTypes(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

// 拖到子面板（模组/存档等自带拖放区）上方时不显示全局反馈层，避免与面板自身覆盖层叠加
function overDropZone(event: DragEvent): boolean {
  const target = event.target
  return target instanceof Element && Boolean(target.closest('[data-drop-zone]'))
}

function handleDragEnter(event: DragEvent) {
  if (!hasFileTypes(event) || overDropZone(event)) return
  dragDepth += 1
  dragging.value = true
}

function handleDragOver(event: DragEvent) {
  if (!hasFileTypes(event)) return
  event.preventDefault()
  if (!overDropZone(event)) dragging.value = true
}

function handleDragLeave() {
  dragDepth -= 1
  if (dragDepth <= 0) {
    dragDepth = 0
    dragging.value = false
  }
}

function openPackImport(path: string) {
  const now = Date.now()
  if (now - lastDropAt < 1000) return
  lastDropAt = now
  void modpackImport.open({ sourcePath: path })
}

function handleGlobalDrop(event: DragEvent) {
  dragDepth = 0
  dragging.value = false
  // 内层面板的 @drop.prevent 已处理时，defaultPrevented 为 true，此处直接跳过
  if (event.defaultPrevented) return
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return
  event.preventDefault()
  const pack = extractPackPath(files)
  if (!pack) return
  openPackImport(pack)
}

function applyNativeDrag(kind: NativeDragKind, paths: string[]) {
  if (kind === 'enter' || kind === 'over') {
    dragging.value = true
  } else if (kind === 'leave') {
    dragging.value = false
  } else if (kind === 'drop') {
    dragging.value = false
    const pack = paths.find((path) => PACK_EXT_RE.test(path))
    if (pack) openPackImport(pack)
  }
}

function decodeDragPayload(payload: unknown): { paths?: string[] } {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as { paths?: string[] }
    } catch {
      return {}
    }
  }
  return (payload ?? {}) as { paths?: string[] }
}

// Tauri 原生拖放事件走事件系统（listen）分发；DOM CustomEvent 仅作部分平台兜底。
// Windows WebView2 下 HTML5 dataTransfer.files 被 Tauri 拦截，原生事件是唯一可靠路径。
function handleNativeDragEvent(event: Event) {
  const kind = event.type.replace('tauri://drag-', '') as NativeDragKind
  const detail = (event as CustomEvent<{ paths?: string[] }>).detail ?? {}
  applyNativeDrag(kind, detail.paths ?? [])
}

interface TauriDragListener {
  listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>
}

onMounted(async () => {
  NATIVE_DRAG_EVENTS.forEach((name) => window.addEventListener(name, handleNativeDragEvent))
  const tauri = (window as unknown as { __TAURI__?: { event?: TauriDragListener } }).__TAURI__
  if (tauri?.event) {
    for (const name of NATIVE_DRAG_EVENTS) {
      try {
        const unlisten = await tauri.event.listen(name, (event) => {
          applyNativeDrag(
            name.replace('tauri://drag-', '') as NativeDragKind,
            decodeDragPayload(event.payload).paths ?? []
          )
        })
        if (typeof unlisten === 'function') nativeDragUnlisten.push(unlisten)
      } catch {
        /* 事件系统未就绪时仅保留 DOM 通道 */
      }
    }
  }
})
onBeforeUnmount(() => {
  NATIVE_DRAG_EVENTS.forEach((name) => window.removeEventListener(name, handleNativeDragEvent))
  nativeDragUnlisten.forEach((dispose) => {
    try {
      dispose()
    } catch {
      /* 忽略清理错误 */
    }
  })
})

// 让 unwrapResponse 的 message 级失败统一走顶部通知，避免调用方遗漏导致用户无感知
setErrorNotifier((msg) => message.errorRaw(msg))

const showAgreementModal = ref(false)
const showQuitConfirmModal = ref(false)

const appRuntime = useAppRuntime({
  router,
  t: (key) => t(key),
  message,
  markAgreementNotAccepted: markNotAccepted,
  showAgreementModal,
})

const {
  showErrorModal,
  errorTitle,
  errorMessage,
  errorDetail,
  errorId,
  errorKind,
  crashAnalysis,
  dismissActiveError,
  activePopup,
  popupVisible,
  dismissActivePopup,
} = appRuntime

provide('devMode', appRuntime.isDevMode)
provide('launcherVersion', appRuntime.launcherVersion)
provide('launcherVersionType', appRuntime.launcherVersionType)
provide('gameConfig', appRuntime.gameConfig)
provide('downloadConfig', appRuntime.downloadConfig)
provide('runtimeMode', appRuntime.runtimeMode)

provide('agreementAccepted', readonly(isAgreementAccepted))

const handleAgreementAccept = async () => {
  const success = await acceptUserAgreement()
  if (success) {
    showAgreementModal.value = false
    fullscreenModal.reset()
  }
}

const handleAgreementReject = () => {
  showQuitConfirmModal.value = true
}

const handleQuitConfirm = async () => {
  showQuitConfirmModal.value = false
  await desktopWindow.close()
}

const handleErrorModalVisibility = (visible: boolean) => {
  if (!visible) dismissActiveError()
}

onMounted(async () => {
  fullscreenModal.reset()
  try {
    await appRuntime.start()
  } catch (error) {
    console.error('[App] 应用运行层初始化失败:', error)
    notifyLauncherPopup({
      id: 'app-init-failed',
      title: '应用初始化失败',
      content: getErrorMessage(error, '应用初始化失败，请查看日志排查后重启启动器。'),
      level: 'critical',
      priority: 90,
    })
  }

  // 演示模式下加载示例任务数据
  if (appRuntime.isShowcaseMode.value) {
    loadShowcaseTasks(globalTaskQueue)
    startShowcaseSpeedSimulation()
  }
})

/** 演示模式：让运行中的下载任务速度随机波动，便于查看实时网速曲线 */
let showcaseSpeedTimer: ReturnType<typeof setInterval> | null = null
function startShowcaseSpeedSimulation(): void {
  const randomSpeed = () => (2 + Math.random() * 9) * 1024 * 1024
  showcaseSpeedTimer = setInterval(() => {
    const task = globalTaskQueue.tasks.value.find((t) => t.status === 'running')
    if (task) {
      globalTaskQueue.updateTask(task.id, { speedBytesPerSecond: randomSpeed() })
    }
  }, 800)
}

onUnmounted(() => {
  if (showcaseSpeedTimer) {
    clearInterval(showcaseSpeedTimer)
    showcaseSpeedTimer = null
  }
  appRuntime.stop()
})
</script>

<style src="@/styles/app.css"></style>
<style scoped src="@/styles/AppScoped.css"></style>
