/* eslint-disable @typescript-eslint/no-unused-vars -- 供 import.meta.env 消费的全局环境类型声明 */
/// <reference lib="dom" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
}

interface TauriCore {
  pytaurix: {
    pyInvoke: (command: string, payload?: unknown) => Promise<unknown>
  }
  /** 注册事件监听，返回 Promise<unlisten 函数> */
  listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>
  /** 将本地文件路径转换为 asset protocol URL */
  convertFileSrc: (path: string) => string
  window?: {
    minimize: () => Promise<void>
    close: () => Promise<void>
    setPosition: (x: number, y: number) => Promise<void>
  }
}

declare global {
  interface Window {
    __TAURI__?: TauriCore
    /** 工具箱等宿主注入的 Dev Channel 连接信息，嵌入前端据此建立 WebSocket 传输层 */
    __ECL_DEV_WS__?: { port: number; token: string; url?: string }
  }
}

export {}
