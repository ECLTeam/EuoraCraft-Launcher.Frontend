import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { javaApi } from '@/features/java/api/javaApi'
import JavaManagerPanel from '@/features/java/components/JavaManagerPanel.vue'
import { i18n } from '@/i18n'
import { javaInventory } from '@/test/javaFixtures'
import JavaTab from './JavaTab.vue'

vi.mock('@/api/client', async () => (await import('@/test/mockBackend')).createMockBackend().backend)
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}))

enableAutoUnmount(afterEach)

beforeEach(() => {
  setActivePinia(createPinia())
  i18n.global.locale.value = 'zh-CN'
  vi.spyOn(javaApi, 'inventory').mockResolvedValue(javaInventory())
  vi.spyOn(javaApi, 'catalog').mockResolvedValue({
    availableMajorVersions: [21],
    recommendedMajorVersion: 21,
    majorVersion: 21,
    platform: 'windows',
    architecture: 'x64',
    packages: [],
  })
})

afterEach(() => vi.restoreAllMocks())

async function render(component: typeof JavaTab | typeof JavaManagerPanel = JavaTab) {
  const wrapper = mount(component, {
    global: { plugins: [createPinia(), i18n], stubs: { Teleport: true, ConfirmDialog: true, UiIcon: true } },
  })
  await flushPromises()
  return wrapper
}

describe('Java 管理页卡片承托', () => {
  it('空清单时仍以统一卡片包住工具栏、搜索与空状态', async () => {
    const wrapper = await render()
    const card = wrapper.get('[data-theme-component="card"]')
    expect(wrapper.findAll('[data-theme-component="card"]')).toHaveLength(1)
    expect(card.find('.java-manager-toolbar').exists()).toBe(true)
    expect(card.find('input').exists()).toBe(true)
    expect(card.find('.n-empty').exists()).toBe(true)
  })

  it('切换下载视图后筛选、来源和无包提示仍在同一卡片内', async () => {
    const wrapper = await render()
    const card = wrapper.get('[data-theme-component="card"]').element
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '下载')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-theme-component="card"]').element).toBe(card)
    const content = wrapper.get('[data-theme-component="card"]')
    expect(content.find('.java-catalog-controls').exists()).toBe(true)
    expect(content.text()).toContain('Eclipse Temurin')
    expect(content.find('.n-empty').exists()).toBe(true)
  })

  it('供弹窗复用的管理组件自身不增加卡片', async () => {
    const wrapper = await render(JavaManagerPanel)
    expect(wrapper.find('[data-theme-component="card"]').exists()).toBe(false)
    expect(wrapper.find('.java-manager-toolbar').exists()).toBe(true)
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })
})
