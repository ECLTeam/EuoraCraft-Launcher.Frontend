import { inject, provide, type InjectionKey } from 'vue'
import type { useConnector } from '@/features/connect/composables/useConnector'

export type ConnectorContext = ReturnType<typeof useConnector>

const connectorKey: InjectionKey<ConnectorContext> = Symbol('connect-connector')

/** 更多外壳下发应用唯一会话，查询和释放由联机页与应用宿主分别负责。 */
export function provideConnector(context: ConnectorContext): void {
  provide(connectorKey, context)
}

/** 供联机子页读取外壳提供的连接状态；工具子页刻意不调用，以保持与联机流程解耦。 */
export function useConnectorContext(): ConnectorContext {
  const context = inject(connectorKey)
  if (!context) throw new Error('useConnectorContext 只能在联机页外壳的子页中使用')
  return context
}
