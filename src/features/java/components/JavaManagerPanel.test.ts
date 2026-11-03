import { flushPromises, mount } from '@vue/test-utils'
import { NDropdown, NPopover } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import { javaApi } from '@/features/java/api/javaApi'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { i18n } from '@/i18n'
import { javaInventory, javaRuntime } from '@/test/javaFixtures'
import JavaDownloadModal from './JavaDownloadModal.vue'
import JavaManagerPanel from './JavaManagerPanel.vue'

vi.mock('@/api/client', async () => (await import('@/test/mockBackend')).createMockBackend().backend)
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}))
let wrappers: ReturnType<typeof mount>[] = []

beforeEach(() => {
  queryClient.clear()
  setActivePinia(createPinia())
  i18n.global.locale.value = 'zh-CN'
  vi.spyOn(javaApi, 'inventory').mockResolvedValue(
    javaInventory([javaRuntime({ origin: 'managed', references: ['global'], isInUse: true })])
  )
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  vi.restoreAllMocks()
})

async function render(props = {}) {
  const wrapper = mount(JavaManagerPanel, {
    props,
    global: {
      plugins: [createPinia(), i18n],
      stubs: { Teleport: true, ConfirmDialog: true, UiIcon: true, JavaDownloadModal: true },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('Java 管理与拥有权提示', () => {
  it('空清单打开独立下载弹窗，保留管理内容且不提交安装', async () => {
    vi.mocked(javaApi.inventory).mockResolvedValue(javaInventory())
    vi.spyOn(javaApi, 'catalog').mockResolvedValue({
      availableMajorVersions: [21],
      recommendedMajorVersion: 21,
      majorVersion: 21,
      platform: 'windows',
      architecture: 'x64',
      packages: [],
    })
    const install = vi.spyOn(javaApi, 'install')
    const wrapper = await render()
    expect(wrapper.get('.ui-empty-state').text()).toContain('没有登记的 Java')
    await wrapper.get('.ui-empty-state button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.java-manager-tabs').exists()).toBe(false)
    expect(wrapper.find('.ui-empty-state').exists()).toBe(true)
    expect(wrapper.getComponent(JavaDownloadModal).props('visible')).toBe(true)
    wrapper.getComponent(JavaDownloadModal).vm.$emit('close')
    await flushPromises()
    expect(wrapper.getComponent(JavaDownloadModal).props('visible')).toBe(false)
    expect(install).not.toHaveBeenCalled()
  })

  it('搜索无匹配时清除搜索恢复原有条目', async () => {
    const wrapper = await render()
    await wrapper.get('input').setValue('找不到这个版本')
    expect(wrapper.get('.ui-empty-state').text()).toContain('没有匹配的 Java')
    await wrapper.get('.ui-empty-state button').trigger('click')
    expect(wrapper.find('.java-runtime-row').exists()).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
  })

  it('在用且被设置引用的运行时保留条目，并禁用物理移除', async () => {
    const wrapper = await render()
    expect(wrapper.text()).toContain('使用中')
    expect(wrapper.text()).toContain('已被 1 项设置引用')
    const menu = wrapper.getComponent(NDropdown)
    expect(menu.props('options')!.find((option) => option.key === 'remove')).toMatchObject({ disabled: true })
    menu.vm.$emit('select', 'remove')
    await flushPromises()
    expect(wrapper.getComponent(ConfirmDialog).props('visible')).toBe(false)
  })

  it('路径可展开查看，次要操作收进更多菜单', async () => {
    const executablePath = 'C:/Launcher/very-long-managed-runtime-directory/temurin-25/bin/java.exe'
    vi.mocked(javaApi.inventory).mockResolvedValue(javaInventory([javaRuntime({ executablePath })]))
    const wrapper = await render()
    expect(wrapper.get('.java-runtime-path-trigger').attributes('title')).toBe(executablePath)
    expect(wrapper.get('.java-runtime-path-trigger').attributes('aria-label')).toBe('查看完整路径')
    const popover = wrapper.getComponent(NPopover)
    popover.vm.$emit('update:show', true)
    await flushPromises()
    expect(popover.props('show')).toBe(true)
    await wrapper.get('.java-runtime-path-trigger').trigger('keydown', { key: 'Escape' })
    expect(popover.props('show')).toBe(false)
    popover.vm.$emit('update:show', true)
    await wrapper.get('input').setValue('no-matching-runtime')
    await wrapper.get('input').setValue('')
    expect(wrapper.getComponent(NPopover).props('show')).toBe(false)
    const actions = wrapper.get('.java-runtime-actions')
    expect(actions.text()).toContain('设为全局 Java')
    expect(wrapper.get('.java-runtime-more').attributes('aria-label')).toContain('更多操作')
    expect(actions.findAll('button').some((button) => button.text() === '停用')).toBe(false)
    expect(actions.findAll('button').some((button) => button.text() === '移除登记')).toBe(false)
  })

  it('更多菜单可用 Esc 关闭，搜索后不会重新展开', async () => {
    const wrapper = await render()
    const menu = wrapper.getComponent(NDropdown)
    menu.vm.$emit('update:show', true)
    await flushPromises()
    expect(menu.props('show')).toBe(true)
    await wrapper.get('.java-runtime-more').trigger('keydown', { key: 'Escape' })
    expect(menu.props('show')).toBe(false)
    menu.vm.$emit('update:show', true)
    await wrapper.get('input').setValue('no-matching-runtime')
    await wrapper.get('input').setValue('')
    expect(wrapper.getComponent(NDropdown).props('show')).toBe(false)
  })

  it.each(['managed', 'manual', 'system'] as const)('更多菜单保留 %s 来源的移除权限和确认流程', async (origin) => {
    const runtime = javaRuntime({ origin })
    vi.mocked(javaApi.inventory).mockResolvedValue(javaInventory([runtime]))
    const remove = vi.spyOn(javaApi, 'remove').mockResolvedValue({ operationId: 'remove-java', status: 'pending' })
    const forget = vi.spyOn(javaApi, 'forget').mockResolvedValue({ removed: true })
    const wrapper = await render()
    const menu = wrapper.getComponent(NDropdown)
    const removal = menu.props('options')!.find((option) => option.key === 'remove')
    if (origin === 'system') {
      expect(removal).toBeUndefined()
      menu.vm.$emit('select', 'remove')
      await flushPromises()
      expect(wrapper.getComponent(ConfirmDialog).props('visible')).toBe(false)
    } else {
      expect(removal).toMatchObject({ disabled: false })
      menu.vm.$emit('select', 'remove')
      await flushPromises()
      expect(wrapper.getComponent(ConfirmDialog).props('visible')).toBe(true)
      expect(remove).not.toHaveBeenCalled()
      expect(forget).not.toHaveBeenCalled()
      wrapper.getComponent(ConfirmDialog).vm.$emit('confirm')
      await flushPromises()
      if (origin === 'managed') expect(remove).toHaveBeenCalledWith(runtime.runtimeId)
      else expect(forget).toHaveBeenCalledWith(runtime.runtimeId)
    }
  })

  it('从更多菜单停用时沿用当前运行时并刷新列表', async () => {
    const runtime = javaRuntime()
    vi.mocked(javaApi.inventory).mockResolvedValue(javaInventory([runtime]))
    const setEnabled = vi.spyOn(javaApi, 'setEnabled').mockResolvedValue({ ...runtime, isEnabled: false })
    const wrapper = await render()
    wrapper.getComponent(NDropdown).vm.$emit('select', 'toggle')
    await flushPromises()
    expect(setEnabled).toHaveBeenCalledWith(runtime.runtimeId, false)
    expect(javaApi.inventory).toHaveBeenCalledTimes(2)
  })

  it('下载入口保留实例要求，目标改变时关闭旧目录', async () => {
    const wrapper = await render({ initialView: 'download', requiredMajor: 21, scopeKey: 'A' })
    expect(wrapper.getComponent(JavaDownloadModal).props('requiredMajor')).toBe(21)
    await wrapper.setProps({ scopeKey: 'B' })
    expect(wrapper.getComponent(JavaDownloadModal).props('visible')).toBe(false)
    expect(wrapper.find('.java-runtime-row').exists()).toBe(true)
  })

  it('Java 任务继续由全局维护，管理列表不显示重复进度', async () => {
    const wrapper = await render()
    const operations = useApplicationOperationStore()
    operations.accept({ operationId: 'java-layout', kind: 'java_install', status: 'running', percent: 40 })
    await flushPromises()
    expect(wrapper.find('.java-operation-row').exists()).toBe(false)
    expect(operations.operations['java-layout']?.status).toBe('running')
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
  })
})
