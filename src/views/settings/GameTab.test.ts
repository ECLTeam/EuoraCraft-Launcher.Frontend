import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NInput, NSwitch } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { i18n } from '@/i18n'
import GameTab from './GameTab.vue'

const mocks = vi.hoisted(() => ({ patch: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/features/settings/stores/settingsStore', async () => {
  const { defineStore } = await import('pinia')
  return {
    useSettingsStore: defineStore('test-game-settings', {
      state: () => ({
        game: {
          minecraft_paths: [],
          java_auto: false,
          java_path: 'C:/Java/java.exe',
          memory_auto: true,
          memory_size: 4096,
          lock_memory: false,
        },
      }),
      actions: { load: async () => {}, patchGame: mocks.patch },
    }),
  }
})
vi.mock('@/features/settings/api/settingsApi', () => ({
  settingsApi: { getSystemMemory: async () => ({ totalMb: 16384, usedMb: 4096, freeMb: 12288 }) },
}))
vi.mock('@/composables/useAsyncAction', () => ({
  useAsyncAction: () => ({ run: async (operation: () => Promise<unknown>) => operation() }),
}))
enableAutoUnmount(afterEach)
beforeEach(() => mocks.patch.mockReset().mockResolvedValue(undefined))
it('保存旧草稿和外部刷新期间的新输入被保留，再次提交得到最终值', async () => {
  const pinia = createPinia()
  const wrapper = mount(GameTab, {
    global: { plugins: [pinia, i18n], stubs: { JavaRuntimeSelector: true, PluginSlotHost: true } },
  })
  await flushPromises()
  const store = useSettingsStore(pinia)
  let finish!: () => void
  mocks.patch.mockImplementationOnce(
    (patch) =>
      new Promise<void>((resolve) => {
        finish = () => {
          store.game = { ...store.game, ...patch }
          resolve()
        }
      })
  )
  const input = wrapper.findAllComponents(NInput).find((field) => field.props('type') === 'textarea')!
  await input.vm.$emit('update:value', '-Dvalue=A')
  await input.vm.$emit('blur')
  await flushPromises()
  await input.vm.$emit('update:value', '-Dvalue=B')
  finish()
  await flushPromises()
  expect(input.props('value')).toBe('-Dvalue=B')
  await input.vm.$emit('blur')
  await flushPromises()
  expect(mocks.patch).toHaveBeenLastCalledWith({ jvm_args: ['-Dvalue=B'] })
})

it('未修改失焦不保存，编辑草稿不污染已确认配置，关闭时提交最后修改', async () => {
  const pinia = createPinia()
  const wrapper = mount(GameTab, {
    global: { plugins: [pinia, i18n], stubs: { JavaRuntimeSelector: true, PluginSlotHost: true } },
  })
  await flushPromises()
  mocks.patch.mockClear()
  const input = wrapper.findAllComponents(NInput).find((input) => input.props('type') === 'textarea')!
  await input.vm.$emit('blur')
  await flushPromises()
  expect(mocks.patch).not.toHaveBeenCalled()
  await input.vm.$emit('update:value', '-Ddraft=true')
  expect(useSettingsStore(pinia).game).not.toHaveProperty('jvm_args')
  wrapper.unmount()
  await flushPromises()
  expect(mocks.patch).toHaveBeenCalledExactlyOnceWith({ jvm_args: ['-Ddraft=true'] })
})

it('places lock memory in the memory section and uses the managed Java selector', async () => {
  i18n.global.locale.value = 'zh-CN'
  const wrapper = mount(GameTab, {
    global: { plugins: [createPinia(), i18n], stubs: { JavaRuntimeSelector: true, PluginSlotHost: true } },
  })
  await flushPromises()
  const lockRow = wrapper.findAllComponents(SettingRow).find((row) => row.props('label') === '锁定内存')!
  expect(lockRow.element.closest('section')?.querySelector('.settings-section__header')?.textContent).toContain('内存')
  expect(wrapper.find('java-runtime-selector-stub').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('浏览')
  lockRow.getComponent(NSwitch).vm.$emit('update:value', true)
  await flushPromises()
  expect(mocks.patch).toHaveBeenCalledWith(expect.objectContaining({ lock_memory: true }))
})
