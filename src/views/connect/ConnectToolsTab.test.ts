import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import NatToolCard from '@/components/connect/NatToolCard.vue'
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

    expect(wrapper.text()).toContain('尚未检测')
    expect(wrapper.text()).toContain('NAT 类型检测')
    expect(wrapper.find('.connect-main-card').exists()).toBe(false)
    expect(mocks.natType).not.toHaveBeenCalled()
  })

  it('renders the detected type and public address', async () => {
    mocks.natType.mockResolvedValue(natResult({ supportsIpv6: true }))
    const wrapper = mountToolsTab()

    await detectButton(wrapper)?.trigger('click')
    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('完全锥形 NAT')
    expect(wrapper.text()).toContain('203.0.113.7:51234')
    expect(wrapper.text()).toContain('已检测到公网 IPv6')
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

  it('hides the previous result while detecting again and ignores duplicate clicks', async () => {
    mocks.natType.mockResolvedValueOnce(natResult())
    const wrapper = mountToolsTab()
    await detectButton(wrapper)?.trigger('click')
    await flushPromises()

    let resolveDetection!: (value: NatTypeResult) => void
    mocks.natType.mockReturnValueOnce(new Promise<NatTypeResult>((resolve) => (resolveDetection = resolve)))
    await detectButton(wrapper)?.trigger('click')
    await detectButton(wrapper)?.trigger('click')
    expect(wrapper.text()).toContain('正在检测网络类型...')
    expect(wrapper.text()).not.toContain('203.0.113.7')
    expect(mocks.natType).toHaveBeenCalledTimes(2)

    resolveDetection(natResult({ publicIp: '203.0.113.8' }))
    await flushPromises()
    expect(wrapper.text()).toContain('203.0.113.8')
    wrapper.unmount()
  })

  it('allows retry after an error and removes the old error', async () => {
    mocks.natType.mockRejectedValueOnce(new Error('探测失败')).mockResolvedValueOnce(natResult())
    const wrapper = mountToolsTab()
    await detectButton(wrapper)?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('探测失败')
    await detectButton(wrapper)?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('探测失败')
    expect(wrapper.text()).toContain('203.0.113.7')
    wrapper.unmount()
  })

  it('distinguishes unknown type and missing data from failed detection', async () => {
    mocks.natType.mockResolvedValue(natResult({ type: 'unknown', detailType: 'unknown', publicIp: null }))
    const wrapper = mountToolsTab()
    await detectButton(wrapper)?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('未能确定类型')
    expect(wrapper.text()).toContain('未获取')
    expect(wrapper.text()).toContain('未检测到公网 IPv6')
    expect(wrapper.text()).not.toContain('检测失败')
    wrapper.unmount()
  })

  it('formats IPv6 addresses with brackets', async () => {
    mocks.natType.mockResolvedValue(natResult({ publicIp: '2001:db8::1' }))
    const wrapper = mountToolsTab()
    await detectButton(wrapper)?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('[2001:db8::1]:51234')
    wrapper.unmount()
  })

  it('ignores a late response after leaving the page', async () => {
    let resolveDetection!: (value: NatTypeResult) => void
    mocks.natType.mockReturnValueOnce(new Promise<NatTypeResult>((resolve) => (resolveDetection = resolve)))
    const wrapper = mountToolsTab()
    await detectButton(wrapper)?.trigger('click')
    wrapper.unmount()
    resolveDetection(natResult())
    await flushPromises()
    expect((wrapper.findComponent(NatToolCard).vm as unknown as { result: NatTypeResult | null }).result).toBeNull()
  })

  it.each([
    ['CONNECTOR_NAT_TYPE_TIMEOUT', '检测超时，请检查网络后重试'],
    ['CONNECTOR_NAT_TYPE_BUSY', '已有检测正在进行，请稍后重试'],
    ['CONNECTOR_NAT_TYPE_FAILED', '网络探测失败，请稍后重试'],
  ])('localizes the backend error %s', async (errorCode, message) => {
    mocks.natType.mockRejectedValue(new BackendCommandError({ success: false, errorCode, message: 'raw' }, 'failed'))
    const wrapper = mountToolsTab()
    await detectButton(wrapper)?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('raw')
    wrapper.unmount()
  })
})
