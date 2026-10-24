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

  it('渲染 Markdown 标题、列表和代码，并通过系统浏览器打开外部链接', async () => {
    state.lastResult.value!.latest_notes =
      '## 新增功能\n\n- 支持 **整合包** 和 `Java`\n\n[完整日志](https://example.com/changelog)'
    mountDialog()
    const notes = wrapper.get('.update-result-modal__notes-content')
    expect(notes.get('h2').text()).toBe('新增功能')
    expect(notes.get('li strong').text()).toBe('整合包')
    expect(notes.get('li code').text()).toBe('Java')
    await notes.get('a').trigger('click')
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.com/changelog')
  })

  it('过滤说明中的脚本、事件处理器和危险链接', async () => {
    state.lastResult.value!.latest_notes =
      '正常说明\n\n<script>alert(1)</script><img src="invalid" onerror="alert(2)">\n\n[危险链接](javascript:alert(3))'
    mountDialog()
    const notes = wrapper.get('.update-result-modal__notes-content')
    expect(notes.text()).toContain('正常说明')
    expect(notes.find('script').exists()).toBe(false)
    expect(notes.find('[onerror]').exists()).toBe(false)
    expect(notes.find('a[href^="javascript:"]').exists()).toBe(false)
    expect(openExternalUrl).not.toHaveBeenCalled()
  })

  it('保留纯文本换行，并在检测结果变化后显示新的 Markdown 内容', async () => {
    state.lastResult.value!.latest_notes = '第一行\n第二行'
    mountDialog()
    expect(wrapper.find('.update-result-modal__notes-content br').exists()).toBe(true)
    state.lastResult.value!.latest_notes = '### 修复\n\n- 新的说明'
    await flushPromises()
    expect(wrapper.get('.update-result-modal__notes-content h3').text()).toBe('修复')
    expect(wrapper.get('.update-result-modal__notes-content li').text()).toBe('新的说明')
    expect(wrapper.get('.update-result-modal__notes-content').text()).not.toContain('第一行')
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
