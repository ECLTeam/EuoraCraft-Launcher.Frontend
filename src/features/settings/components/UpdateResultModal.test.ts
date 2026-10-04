import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { i18n } from '@/i18n'
import type { UpdateCheckResult } from '@/types/system'
import { openExternalUrl } from '@/utils/openExternal'
import UpdateResultModal from './UpdateResultModal.vue'

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  return createMockBackend().backend
})
vi.mock('@/utils/openExternal', () => ({ openExternalUrl: vi.fn() }))
vi.mock('../composables/useUpdateCheck', () => ({ useUpdateCheck: () => state }))
const messages = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  loading: vi.fn(() => ({ destroy: vi.fn() })),
}))
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => messages }))

const state = {
  lastResult: ref<UpdateCheckResult | null>(null),
  selfUpdateEnabled: ref(false),
  downloading: ref(false),
  downloadPercent: ref(-1),
  downloadUpdate: vi.fn<() => Promise<string | null>>(),
  applyUpdate: vi.fn<() => Promise<boolean>>(),
}

let wrapper: VueWrapper
function mountDialog() {
  wrapper = mount(UpdateResultModal, {
    props: { visible: true },
    global: {
      plugins: [i18n],
      stubs: {
        Modal: {
          name: 'Modal',
          props: ['visible', 'title', 'closable'],
          template: '<div><slot /><footer><slot name="footer" /></footer></div>',
        },
      },
    },
  })
  return wrapper
}

function button(label: string) {
  const match = wrapper.findAll('button').find((item) => item.text().includes(label))
  if (!match) throw new Error(`Button missing: ${label}`)
  return match
}

describe('更新弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
    state.lastResult.value = {
      status: 'update_available',
      current_version: '0.0.1-alpha',
      channel: 'release',
      latest_version: '0.1.0-beta.2+20260919',
      latest_url: 'https://example.com/releases/0.1.0',
      latest_notes: '   ',
      message: null,
    }
    state.selfUpdateEnabled.value = false
    state.downloading.value = false
    state.downloadPercent.value = -1
    state.downloadUpdate.mockResolvedValue('0.1.0')
    state.applyUpdate.mockResolvedValue(true)
  })

  afterEach(() => wrapper?.unmount())

  it('无说明时显示空状态，并按目标版本显示通道', async () => {
    mountDialog()
    expect(wrapper.get('.update-result-modal__notes-empty').text()).toContain('暂未提供更新说明')
    expect(wrapper.get('.update-result-modal__channel').text()).toBe('测试版')
    expect(wrapper.get('.update-result-modal__version').text()).toBe('0.1.0-beta.2+20260919')
    await button('查看发布页').trigger('click')
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/releases/0.1.0')
    expect(state.downloadUpdate).not.toHaveBeenCalled()
  })

  it.each([null, 'javascript:alert(1)'])('发布页地址 %s 不可用时不显示无效主按钮', (url) => {
    state.lastResult.value!.latest_url = url
    mountDialog()
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.get('.update-result-modal__unavailable').text()).toContain('暂未提供发布页链接')
  })

  it('稍后关闭弹窗并发出已读记录所需的关闭事件', async () => {
    mountDialog()
    await button('稍后').trigger('click')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('下载大小未知时仍显示进度状态并锁定关闭操作', () => {
    state.selfUpdateEnabled.value = true
    state.downloading.value = true
    mountDialog()
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
    expect(wrapper.find('.is-indeterminate').exists()).toBe(true)
    expect(button('稍后').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent({ name: 'Modal' }).props('closable')).toBe(false)
  })

  it('下载结束到应用更新之间继续锁定操作，避免重复下载', async () => {
    state.selfUpdateEnabled.value = true
    let finishApply!: (value: boolean) => void
    state.applyUpdate.mockImplementation(() => new Promise((resolve) => (finishApply = resolve)))
    mountDialog()
    await button('下载并重启').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'Modal' }).props('closable')).toBe(false)
    await button('正在更新').trigger('click')
    expect(state.downloadUpdate).toHaveBeenCalledTimes(1)
    finishApply(true)
    await flushPromises()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it.each(['download', 'apply'])('%s 失败后恢复操作并保持说明可见', async (failure) => {
    state.selfUpdateEnabled.value = true
    if (failure === 'download') state.downloadUpdate.mockResolvedValue(null)
    else state.applyUpdate.mockResolvedValue(false)
    state.lastResult.value!.latest_notes = '修复启动兼容性\n改善更新界面'
    mountDialog()
    await button('下载并重启').trigger('click')
    await flushPromises()
    expect(messages.error).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(button('稍后').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.update-result-modal__notes-content').text()).toContain('修复启动兼容性')
  })
})
