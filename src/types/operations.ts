/** 应用后台操作；IPC 保留原有 game 命令和事件名称。 */
export interface ApplicationOperation {
  operationId: string
  kind?: string
  name?: string
  path?: string
  done?: number
  total?: number
  speed?: number
  progressType?: 'bytes' | 'files'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  percent?: number
  message?: string
  result?: unknown
  error?: string | null
  errorCode?: string | null
  canCancel?: boolean
  cancellationRequested?: boolean
  revision?: number
}

export function isFinishedOperation(operation: ApplicationOperation): boolean {
  return ['completed', 'failed', 'cancelled'].includes(operation.status)
}
