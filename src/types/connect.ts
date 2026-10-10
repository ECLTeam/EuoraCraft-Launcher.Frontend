/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export type ConnectorMode = 'idle' | 'starting' | 'host' | 'guest'

export interface ConnectorPlayer {
  name: string
  vendor: string
  iconBase64: string | null
  kind: 'host' | 'guest'
  machineId: string
}

export interface ConnectorGameInfo {
  gameVersion: string
  loader: string | null
  loaderVersion: string | null
}

export interface ConnectorStatus {
  mode: ConnectorMode
  roomCode: string | null
  mcHost: string | null
  mcPort: number | null
  gameInfo: ConnectorGameInfo | null
  players: ConnectorPlayer[]
  nodes: string[]
  error: string | null
}

export interface NatTypeResult {
  type: 'cone' | 'symmetric' | 'blocked' | 'unknown'
  detailType:
    | 'openInternet'
    | 'noPat'
    | 'fullCone'
    | 'restricted'
    | 'portRestricted'
    | 'symmetricEasy'
    | 'symmetric'
    | 'symmetricFirewall'
    | 'udpBlocked'
    | 'unknown'
  publicIp: string | null
  publicPort: number | null
  publicPortEnd: number | null
  supportsIpv6: boolean
}
