import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import NatDetectModal from '@/components/connect/NatDetectModal.vue'
import { useNatType } from '@/features/connect/composables/useNatType'
import { i18n } from '@/i18n'
import type { ApiResponse } from '@/types/api'
import type { NatTypeResult } from '@/types/connect'

const mocks = vi.hoisted(() => ({ natType: vi.fn() }))

vi.mock('@/features/connect/api/connectorApi', () => ({
  connectorApi: { natType: mocks.natType },
}))

const cacheTtlMs = 10 * 60 * 1000
let now = 1_700_000_000_000

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

function backendFailure(errorCode: string, message = 'probe failed'): BackendCommandError {
  return new BackendCommandError({ message, errorCode } as ApiResponse<unknown>, 'NAT probe failed')
}

function mountModal(initialVisible = true) {
  const visible = ref(initialVisible)
  const Host = defineComponent({
    components: { NatDetectModal },
    setup: () => ({ visible }),
    template: '<NatDetectModal v-model:visible="visible" />',
  })
  const wrapper = mount(Host, {
    attachTo: document.body,
    global: { plugins: [i18n], stubs: { transition: false } },
  })
  return { wrapper, visible }
}

function footerButton(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.modal-footer button')].find((candidate) =>
    candidate.textContent?.includes(label)
  )
  if (!button) throw new Error(`未找到按钮：${label}`)
  return button
}

describe('NatDetectModal', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
    now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    mocks.natType.mockReset()
    useNatType().reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('打开时自动探测并展示类型、公网地址与 IPv6 状态', async () => {
    mocks.natType.mockResolvedValue(natResult({ supportsIpv6: true }))
    const { wrapper } = mountModal()

    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(1)
    const text = document.body.textContent ?? ''
    expect(text).toContain('完全锥形 NAT')
    expect(text).toContain('203.0.113.7:51234')
    expect(text).toContain('已检测到公网 IPv6')
    expect(text).toContain('上次检测于')
    wrapper.unmount()
  })

  it('关闭后再次打开命中缓存，不重复探测', async () => {
    mocks.natType.mockResolvedValue(natResult())
    const { wrapper, visible } = mountModal()
    await flushPromises()

    visible.value = false
    await nextTick()
    visible.value = true
    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('完全锥形 NAT')
    wrapper.unmount()
  })

  it('缓存超过 10 分钟后重新探测', async () => {
    mocks.natType.mockResolvedValue(natResult())
    const { wrapper, visible } = mountModal()
    await flushPromises()

    visible.value = false
    await nextTick()
    now += cacheTtlMs + 1
    visible.value = true
    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('探测进行中重复打开复用同一请求', async () => {
    let resolveProbe: (value: NatTypeResult) => void = () => {}
    mocks.natType.mockReturnValue(
      new Promise<NatTypeResult>((resolve) => {
        resolveProbe = resolve
      })
    )
    const { wrapper, visible } = mountModal()
    await nextTick()

    visible.value = false
    await nextTick()
    visible.value = true
    await nextTick()

    expect(mocks.natType).toHaveBeenCalledTimes(1)
    resolveProbe(natResult())
    await flushPromises()
    expect(document.body.textContent).toContain('完全锥形 NAT')
    wrapper.unmount()
  })

  it('超时失败展示对应文案并清空缓存', async () => {
    mocks.natType.mockRejectedValueOnce(backendFailure('CONNECTOR_NAT_TYPE_TIMEOUT'))
    const { wrapper, visible } = mountModal()
    await flushPromises()

    expect(document.body.textContent).toContain('检测超时，请检查网络后重试')

    mocks.natType.mockResolvedValue(natResult())
    visible.value = false
    await nextTick()
    visible.value = true
    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('完全锥形 NAT')
    wrapper.unmount()
  })

  it('已有检测进行中时展示忙碌文案', async () => {
    mocks.natType.mockRejectedValueOnce(backendFailure('CONNECTOR_NAT_TYPE_BUSY'))
    const { wrapper } = mountModal()
    await flushPromises()

    expect(document.body.textContent).toContain('已有检测正在进行，请稍后重试')
    wrapper.unmount()
  })

  it('重新检测忽略缓存强制探测一次', async () => {
    mocks.natType.mockResolvedValue(natResult())
    const { wrapper } = mountModal()
    await flushPromises()

    footerButton('重新检测').click()
    await flushPromises()

    expect(mocks.natType).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
