import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import { javaApi } from '@/features/java/api/javaApi'
import { i18n } from '@/i18n'
import type { JavaCatalog, JavaInstallPlan, JavaPackage } from '@/types/java'
import JavaDownloadModal from './JavaDownloadModal.vue'

vi.mock('@/api/client', async () => (await import('@/test/mockBackend')).createMockBackend().backend)
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}))
enableAutoUnmount(afterEach)

const candidate: JavaPackage = {
  packageId: 'b'.repeat(24),
  distributionSource: 'temurin',
  releaseName: 'jdk-21.0.2+1',
  majorVersion: 21,
  runtimeKind: 'JRE',
  platform: 'windows',
  architecture: 'x64',
  filename: 'java.zip',
  downloadBytes: 50_000_000,
  checksum: 'a'.repeat(64),
}
const catalog: JavaCatalog = {
  availableMajorVersions: [8, 17, 21, 25],
  recommendedMajorVersion: 25,
  majorVersion: 21,
  platform: 'windows',
  architecture: 'x64',
  packages: [candidate],
}
const plan: JavaInstallPlan = {
  planId: 'p'.repeat(32),
  package: candidate,
  installPath: 'C:/JavaManaged',
  estimatedFreeBytes: 300_000_000,
  expiresAt: 1_999_999_999,
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.spyOn(javaApi, 'catalog').mockResolvedValue(catalog)
  vi.spyOn(javaApi, 'plan').mockResolvedValue(plan)
  vi.spyOn(javaApi, 'install').mockResolvedValue({ operationId: 'java-operation', status: 'pending' })
})
afterEach(() => vi.restoreAllMocks())

async function render() {
  const wrapper = mount(JavaDownloadModal, {
    props: { visible: true, requiredMajor: 21 },
    global: {
      plugins: [i18n],
      stubs: {
        FullscreenModal: { props: ['title', 'closable', 'visible'], template: '<div><slot /></div>' },
        ConfirmDialog: true,
        UiIcon: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('Java 独立全屏下载', () => {
  it('全屏卡片呈现筛选和下载包，保留实例版本要求', async () => {
    const wrapper = await render()
    expect(wrapper.getComponent(FullscreenModal).props('title')).toBe('下载 Java')
    expect(javaApi.catalog).toHaveBeenCalledExactlyOnceWith(21, 'JRE', false)
    expect(wrapper.get('.java-download-card').find('.java-catalog-controls').exists()).toBe(true)
    expect(wrapper.get('.java-package-row').text()).toContain(candidate.releaseName)
    expect(wrapper.text()).toContain('需要 Java 21')
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
  })

  it('确认前不安装，取消后保留下载包并可重新确认', async () => {
    const wrapper = await render()
    await wrapper.get('.java-package-row button').trigger('click')
    await flushPromises()
    const confirm = wrapper.getComponent(ConfirmDialog)
    expect(confirm.props('visible')).toBe(true)
    expect(confirm.props('content')).toContain('C:/JavaManaged')
    expect(javaApi.install).not.toHaveBeenCalled()
    confirm.vm.$emit('update:visible', false)
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(javaApi.install).not.toHaveBeenCalled()
    await wrapper.get('.java-package-row button').trigger('click')
    await flushPromises()
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(javaApi.install).toHaveBeenCalledExactlyOnceWith(plan.planId)
    expect(confirm.props('visible')).toBe(false)
  })

  it('提交中拒绝重复确认，失败后确认框保留且可重试', async () => {
    let rejectInstall!: (error: Error) => void
    vi.mocked(javaApi.install).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectInstall = reject
        })
    )
    const wrapper = await render()
    await wrapper.get('.java-package-row button').trigger('click')
    await flushPromises()
    const confirm = wrapper.getComponent(ConfirmDialog)
    confirm.vm.$emit('confirm')
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(javaApi.install).toHaveBeenCalledTimes(1)
    expect(wrapper.getComponent(FullscreenModal).props('closable')).toBe(false)
    rejectInstall(new Error('下载暂不可用'))
    await flushPromises()
    expect(confirm.props('visible')).toBe(true)
    expect(confirm.props('loading')).toBe(false)
    confirm.vm.$emit('confirm')
    await flushPromises()
    expect(javaApi.install).toHaveBeenCalledTimes(2)
    expect(confirm.props('visible')).toBe(false)
  })

  it('筛选后不接受旧目录及旧安装计划响应', async () => {
    let resolvePlan!: (value: JavaInstallPlan) => void
    vi.mocked(javaApi.plan).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePlan = resolve
      })
    )
    const wrapper = await render()
    await wrapper.get('.java-package-row button').trigger('click')
    const selects = wrapper.findAllComponents(NSelect)
    let resolveOldCatalog!: (value: JavaCatalog) => void
    vi.mocked(javaApi.catalog).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOldCatalog = resolve
      })
    )
    selects[0]!.vm.$emit('update:value', 17)
    await flushPromises()
    vi.mocked(javaApi.catalog).mockResolvedValueOnce({ ...catalog, majorVersion: 25, packages: [] })
    selects[0]!.vm.$emit('update:value', 25)
    await flushPromises()
    resolveOldCatalog(catalog)
    resolvePlan(plan)
    await flushPromises()
    expect(wrapper.find('.java-package-row').exists()).toBe(false)
    expect(wrapper.getComponent(ConfirmDialog).props('visible')).toBe(false)
    expect(javaApi.install).not.toHaveBeenCalled()
  })

  it('关闭后旧计划不再确认，不取消应用任务', async () => {
    let resolvePlan!: (value: JavaInstallPlan) => void
    vi.mocked(javaApi.plan).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePlan = resolve
      })
    )
    const wrapper = await render()
    await wrapper.get('.java-package-row button').trigger('click')
    wrapper.getComponent(FullscreenModal).vm.$emit('close')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ visible: false })
    resolvePlan(plan)
    await flushPromises()
    expect(javaApi.install).not.toHaveBeenCalled()
    expect(wrapper.getComponent(ConfirmDialog).props('visible')).toBe(false)
  })

  it('目录失败可刷新重试，成功后显示空包状态', async () => {
    vi.mocked(javaApi.catalog).mockRejectedValueOnce(new Error('目录读取失败'))
    const wrapper = await render()
    expect(wrapper.get('.ui-empty-state').text()).toContain('目录读取失败')
    vi.mocked(javaApi.catalog).mockResolvedValueOnce({ ...catalog, packages: [] })
    await wrapper.get('.ui-empty-state button').trigger('click')
    await flushPromises()
    expect(javaApi.catalog).toHaveBeenLastCalledWith(21, 'JRE', true)
    expect(wrapper.get('.ui-empty-state').text()).toContain('没有此版本')
  })
})
