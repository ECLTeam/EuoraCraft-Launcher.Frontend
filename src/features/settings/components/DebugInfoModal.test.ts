import { readFileSync } from 'node:fs'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { i18n } from '@/i18n'
import type { LauncherInfo } from '@/types/system'
import DebugInfoModal from './DebugInfoModal.vue'

const modalCss = readFileSync('src/styles/views/settings/DebugInfoModal.css', 'utf8')

const mocks = vi.hoisted(() => ({ getLauncherInfo: vi.fn<() => Promise<LauncherInfo | null>>() }))

vi.mock('/favicon.ico', () => ({ default: '/favicon.ico' }))
vi.mock('@/features/settings/api/aboutApi', () => ({ aboutApi: { getLauncherInfo: mocks.getLauncherInfo } }))

const launcherInfo: LauncherInfo = {
  version: '1.4.2-alpha.3+20260906',
  version_type: 'alpha',
  debug: true,
  active_window_chrome: 'custom',
  system_shadow_supported: true,
  system: {
    os_name: 'Windows 11',
    os_version: '10.0.26300',
    architecture: 'AMD64',
    python_version: '3.13.14',
    memory_total_mb: 32768,
  },
}

let wrapper: VueWrapper

function mountDialog(options: { visible?: boolean; debugEnabled?: boolean; runtimeMode?: string } = {}) {
  wrapper = mount(DebugInfoModal, {
    props: { visible: options.visible ?? true, debugEnabled: options.debugEnabled ?? true },
    global: {
      plugins: [i18n],
      provide: {
        launcherVersion: ref('1.4.2-alpha.3+20260906'),
        launcherVersionType: ref('alpha'),
        runtimeMode: options.runtimeMode ?? 'showcase',
      },
      stubs: {
        Modal: {
          name: 'Modal',
          props: { visible: Boolean, title: String, titlebarInteractive: Boolean },
          template: '<div class="modal-stub"><slot /><slot name="footer" /></div>',
        },
        UiIcon: true,
      },
    },
  })
  return wrapper
}

function fieldValue(label: string): string {
  const field = wrapper.findAll('.debug-info-modal__field').find((item) => item.get('dt').text() === label)
  if (!field) throw new Error(`字段缺失: ${label}`)
  return field.get('dd').text()
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.global.locale.value = 'zh-CN'
  mocks.getLauncherInfo.mockResolvedValue(launcherInfo)
})

afterEach(() => {
  wrapper?.unmount()
})

describe('调试信息弹窗', () => {
  it('展示后端返回的系统信息与启动器信息', async () => {
    mountDialog()
    await flushPromises()

    expect(wrapper.get('.debug-info-modal__version').text()).toBe('v1.4.2-alpha.3+20260906')
    expect(wrapper.get('.debug-info-modal__badge').text()).toBe('DEBUG')
    expect(fieldValue('操作系统')).toBe('Windows 11')
    expect(fieldValue('系统版本')).toBe('10.0.26300')
    expect(fieldValue('系统架构')).toBe('AMD64')
    expect(fieldValue('物理内存')).toBe('32.0 GB')
    expect(fieldValue('Python 版本')).toBe('3.13.14')
    expect(fieldValue('启动器版本')).toBe('v1.4.2-alpha.3+20260906')
    expect(fieldValue('版本类型')).toBe('开发版')
    expect(fieldValue('构建日期')).toBe('2026-09-06')
    expect(fieldValue('运行形态')).toBe('演示模式')
    expect(fieldValue('窗口模式')).toBe('自定义标题栏')
    expect(fieldValue('调试模式')).toBe('已开启')
  })

  it('后端不可用时用占位值补齐，不伪造系统信息', async () => {
    mocks.getLauncherInfo.mockResolvedValue(null)
    mountDialog({ runtimeMode: 'browser' })
    await flushPromises()

    expect(fieldValue('操作系统')).toBe('—')
    expect(fieldValue('物理内存')).toBe('—')
    expect(fieldValue('窗口模式')).toBe('—')
    expect(fieldValue('启动器版本')).toBe('v1.4.2-alpha.3+20260906')
    expect(fieldValue('运行形态')).toBe('浏览器模式')
  })

  it('调试模式未开启时不显示徽标并如实标注状态', async () => {
    mountDialog({ debugEnabled: false })
    await flushPromises()

    expect(wrapper.find('.debug-info-modal__badge').exists()).toBe(false)
    expect(fieldValue('调试模式')).toBe('未开启')
  })

  it('每次打开都重新读取运行信息', async () => {
    mountDialog({ visible: false })
    await flushPromises()
    expect(mocks.getLauncherInfo).not.toHaveBeenCalled()

    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(mocks.getLauncherInfo).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(mocks.getLauncherInfo).toHaveBeenCalledTimes(2)
  })

  it('关闭按钮同时收起弹窗并通知父组件', async () => {
    mountDialog()
    await flushPromises()

    const closeButton = wrapper.findAll('button').find((item) => item.text() === '关闭')
    if (!closeButton) throw new Error('关闭按钮缺失')
    await closeButton.trigger('click')

    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('弹窗打开时保留顶部栏拖动区域', async () => {
    mountDialog()
    await flushPromises()

    expect(wrapper.getComponent({ name: 'Modal' }).props('titlebarInteractive')).toBe(true)
  })

  it('弹窗内的启动器图标悬停同样顺时针旋转一圈', async () => {
    mountDialog()
    await flushPromises()

    expect(wrapper.find('.debug-info-modal__logo').exists()).toBe(true)
    expect(modalCss).toContain('.debug-info-modal__logo:hover {')
    expect(modalCss).toContain('transform: rotate(360deg);')
    expect(modalCss).toContain('transition: transform var(--duration-slower) var(--ease-emphasized);')
  })
})
