import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { useConnector } from './useConnector'

const api = vi.hoisted(() => ({
  status: vi.fn(),
  easyTierStatus: vi.fn(),
}))

vi.mock('@/features/connect/api/connectorApi', () => ({
  connectorApi: {
    ...api,
    hostPort: vi.fn(),
    hostInstance: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    kick: vi.fn(),
    detectPorts: vi.fn(),
    searchMcPort: vi.fn(),
  },
}))

const Harness = defineComponent({
  setup() {
    return useConnector()
  },
  template: '<div />',
})

describe('useConnector polling lifecycle', () => {
  beforeEach(() => {
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
    vi.useRealTimers()
  })

  it('starts active-room polling and clears it when the page unmounts', async () => {
    const wrapper = mount(Harness)
    await vi.runAllTicks()
    await Promise.resolve()
    await nextTick()

    expect(vi.getTimerCount()).toBeGreaterThan(0)

    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
