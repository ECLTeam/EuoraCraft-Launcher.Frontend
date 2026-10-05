import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onMounted, onUnmounted } from 'vue'
import { useConnector } from './useConnector'

const api = vi.hoisted(() => ({
  status: vi.fn(),
  easyTierStatus: vi.fn(),
  detectPorts: vi.fn(),
  searchMcPort: vi.fn(),
}))

vi.mock('@/features/connect/api/connectorApi', () => ({
  connectorApi: {
    ...api,
    hostPort: vi.fn(),
    hostInstance: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    kick: vi.fn(),
  },
}))

const Harness = defineComponent({
  setup() {
    const connector = useConnector()
    onMounted(() => void connector.initialize())
    onUnmounted(connector.dispose)
    return connector
  },
  template: '<div />',
})

describe('useConnector polling lifecycle', () => {
  beforeEach(() => {
    useConnector().dispose()
    vi.clearAllMocks()
    vi.useFakeTimers()
    api.status.mockResolvedValue({
      mode: 'host',
      roomCode: 'U/TEST',
      mcHost: '127.0.0.1',
      mcPort: 25565,
      gameInfo: null,
      players: [],
      error: null,
    })
    api.easyTierStatus.mockResolvedValue({
      installed: true,
      status: 'installed',
      progress: 100,
      speed: 0,
      error: null,
    })
  })

  afterEach(() => {
    useConnector().dispose()
    vi.useRealTimers()
  })

  it('慢扫描不重叠，停止重启后的旧失败不会停止新扫描', async () => {
    const session = useConnector()
    await session.initialize()
    let fail!: (error: Error) => void
    api.detectPorts
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject
          })
      )
      .mockResolvedValue({ ports: [25565] })
    session.startPortScan()
    await vi.advanceTimersByTimeAsync(3000)
    expect(api.detectPorts).toHaveBeenCalledOnce()
    session.stopPortScan()
    session.startPortScan()
    expect(api.detectPorts).toHaveBeenCalledOnce()
    fail(new Error('old scan failure'))
    await flushPromises()
    await nextTick()
    expect(session.scanning.value).toBe(true)
    expect(api.detectPorts).toHaveBeenCalledTimes(2)
  })

  it('application host initializes polling and disposes it on shutdown', async () => {
    const wrapper = mount(Harness)
    await vi.runAllTicks()
    await Promise.resolve()
    await nextTick()

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
