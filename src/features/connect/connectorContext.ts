import { inject, provide, type InjectionKey } from 'vue'
import type { useConnector } from '@/features/connect/composables/useConnector'

export type ConnectorContext = ReturnType<typeof useConnector>

const connectorKey: InjectionKey<ConnectorContext> = Symbol('connect-connector')

/**
 * 由联机页外壳调用一次，把连接状态与轮询下发给子页。
 *
 * 状态必须由外壳持有：子页切换时外壳不重挂，轮询定时器与房间状态才能跨子页延续，
 * 否则每次切回联机子页都会重新初始化并丢失实时状态。
 */
export function provideConnector(context: ConnectorContext): void {
  provide(connectorKey, context)
}

/** 供联机子页读取外壳提供的连接状态；工具子页刻意不调用，以保持与联机流程解耦。 */
export function useConnectorContext(): ConnectorContext {
  const context = inject(connectorKey)
  if (!context) throw new Error('useConnectorContext 只能在联机页外壳的子页中使用')
  return context
}
