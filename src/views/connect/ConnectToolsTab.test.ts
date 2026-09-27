import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { NatTypeResult } from '@/types/connect'
import ConnectToolsTab from './ConnectToolsTab.vue'

const mocks = vi.hoisted(() => ({ natType: vi.fn() }))

vi.mock('@/features/connect/api/connectorApi', () => ({
  connectorApi: { natType: mocks.natType },
}))

function natResult(overrides: Partial<NatTypeResult> = {}): NatTypeResult {
  return {
    type: 'cone',
    detailType: 'fullCone',
    publicIp: '203.0.113.7',
    publicPort: 51234,
    publicPortEnd: 51234,
    supportsIpv6: false,
    ...overrides,
  }
}

function mountToolsTab() {
  i18n.global.locale.value = 'zh-CN'
  return mount(ConnectToolsTab, { global: { plugins: [i18n] } })
}

function detectButton(wrapper: ReturnType<typeof mountToolsTab>) {
  return wrapper.findAll('button').find((candidate) => candidate.text().includes('NAT 检测'))
}

describe('ConnectToolsTab', () => {
  beforeEach(() => {
    mocks.natType.mockReset()
  })

  it('renders the idle state before any detection', () => {
    const wrapper = mountToolsTab()

    expect(wrapper.text()).toContain('尚未检测网络类型')
    expect(wrapper.text()).toContain('NAT 类型检测')
  })

  it('renders the detected type and public address', async () => {
    mocks.natType.mockResolvedValue(natResult({ supportsIpv6: true }))
    const wrapper = mountToolsTab()

    await detectButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('完全锥形 NAT')
    expect(wrapper.text()).toContain('203.0.113.7:51234')
    expect(wrapper.text()).toContain('支持公网 IPv6')
  })

  it('renders a port range when the mapped port is not fixed', async () => {
    mocks.natType.mockResolvedValue(natResult({ publicPort: 51234, publicPortEnd: 51240 }))
    const wrapper = mountToolsTab()

    await detectButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('203.0.113.7:51234-51240')
  })

  it('shows the backend message when detection fails', async () => {
    mocks.natType.mockRejectedValue(new Error('NAT 探测服务不可用'))
    const wrapper = mountToolsTab()

    await detectButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('检测失败')
    expect(wrapper.text()).toContain('NAT 探测服务不可用')
  })

  it('disables the action while a detection is in flight', async () => {
    let resolveDetection: (value: NatTypeResult) => void = () => undefined
    mocks.natType.mockReturnValue(
      new Promise<NatTypeResult>((resolve) => {
        resolveDetection = resolve
      })
    )
    const wrapper = mountToolsTab()

    await detectButton(wrapper)?.trigger('click')
    await wrapper.vm.$nextTick()

    expect(detectButton(wrapper)?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('正在检测网络类型...')

    resolveDetection(natResult())
    await flushPromises()

    expect(detectButton(wrapper)?.attributes('disabled')).toBeUndefined()
  })
})
