import type { BackendTransport } from './types'

interface TauriGlobal {
  pytaurix: {
    pyInvoke: (command: string, payload?: unknown) => Promise<unknown>
  }
  event: {
    listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>
  }
  core?: {
    convertFileSrc?: (path: string) => string
  }
}

function getTauri(): TauriGlobal | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__
}

function decodeEventPayload<T>(payload: T | string): T {
  if (typeof payload !== 'string') return payload
  try {
    return JSON.parse(payload) as T
  } catch {
    return payload as T
  }
}

export function createTauriTransport(): BackendTransport {
  return {
    mode: 'desktop',
    // 实时求值：pytaurix 全局注入可能晚于前端 bundle 执行，快照会把启动器永久锁在"不可用"状态
    get available() {
      return !!getTauri()?.pytaurix
    },
    async invoke(command, payload) {
      const tauri = getTauri()
      if (!tauri?.pytaurix) throw new Error('PytaruiX 运行环境未就绪')
      return tauri.pytaurix.pyInvoke(command, payload)
    },
    async listen<T>(event: string, handler: (payload: T) => void) {
      const tauri = getTauri()
      if (!tauri?.event) throw new Error('Tauri 事件系统未就绪')
      return tauri.event.listen<T | string>(event, ({ payload }) => handler(decodeEventPayload<T>(payload)))
    },
    convertFileSrc(path) {
      try {
        return getTauri()?.core?.convertFileSrc?.(path) ?? null
      } catch {
        return null
      }
    },
  }
}
