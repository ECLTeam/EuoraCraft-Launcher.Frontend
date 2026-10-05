import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    global: { plugins: [createPinia(), i18n], stubs: { Teleport: true, ConfirmDialog: true } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('Java 管理与拥有权提示', () => {
  it('在用且被设置引用的运行时保留条目，并禁用物理移除', async () => {
    const wrapper = await render()
    expect(wrapper.text()).toContain('使用中')
    expect(wrapper.text()).toContain('已被 1 项设置引用')
    const remove = wrapper.findAll('button').find((button) => button.text() === '移除安装')!
    expect(remove.attributes('disabled')).toBeDefined()
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
