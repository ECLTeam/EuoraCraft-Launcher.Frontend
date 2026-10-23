import { flushPromises, mount } from '@vue/test-utils'
import { NDropdown } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import { javaApi } from '@/features/java/api/javaApi'
import { i18n } from '@/i18n'
import { javaInventory, javaRuntime } from '@/test/javaFixtures'
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

async function render() {
  const wrapper = mount(JavaManagerPanel, {
    global: { plugins: [createPinia(), i18n], stubs: { Teleport: true, ConfirmDialog: true, UiIcon: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('Java 管理与拥有权提示', () => {
  it('空清单提供下载入口，只切换视图而不提交安装', async () => {
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
    expect(wrapper.find('.java-catalog-controls').exists()).toBe(true)
    expect(wrapper.get('.java-manager-tabs button[aria-pressed="true"]').text()).toBe('下载')
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
    expect(wrapper.get('.java-runtime-location summary').attributes('title')).toBe(executablePath)
    expect(wrapper.get('.java-runtime-full-path').text()).toBe(executablePath)
    const actions = wrapper.get('.java-runtime-actions')
    expect(actions.text()).toContain('设为全局 Java')
    expect(actions.text()).toContain('更多')
    expect(actions.findAll('button').some((button) => button.text() === '停用')).toBe(false)
    expect(actions.findAll('button').some((button) => button.text() === '移除登记')).toBe(false)
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

  it('先审阅不可变安装计划，确认后才提交后台安装', async () => {
    vi.mocked(javaApi.inventory).mockResolvedValue(javaInventory())
    const candidate = {
      packageId: 'b'.repeat(24),
      distributionSource: 'temurin' as const,
      releaseName: 'jdk-21.0.2+1',
      majorVersion: 21,
      runtimeKind: 'JRE' as const,
      platform: 'windows',
      architecture: 'x64',
      filename: 'java.zip',
      downloadBytes: 50_000_000,
      checksum: 'a'.repeat(64),
    }
    vi.spyOn(javaApi, 'catalog').mockResolvedValue({
      availableMajorVersions: [8, 17, 21, 25],
      recommendedMajorVersion: 25,
      majorVersion: 21,
      platform: 'windows',
      architecture: 'x64',
      packages: [candidate],
    })
    vi.spyOn(javaApi, 'plan').mockResolvedValue({
      planId: 'p'.repeat(32),
      package: candidate,
      installPath: 'C:/JavaManaged',
      estimatedFreeBytes: 300_000_000,
      expiresAt: 1_999_999_999,
    })
    const install = vi.spyOn(javaApi, 'install').mockResolvedValue({ operationId: 'java-operation', status: 'pending' })
    const wrapper = await render()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '下载')!
      .trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '下载并安装')!
      .trigger('click')
    await flushPromises()
    expect(install).not.toHaveBeenCalled()
    expect(wrapper.getComponent(ConfirmDialog).props('content')).toContain('C:/JavaManaged')
    wrapper.getComponent(ConfirmDialog).vm.$emit('confirm')
    await flushPromises()
    expect(install).toHaveBeenCalledWith('p'.repeat(32))
  })
})
