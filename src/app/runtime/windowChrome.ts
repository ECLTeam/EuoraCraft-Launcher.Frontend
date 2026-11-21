import { readonly, ref } from 'vue'
import { launcherInfoQuery } from '@/app/data'
import { desktopWindow } from './desktopWindow'

export type ActiveWindowChrome = 'custom' | 'system_shadow' | 'native'

const activeWindowChrome = ref<ActiveWindowChrome>('custom')
const systemShadowSupported = ref(false)

/** 在首次渲染前读取主窗口的实际装饰和启动快照，避免待重启设置提前改变当前布局。 */
export async function detectActiveWindowChrome(): Promise<void> {
  let isDecorated = false
  try {
    isDecorated = await desktopWindow.isDecorated()
  } catch {
    // 宿主窗口 API 不可用时仍尝试读取启动快照。
  }
  const info = await launcherInfoQuery().catch(() => null)
  systemShadowSupported.value = info?.system_shadow_supported === true
  activeWindowChrome.value = isDecorated
    ? 'native'
    : info?.active_window_chrome === 'system_shadow'
      ? 'system_shadow'
      : 'custom'
  document.getElementById('app')?.setAttribute('data-window-chrome', activeWindowChrome.value)
}

export function useActiveWindowChrome() {
  return readonly(activeWindowChrome)
}

export function useSystemShadowSupported() {
  return readonly(systemShadowSupported)
}
