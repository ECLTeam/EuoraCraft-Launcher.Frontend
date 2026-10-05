import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import { globalProcessInstances } from '../composables/useProcessInstances'
import InstanceTerminalModule from './InstanceTerminalModule.vue'

const terminalMocks = vi.hoisted(() => ({ getProcessInstances: vi.fn() }))
const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

vi.mock('../api/terminalApi', () => ({
  terminalApi: { getProcessInstances: terminalMocks.getProcessInstances },
}))

const { mocks } = mock.state!

describe('InstanceTerminalModule', () => {
  let initSpy: ReturnType<typeof vi.spyOn>
  let disposeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    terminalMocks.getProcessInstances.mockResolvedValue([])
    initSpy = vi.spyOn(globalProcessInstances, 'init')
    disposeSpy = vi.spyOn(globalProcessInstances, 'dispose')
  })

  afterEach(() => {
    initSpy.mockRestore()
    disposeSpy.mockRestore()
  })

  function mountModule() {
    return mount(InstanceTerminalModule, { global: { plugins: [i18n] } })
  }

  it('展示模块不重复订阅或释放应用持有的进程会话', async () => {
    const wrapper = mountModule()
    await Promise.resolve()
    expect(initSpy).not.toHaveBeenCalled()
    expect(mocks.on).not.toHaveBeenCalled()
    expect(terminalMocks.getProcessInstances).not.toHaveBeenCalled()

    wrapper.unmount()
    expect(disposeSpy).not.toHaveBeenCalled()
  })

  it('点击返回按钮触发 back 事件', async () => {
    const wrapper = mountModule()
    const backButton = wrapper.get('.itm-back')
    await backButton.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
