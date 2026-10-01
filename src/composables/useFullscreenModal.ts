import { computed } from 'vue'
import { GLOBAL_MODAL_PRIORITY, useGlobalModalStack } from './useGlobalModalStack'

/**
 * 全屏模态框兼容接口。
 *
 * 全屏窗口的状态已纳入全局模态框栈；该接口保留标题栏和既有业务组件所需的
 * open/unregister/close 语义，避免各调用点继续维护第二套栈。
 */
export function useFullscreenModal() {
  const globalModalStack = useGlobalModalStack()
  const isVisible = computed(() => globalModalStack.isFullscreenActive.value)
  const title = computed(() => globalModalStack.activeTitle.value)
  const currentId = computed(() => globalModalStack.currentFullscreenId.value)
  const canClose = computed(
    () => currentId.value !== null && globalModalStack.interactiveModalId.value === currentId.value
  )

  const open = (id: string, modalTitle: string, onClose?: () => void, lockScroll = true) => {
    globalModalStack.register({
      id,
      title: modalTitle,
      priority: GLOBAL_MODAL_PRIORITY.interactive,
      isFullscreen: true,
      onRequestClose: onClose,
      lockScroll,
    })
  }

  const unregister = (id: string) => {
    globalModalStack.unregisterFullscreen(id)
  }

  const close = () => {
    if (!canClose.value) return
    globalModalStack.closeActive()
  }

  const reset = () => {
    globalModalStack.resetFullscreen()
  }

  return {
    isVisible,
    title,
    currentId,
    canClose,
    open,
    unregister,
    close,
    reset,
  }
}
