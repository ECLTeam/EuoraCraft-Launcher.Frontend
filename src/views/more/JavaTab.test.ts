import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NDropdown } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { javaApi } from '@/features/java/api/javaApi'
import JavaDownloadModal from '@/features/java/components/JavaDownloadModal.vue'
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
    global: {
      plugins: [createPinia(), i18n],
      stubs: { Teleport: true, ConfirmDialog: true, UiIcon: true, JavaDownloadModal: true },
    },
  })
  await flushPromises()
  return wrapper
}

describe('Java 管理页表面承托', () => {
  it('空清单时仍以统一表面包住工具栏、搜索与空状态', async () => {
    const wrapper = await render()
    const panel = wrapper.get('.java-panel.ecl-surface')
    expect(wrapper.findAll('.java-panel.ecl-surface')).toHaveLength(1)
    expect(panel.find('.java-manager-toolbar').exists()).toBe(true)
    expect(panel.find('input').exists()).toBe(true)
    expect(panel.find('.n-empty').exists()).toBe(true)
  })

  it('下载打开独立弹窗，原表面和已安装列表保持不变', async () => {
    const wrapper = await render()
    const panel = wrapper.get('.java-panel.ecl-surface').element
    wrapper.get('.java-manager-toolbar').getComponent(NDropdown).vm.$emit('select', 'download')
    await flushPromises()
    expect(wrapper.get('.java-panel.ecl-surface').element).toBe(panel)
    const content = wrapper.get('.java-panel.ecl-surface')
    expect(content.find('.java-catalog-controls').exists()).toBe(false)
    expect(wrapper.getComponent(JavaDownloadModal).props('visible')).toBe(true)
    expect(content.find('.n-empty').exists()).toBe(true)
  })

  it('供弹窗复用的管理组件自身不增加表面', async () => {
    const wrapper = await render(JavaManagerPanel)
    expect(wrapper.find('.java-panel.ecl-surface').exists()).toBe(false)
    expect(wrapper.find('.java-manager-toolbar').exists()).toBe(true)
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })
})
