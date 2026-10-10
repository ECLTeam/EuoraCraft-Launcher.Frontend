import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { COMMAND_NAMES } from '@/types/api'
import type { ConnectorStatus, NatTypeResult } from '@/types/connect'
import type { InstanceTargetPayload } from '@/types/instances'

export const connectorApi = {
  status(): Promise<ConnectorStatus> {
    return backend
      .command(COMMAND_NAMES.connector_status, undefined, 5000)
      .then((response) => unwrapResponse(response, '读取联机状态'))
  },

  hostPort(port: number): Promise<{ roomCode: string }> {
    return backend
      .command(COMMAND_NAMES.connector_host_port, { port })
      .then((response) => unwrapResponse(response, '创建联机房间'))
  },

  hostInstance(target: InstanceTargetPayload): Promise<{ status: string }> {
    return backend
      .command(COMMAND_NAMES.connector_host_instance, target)
      .then((response) => unwrapResponse(response, '启动实例并创建联机房间'))
  },

  join(code: string): Promise<{ mcHost: string; mcPort: number }> {
    return backend
      .command(COMMAND_NAMES.connector_join, { code })
      .then((response) => unwrapResponse(response, '加入联机房间'))
  },

  leave(): Promise<{ status: string }> {
    return backend.command(COMMAND_NAMES.connector_leave).then((response) => unwrapResponse(response, '退出联机房间'))
  },

  kick(machineId: string): Promise<{ status: string }> {
    return backend
      .command(COMMAND_NAMES.connector_kick, { machine_id: machineId })
      .then((response) => unwrapResponse(response, '移出联机玩家'))
  },

  detectPorts(): Promise<{ ports: number[] }> {
    return backend
      .command(COMMAND_NAMES.connector_detect_ports, undefined, 10000)
      .then((response) => unwrapResponse(response, '探测本地端口'))
  },

  searchMcPort(ports: number[]): Promise<{ port: number | null }> {
    return backend
      .command(COMMAND_NAMES.connector_search_mc_port, { ports }, 10000)
      .then((response) => unwrapResponse(response, '搜索 MC 端口'))
  },

  natType(): Promise<NatTypeResult> {
    return backend
      .command(COMMAND_NAMES.connector_nat_type)
      .then((response) => unwrapResponse(response, '检测 NAT 类型'))
  },
}
