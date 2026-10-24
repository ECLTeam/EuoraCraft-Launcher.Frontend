import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NSwitch } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'
import SettingRow from '@/features/settings/components/SettingRow.vue'
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
