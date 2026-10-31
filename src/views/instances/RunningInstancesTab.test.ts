import { flushPromises, mount } from '@vue/test-utils'
import { NEmpty } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import { i18n } from '@/i18n'
import RunningInstancesTab from './RunningInstancesTab.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  stop: vi.fn(),
  onChanged: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/features/instances/api/instanceRuntimeApi', () => ({
  instanceRuntimeApi: {
    list: mocks.list,
    stop: mocks.stop,
    onChanged: mocks.onChanged,
  },
}))

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: mocks.success, error: mocks.error }),
}))

const runningInstance = {
  id: 'instance-1',
  name: '1.21.5 Fabric',
  type: 'Minecraft',
  isRunning: true,
  pid: 24680,
  version: '1.21.5 Fabric',
  versionId: '1.21.5 Fabric',
  loader: 'Fabric',
  gamePath: 'D:/Games/.minecraft',
  icon: null,
}

function mountTab() {
  return mount(RunningInstancesTab, {
    global: {
      plugins: [i18n],
      stubs: { Teleport: true },
    },
  })
}

describe('RunningInstancesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([runningInstance])
    mocks.stop.mockResolvedValue(undefined)
    mocks.onChanged.mockReturnValue(vi.fn())
  })

  it('loads the current in-memory running instances', async () => {
    const wrapper = mountTab()
    await flushPromises()

    expect(mocks.list).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('1.21.5 Fabric')
    expect(wrapper.text()).toContain('D:/Games/.minecraft')
    expect(wrapper.text()).toContain('24680')
    expect(wrapper.get('.running-instance-row .instance-icon img').attributes('src')).toBe('/img/item/fabric.png')
    expect(wrapper.find('.running-instance-row').exists()).toBe(true)
    expect(wrapper.find('.running-instance-card').exists()).toBe(false)
    expect(wrapper.get('.running-instances-count').classes()).not.toContain('inactive')
  })

  it('renders the icon configured for the instance instead of the loader default', async () => {
    mocks.list.mockResolvedValue([{ ...runningInstance, icon: { type: 'builtin', value: 'chest' } }])
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.get('.running-instance-row .instance-icon img').attributes('src')).toBe('/img/item/chest.png')
  })

  it('falls back to the loader icon when the instance has no image icon', async () => {
    mocks.list.mockResolvedValue([{ ...runningInstance, loader: 'Vanilla', icon: null }])
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('.running-instance-row .instance-icon img').exists()).toBe(false)
    expect(wrapper.find('.running-instance-row .instance-icon svg').exists()).toBe(true)
  })

  it('uses an inactive status badge when no instance is running', async () => {
    mocks.list.mockResolvedValue([])
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.get('.running-instances-count').classes()).toContain('inactive')
  })

  it('uses the standard empty box without a manual refresh action', async () => {
    mocks.list.mockResolvedValue([])
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.getComponent(NEmpty).props('description')).toBe(i18n.global.t('versions.running.empty'))
    expect(wrapper.find('.n-empty__icon svg').exists()).toBe(true)
    expect(wrapper.find('.running-empty-icon').exists()).toBe(false)
    // 空状态跟随后端实例事件实时更新，不再提供单独刷新入口。
    expect(wrapper.find('.n-empty__extra').exists()).toBe(false)
  })

  it('shows only the block loader while the initial request is pending', async () => {
    let resolve!: (instances: (typeof runningInstance)[]) => void
    mocks.list.mockReturnValueOnce(new Promise((done) => (resolve = done)))
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('.ui-loading--block').exists()).toBe(true)
    expect(wrapper.find('.ui-loading--overlay, .running-empty, .running-instance-row').exists()).toBe(false)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)

    resolve([])
    await flushPromises()
    expect(wrapper.find('.ui-loading--block').exists()).toBe(false)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(true)
  })

  it('hides existing content and the empty box while a lifecycle event reloads the list', async () => {
    const wrapper = mountTab()
    await flushPromises()
    const handler = mocks.onChanged.mock.calls[0]?.[0]
    let resolve!: (instances: (typeof runningInstance)[]) => void
    mocks.list.mockReturnValueOnce(new Promise((done) => (resolve = done)))

    handler({ action: 'started', instanceId: 'instance-2' })
    await flushPromises()
    expect(wrapper.find('.ui-loading--block').exists()).toBe(true)
    expect(wrapper.find('.running-instance-row').exists()).toBe(false)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)

    resolve([runningInstance])
    await flushPromises()
    expect(wrapper.find('.ui-loading--block').exists()).toBe(false)
    expect(wrapper.find('.running-instance-row').exists()).toBe(true)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)
  })

  it('switches to the standard empty box after the last exit and returns when an instance starts', async () => {
    const wrapper = mountTab()
    await flushPromises()
    const handler = mocks.onChanged.mock.calls[0]?.[0]

    mocks.list.mockResolvedValueOnce([])
    handler({ action: 'exited', instanceId: runningInstance.id })
    await flushPromises()
    expect(wrapper.find('.running-instance-row').exists()).toBe(false)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(true)

    mocks.list.mockResolvedValueOnce([runningInstance])
    handler({ action: 'started', instanceId: runningInstance.id })
    await flushPromises()
    expect(wrapper.find('.running-instance-row').exists()).toBe(true)
    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)
  })

  it('confirms and stops a selected instance', async () => {
    const wrapper = mountTab()
    await flushPromises()
    const exitLabel = String(i18n.global.t('versions.running.stop'))
    const stopButton = wrapper.findAll('button').find((button) => button.text().includes(exitLabel))

    await stopButton?.trigger('click')
    await wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
    await flushPromises()

    expect(mocks.stop).toHaveBeenCalledWith('instance-1')
    expect(mocks.success).toHaveBeenCalled()
  })

  it('refreshes after a backend lifecycle event', async () => {
    mountTab()
    await flushPromises()
    const handler = mocks.onChanged.mock.calls[0]?.[0]

    handler({ action: 'exited', instanceId: 'instance-1', versionId: '1.21.5 Fabric', gamePath: 'D:/Games' })
    await flushPromises()

    expect(mocks.list).toHaveBeenCalledTimes(2)
  })
})
