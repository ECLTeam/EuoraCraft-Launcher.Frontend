import { flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultVersionSettings } from '@/features/instances/model/instanceSettings'
import { i18n } from '@/i18n'
import type { ScannedVersion } from '@/types/instances'
import InstanceDetailSettingsTab from './InstanceDetailSettingsTab.vue'
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn(), error: vi.fn() }))
vi.mock('@/features/instances/api/instanceSettingsApi', () => ({
  instanceSettingsApi: { get: mocks.get, save: mocks.save, reset: mocks.reset },
}))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: mocks.error, warning: vi.fn(), success: vi.fn() }),
}))
vi.mock('@/features/settings/api/settingsApi', () => ({
  settingsApi: { getSystemMemory: async () => ({ totalMb: 16384, usedMb: 4096, availableMb: 12288 }) },
}))
vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    game: { java_auto: true, memory_auto: true, memory_size: 4096, game_width: 854, game_height: 480 },
    load: async () => {},
  }),
}))

const version = (versionId: string) => ({ versionId, id: versionId, path: 'C:/Game' }) as ScannedVersion
const wrappers: ReturnType<typeof mount>[] = []
function mountSettings(id = 'A') {
  const wrapper = mount(InstanceDetailSettingsTab, {
    props: { version: version(id), visible: true },
    global: { plugins: [i18n], stubs: { JavaRuntimeSelector: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('InstanceDetailSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue(createDefaultVersionSettings())
    mocks.save.mockResolvedValue(undefined)
    i18n.global.locale.value = 'zh-CN'
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })
  it('offers inherit, automatic and manual modes for Java and memory', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    const runtimeSelects = wrapper
      .findAllComponents(NSelect)
      .filter((select) => select.props('options')?.some((option) => option.value === 'auto'))
    expect(runtimeSelects).toHaveLength(2)
    for (const select of runtimeSelects)
      expect(select.props('options')?.map((option) => option.value)).toEqual(['inherit', 'auto', 'manual'])
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('flushes edits to the original instance when the visible instance changes', async () => {
    const wrapper = mountSettings('A')
    await flushPromises()
    const memory = wrapper
      .findAllComponents(NSelect)
      .find((select) => select.props('options')?.some((option) => option.value === 'auto'))!
    memory.vm.$emit('update:value', 'manual')
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ version: version('B') })
    await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith(
      { path: 'C:/Game', versionId: 'A' },
      expect.objectContaining({ memoryMode: 'manual' })
    )
    expect(mocks.save.mock.calls.every((call) => call[0].versionId === 'A')).toBe(true)
  })
  it('ignores late settings from the previous instance', async () => {
    let resolveOld!: (settings: ReturnType<typeof createDefaultVersionSettings>) => void
    mocks.get
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        })
      )
      .mockResolvedValueOnce({ ...createDefaultVersionSettings(), memoryMode: 'manual', memory: 8192 })
    const wrapper = mountSettings('A')
    await wrapper.setProps({ version: version('B') })
    await flushPromises()
    resolveOld({ ...createDefaultVersionSettings(), memoryMode: 'auto', memory: 2048 })
    await flushPromises()
    const memory = wrapper
      .findAllComponents(NSelect)
      .find((select) => select.props('options')?.some((option) => option.value === 'auto'))!
    expect(memory.props('value')).toBe('manual')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('cancels a pending autosave when restoring global settings', async () => {
    vi.useFakeTimers()
    const wrapper = mountSettings()
    await flushPromises()
    const memory = wrapper
      .findAllComponents(NSelect)
      .find((select) => select.props('options')?.some((option) => option.value === 'auto'))!
    memory.vm.$emit('update:value', 'manual')
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('恢复全局设置'))!
      .trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.reset).toHaveBeenCalledWith({ path: 'C:/Game', versionId: 'A' })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(memory.props('value')).toBe('inherit')
  })
})
