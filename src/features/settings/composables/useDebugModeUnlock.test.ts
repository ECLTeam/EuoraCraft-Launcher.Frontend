import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { i18n } from '@/i18n'
import { useDebugModeUnlock } from './useDebugModeUnlock'

const mocks = vi.hoisted(() => ({
  setDebugMode: vi.fn<(value: boolean) => Promise<void>>(),
  info: vi.fn<(content: string) => { destroy: () => void }>(),
  success: vi.fn(),
  error: vi.fn(),
  destroyHint: vi.fn(),
}))

vi.mock('@/composables/useDebugMode', () => ({
  useDebugMode: () => ({ setDebugMode: mocks.setDebugMode }),
}))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ info: mocks.info, success: mocks.success, error: mocks.error }),
}))

let wrapper: VueWrapper<{ registerClick: () => Promise<boolean> }>

function mountUnlock() {
  const Harness = defineComponent({
    setup() {
      const { registerClick } = useDebugModeUnlock()
      return { registerClick }
    },
    render: () => h('div'),
  })
  wrapper = mount(Harness, { global: { plugins: [i18n] } })
  return wrapper
}

async function clickTimes(count: number): Promise<boolean[]> {
  const results: boolean[] = []
  for (let index = 0; index < count; index += 1) {
    results.push(await wrapper.vm.registerClick())
  }
  return results
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  i18n.global.locale.value = 'zh-CN'
  mocks.info.mockReturnValue({ destroy: mocks.destroyHint })
  mocks.setDebugMode.mockResolvedValue(undefined)
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useDebugModeUnlock', () => {
  it('前两次点击保持静默，从第三次开始提示剩余次数', async () => {
    mountUnlock()

    await clickTimes(2)
    expect(mocks.info).not.toHaveBeenCalled()

    await clickTimes(1)
    expect(mocks.info).toHaveBeenCalledWith('再点击 4 次开启调试模式', { duration: 2500 })

    await clickTimes(1)
    expect(mocks.info).toHaveBeenLastCalledWith('再点击 3 次开启调试模式', { duration: 2500 })
  })

  it('第七次点击开启调试模式并提示成功，期间只保留一条进度提示', async () => {
    mountUnlock()

    const results = await clickTimes(6)
    expect(results).toEqual([false, false, false, false, false, false])
    expect(mocks.setDebugMode).not.toHaveBeenCalled()
    expect(mocks.info).toHaveBeenCalledTimes(4)
    // 每次新提示先销毁上一条，避免连点时通知堆叠
    expect(mocks.destroyHint).toHaveBeenCalledTimes(3)

    await expect(wrapper.vm.registerClick()).resolves.toBe(true)
    expect(mocks.setDebugMode).toHaveBeenCalledWith(true)
    expect(mocks.success).toHaveBeenCalledWith('调试模式已开启', { title: '信息', duration: 5000 })
    expect(mocks.destroyHint).toHaveBeenCalledTimes(4)
  })

  it('点击间隔超时后重新计数，不累计零散点击', async () => {
    mountUnlock()

    await clickTimes(6)
    vi.advanceTimersByTime(1500)
    const results = await clickTimes(1)

    expect(results).toEqual([false])
    expect(mocks.setDebugMode).not.toHaveBeenCalled()
  })

  it('开启失败时提示错误并保持未开启状态', async () => {
    mocks.setDebugMode.mockRejectedValue(new Error('save failed'))
    mountUnlock()

    await clickTimes(6)
    await expect(wrapper.vm.registerClick()).resolves.toBe(false)
    await flushPromises()

    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('开启调试模式失败，请稍后重试', { title: '信息', duration: 6000 })
  })

  it('离开页面时清理计时器与未消失的提示', async () => {
    mountUnlock()
    await clickTimes(3)

    wrapper.unmount()

    expect(mocks.destroyHint).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
