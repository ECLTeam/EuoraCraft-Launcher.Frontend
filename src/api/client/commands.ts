import { launcherErrorQueue } from '@/app/runtime/errorPresentation'
import type { ApiResponse, CommandPayloadMap, CommandResponseMap } from '@/types/api'
import { getErrorMessage } from '@/utils/error'
import { Logger, SILENT_COMMANDS, checkEnv, transport } from './state'

type CommandResponseObserver = (command: string, payload: unknown, response: ApiResponse<unknown>) => void
const responseObservers = new Set<CommandResponseObserver>()

/** 应用宿主观察已提交操作；订阅者错误不得改变原 IPC 结果。 */
export function onCommandResponse(observer: CommandResponseObserver): () => void {
  responseObservers.add(observer)
  return () => responseObservers.delete(observer)
}

/**
 * 为 IPC 调用附加超时，超时后拒绝并提示用户检查网络。
 * @param promise - 原始调用 Promise
 * @param timeoutMs - 超时毫秒数，不传则不限制
 * @returns 原始 Promise 或超时拒绝的 Promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`操作超时（${Math.round(timeoutMs / 1000)} 秒），请检查网络后重试`)),
      timeoutMs
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * 统一调用后端方法并包装为 ApiResponse。
 * @param command - 独立的后端命令名
 * @param payload - 命令参数对象
 * @param timeoutMs - 可选超时毫秒数，超时后按失败处理
 * @returns 包含 success/data/message 的标准响应
 */
async function call<T = unknown>(command: string, payload: unknown = {}, timeoutMs?: number): Promise<ApiResponse<T>> {
  const start = performance.now()
  try {
    if (!checkEnv()) throw new Error('PyTauri 环境未就绪')
    const raw = await withTimeout(transport.invoke(command, payload), timeoutMs)
    const dur = (performance.now() - start).toFixed(1)
    if (!raw || typeof raw !== 'object') {
      return { success: false, message: '后端返回了非对象响应', timestamp: Date.now() }
    }
    const response = raw as ApiResponse<T>
    if (!response.success && !response.message?.trim()) {
      const code = response.errorCode ? ` (${response.errorCode})` : ''
      response.message = `${command} 执行失败${code}`
    }
    if (!response.success && response.presentation === 'modal' && response.errorId) {
      launcherErrorQueue.enqueue({
        error_id: response.errorId,
        title: response.title || '启动器发生错误',
        message: response.message || `${command} 执行失败`,
        detail: response.detail,
      })
    }
    // 高频轮询命令跳过成功日志，仅在失败时打印
    if (!SILENT_COMMANDS.has(command) || !response.success) {
      Logger.log(`${response.success ? 'OK' : 'ERR'} ${command} (${dur}ms)`)
    }
    for (const observer of responseObservers) {
      try {
        observer(command, payload, response)
      } catch (error) {
        console.warn('同步操作状态失败', error)
      }
    }
    return response
  } catch (e) {
    Logger.error(`${command}:`, e)
    return { success: false, message: getErrorMessage(e), timestamp: Date.now() }
  }
}

export function createCommand() {
  return function command<K extends keyof CommandPayloadMap>(
    name: K,
    params?: CommandPayloadMap[K],
    timeoutMs?: number
  ): Promise<ApiResponse<CommandResponseMap[K]>> {
    return call(String(name), params ?? {}, timeoutMs)
  }
}

export { call, withTimeout }
