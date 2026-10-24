import { flushPromises, mount } from '@vue/test-utils'
import { NSelect, NSwitch, NInput, NInputNumber } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createDefaultVersionSettings } from '@/features/instances/model/instanceSettings'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import { i18n } from '@/i18n'
import type { GameConfig } from '@/types/config'
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
const globalGame = reactive<GameConfig>({
  minecraft_paths: [],
  java_auto: true,
  memory_auto: true,
  memory_size: 4096,
  game_width: 854,
  game_height: 480,
  fullscreen: false,
  wrapper_command: 'global-wrapper',
})
vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({ game: globalGame, load: async () => {} }),
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

function control<T extends typeof NSwitch | typeof NInput | typeof NInputNumber>(
  wrapper: ReturnType<typeof mountSettings>,
  key: string,
  component: T
) {
  const row = wrapper.findAllComponents(SettingRow).find((item) => item.props('label') === i18n.global.t(key))!
  return row.getComponent(component)
}

describe('InstanceDetailSettingsTab', () => {
  it('does not mark cached Java paths or memory amounts as custom while their modes inherit', async () => {
    mocks.get.mockResolvedValue({ ...createDefaultVersionSettings(), memory: 8192, javaPath: 'global-java' })
    const wrapper = mountSettings()
    await flushPromises()
    expect(wrapper.get('.settings-summary-copy strong').text()).toBe(
      i18n.global.t('versions.detail.usingGlobalSettings')
    )
    expect(wrapper.get('.settings-summary button').attributes('disabled')).toBeDefined()
  })
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
  it('shows switches and business options without inheritance selectors, and does not save on read', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    expect(
      wrapper
        .findAllComponents(NSelect)
        .every((select) => select.props('options')?.every((option) => option.value !== 'inherit'))
    ).toBe(true)
    expect(control(wrapper, 'settings.javaAuto', NSwitch).props('value')).toBe(true)
    expect(control(wrapper, 'settings.memoryAuto', NSwitch).props('value')).toBe(true)
    globalGame.fullscreen = true
    await wrapper.vm.$nextTick()
    expect(control(wrapper, 'settings.fullscreen', NSwitch).props('value')).toBe(true)
    expect(
      wrapper
        .findAllComponents(SettingRow)
        .find((row) => row.props('label') === i18n.global.t('settings.fullscreen'))!
        .props('description')
    ).toBe('全局当前值：开启')
    expect(mocks.save).not.toHaveBeenCalled()
    globalGame.fullscreen = false
  })
  it('flushes edits to the original instance when the visible instance changes', async () => {
    const wrapper = mountSettings('A')
    await flushPromises()
    const memory = control(wrapper, 'settings.memoryAuto', NSwitch)
    memory.vm.$emit('update:value', false)
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
    const memory = control(wrapper, 'settings.memoryAuto', NSwitch)
    expect(memory.props('value')).toBe(false)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('cancels a pending autosave when restoring global settings', async () => {
    vi.useFakeTimers()
    const wrapper = mountSettings()
    await flushPromises()
    const memory = control(wrapper, 'settings.memoryAuto', NSwitch)
    memory.vm.$emit('update:value', false)
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('恢复全局设置'))!
      .trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.reset).toHaveBeenCalledWith({ path: 'C:/Game', versionId: 'A' })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(memory.props('value')).toBe(true)
  })

  it('saves false distinctly, restores equal global values and clears command overrides', async () => {
    vi.useFakeTimers()
    globalGame.fullscreen = true
    mocks.get.mockResolvedValue({
      ...createDefaultVersionSettings(),
      wrapperCommand: 'custom',
      commandOverrides: ['wrapperCommand'],
    })
    const wrapper = mountSettings()
    await flushPromises()
    control(wrapper, 'settings.fullscreen', NSwitch).vm.$emit('update:value', false)
    await wrapper.vm.$nextTick()
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ fullscreen: false }))
    control(wrapper, 'settings.fullscreen', NSwitch).vm.$emit('update:value', true)
    control(wrapper, 'settings.wrapperCommand', NInput).vm.$emit('update:value', '')
    await wrapper.vm.$nextTick()
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ fullscreen: null, wrapperCommand: '', commandOverrides: [] })
    )
    globalGame.fullscreen = false
  })

  it('treats empty or matching memory size as inherited without losing a different manual size', async () => {
    vi.useFakeTimers()
    globalGame.memory_auto = false
    const wrapper = mountSettings()
    await flushPromises()
    const input = wrapper.get('.instance-memory-input')
    expect(input.element).toBeDefined()
    const memoryInput = wrapper
      .findAllComponents(NInputNumber)
      .find((item) => item.attributes('class')?.includes('instance-memory-input'))!
    expect(memoryInput.props('value')).toBeNull()
    memoryInput.vm.$emit('update:value', 8192)
    await wrapper.vm.$nextTick()
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ memoryMode: 'manual', memory: 8192 })
    )
    memoryInput.vm.$emit('update:value', 4096)
    await wrapper.vm.$nextTick()
    await vi.advanceTimersByTimeAsync(350)
    expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ memoryMode: 'inherit' }))
    globalGame.memory_auto = true
  })
})
