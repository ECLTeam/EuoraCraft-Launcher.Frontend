import { readonly } from 'vue'
import { queryClient } from '@/app/queryClient'
import { createShowcaseTransport } from '../transport/showcase'
import { isShowcaseRuntime, replaceTransport, runtimeMode, showcaseActive, transport } from './state'

function swapToShowcase(): void {
  queryClient.clear()
  const showcase = createShowcaseTransport()
  // 保持 desktop 模式，确保窗口控制按钮正常显示
  replaceTransport({ ...showcase, mode: 'desktop' })
  showcaseActive.value = true
  runtimeMode.value = transport.mode
}

export function createRuntime() {
  return {
    runtime: {
      get mode() {
        return runtimeMode.value
      },
      get isAvailable() {
        return transport.available
      },
      get isDesktop() {
        return transport.mode === 'desktop'
      },
      get isShowcase() {
        return isShowcaseRuntime.value
      },
      /** 供 Vue 组件订阅的运行模式状态。 */
      modeState: readonly(runtimeMode),
      /** 供 Vue 组件订阅的展示模式状态。 */
      isShowcaseState: readonly(isShowcaseRuntime),
    },
    swapToShowcase,
    get isShowcaseActive() {
      return showcaseActive.value
    },
  }
}
