import { computed, ref } from 'vue'
import type { AppRuntimeMode } from '@/app/runtime/mode'
import { createBackendTransport } from '../transport'
import type { createShowcaseTransport } from '../transport/showcase'

export const CONFIG = {
  DEBUG: import.meta.env.DEV,
} as const

/** 高频轮询命令：不打印 [API] 成功日志，避免开发控制台刷屏 */
export const SILENT_COMMANDS = new Set(['launcher_errors_pending', 'accounts_poll_littleskin_login'])

export class Logger {
  static log(...args: unknown[]) {
    if (CONFIG.DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[API]', ...args)
    }
  }
  static error(...args: unknown[]) {
    console.error('[API Error]', ...args)
  }
}

export let transport = createBackendTransport()

export function replaceTransport(next: typeof transport): void {
  transport = next
}

export const showcaseActive = ref(false)
export const runtimeMode = ref<AppRuntimeMode>(transport.mode)
export const isShowcaseRuntime = computed(() => showcaseActive.value || runtimeMode.value === 'showcase')

export function checkEnv(): boolean {
  return transport.available
}

export type ShowcaseTransport = ReturnType<typeof createShowcaseTransport>
