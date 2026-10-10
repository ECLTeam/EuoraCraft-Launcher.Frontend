import { beforeEach, describe, expect, it, vi } from 'vitest'
import { okResponse, type BackendMockState } from '@/test/mockBackend'
import { connectorApi } from './connectorApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { mocks } = mock.state!

describe('connectorApi', () => {
  beforeEach(() => {
    mocks.command.mockReset()
    mocks.command.mockResolvedValue(okResponse({ status: 'ok' }))
  })

  it.each([
    ['status', [], 'connector_status', undefined],
    ['hostPort', [25565], 'connector_host_port', { port: 25565 }],
    [
      'hostInstance',
      [{ game_path: 'C:\\Games\\.minecraft', version_id: 'Fabric 1.21.5' }],
      'connector_host_instance',
      { game_path: 'C:\\Games\\.minecraft', version_id: 'Fabric 1.21.5' },
    ],
    ['join', ['U/ECL7-W9KM-4R2P-X8QA'], 'connector_join', { code: 'U/ECL7-W9KM-4R2P-X8QA' }],
    ['leave', [], 'connector_leave', undefined],
    ['kick', ['machine-1'], 'connector_kick', { machine_id: 'machine-1' }],
    ['detectPorts', [], 'connector_detect_ports', undefined],
    ['searchMcPort', [[25565]], 'connector_search_mc_port', { ports: [25565] }],
    ['natType', [], 'connector_nat_type', undefined],
  ] as const)('%s uses the typed IPC contract', async (method, args, expectedCommand, expectedPayload) => {
    await (connectorApi[method] as (...params: never[]) => Promise<unknown>)(...(args as unknown as never[]))

    const timeout = ({ status: 5000, detectPorts: 10000, searchMcPort: 10000 } as Record<string, number>)[method]
    if (timeout) expect(mocks.command).toHaveBeenCalledWith(expectedCommand, expectedPayload, timeout)
    else if (expectedPayload === undefined) expect(mocks.command).toHaveBeenCalledWith(expectedCommand)
    else expect(mocks.command).toHaveBeenCalledWith(expectedCommand, expectedPayload)
  })
})
