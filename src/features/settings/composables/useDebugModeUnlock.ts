import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebugMode } from '@/composables/useDebugMode'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import type { MessageReactive } from 'naive-ui'

/** 连续点击启动器图标开启调试模式所需的次数 */
const unlockClickCount = 7
/** 相邻两次点击的最大间隔，超时后重新计数，避免零散点击被累计 */
const clickResetDelay = 1500
/** 从第几次点击开始提示剩余次数：前两次静默，减少误触造成的打扰 */
const hintStartClick = 3

/**
 * 处理「连续点击关于页启动器图标开启调试模式」的计数与提示。
 *
 * 计数只在内存中保留，离开页面或超时即清零，不写入任何配置；
 * 达到次数后通过设置 store 打开 ``launcher.debug``，由后端持久化。
 */
export function useDebugModeUnlock() {
  const { t } = useI18n()
  const message = useLauncherMessage()
  const { setDebugMode } = useDebugMode()

  const clickCount = ref(0)
  let resetTimer: ReturnType<typeof setTimeout> | null = null
  let hintMessage: MessageReactive | null = null
  let isUnlocking = false

  function clearResetTimer(): void {
    if (!resetTimer) return
    clearTimeout(resetTimer)
    resetTimer = null
  }

  function dismissHint(): void {
    hintMessage?.destroy()
    hintMessage = null
  }

  function resetClicks(): void {
    clearResetTimer()
    clickCount.value = 0
  }

  function showRemainingHint(remaining: number): void {
    // 同一时刻只保留一条提示，避免连点时堆叠多条通知。
    dismissHint()
    hintMessage = message.info(t('settings.aboutTab.debugInfo.hintRemaining', { count: remaining }), {
      duration: 2500,
    })
  }

  async function enableDebugMode(): Promise<boolean> {
    isUnlocking = true
    resetClicks()
    dismissHint()
    const title = t('settings.aboutTab.debugInfo.title')
    try {
      await setDebugMode(true)
      message.success(t('settings.aboutTab.debugInfo.unlocked'), { title, duration: 5000 })
      return true
    } catch {
      message.error(t('settings.aboutTab.debugInfo.unlockFailed'), { title, duration: 6000 })
      return false
    } finally {
      isUnlocking = false
    }
  }

  /**
   * 记录一次图标点击。
   *
   * :return: 本次点击是否成功开启了调试模式，调用方据此打开调试信息弹窗
   */
  async function registerClick(): Promise<boolean> {
    if (isUnlocking) return false

    clickCount.value += 1
    clearResetTimer()
    resetTimer = setTimeout(resetClicks, clickResetDelay)

    const remaining = unlockClickCount - clickCount.value
    if (remaining > 0) {
      if (clickCount.value >= hintStartClick) showRemainingHint(remaining)
      return false
    }
    return enableDebugMode()
  }

  onBeforeUnmount(() => {
    resetClicks()
    dismissHint()
  })

  return { registerClick }
}
