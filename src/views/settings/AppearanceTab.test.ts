import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pinia } from '@/app/stores'
import { useTheme } from '@/composables/useTheme'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { i18n } from '@/i18n'
import AppearanceTab from './AppearanceTab.vue'

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  return createMockBackend().backend
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn() }),
}))

let wrapper: VueWrapper

async function mountAppearance(): Promise<VueWrapper> {
  vi.spyOn(useSettingsStore(pinia), 'load').mockResolvedValue(undefined)
  wrapper = mount(AppearanceTab, {
    global: {
      plugins: [i18n, pinia],
      stubs: { PluginSlotHost: true, UiIcon: true, FontFamilySelect: true },
    },
  })
  await flushPromises()
  return wrapper
}

/** 按设置项左侧标签查找整行，用于断言「被隐藏」而不是「被禁用」 */
function rowByLabel(label: string) {
  return wrapper.findAll('.setting-item').find((row) => row.get('.setting-label').text().includes(label))
}

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
})

afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

describe('外观设置页', () => {
  it('高级字体默认收起，点击后展开并可再次收起', async () => {
    await mountAppearance()
    const toggle = wrapper.get('.font-advanced__toggle')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.font-advanced').classes()).not.toContain('is-open')
    // 收起时内容不可聚焦
    expect(wrapper.get('.collapsible-panel').attributes('inert')).toBeDefined()

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.font-advanced').classes()).toContain('is-open')
    expect(wrapper.get('.collapsible-panel').attributes('inert')).toBeUndefined()

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.font-advanced').classes()).not.toContain('is-open')
  })

  it('视频背景静音后隐藏音量调节，取消静音后恢复', async () => {
    await mountAppearance()
    // 挂载后 activePinia 已是应用实例，useTheme 解析到同一个主题 store
    const theme = useTheme()
    await theme.activateVideoBackground()
    theme.setBackgroundVideoOptions({ muted: false, volume: 0.6 }, false)
    await flushPromises()
    expect(rowByLabel('音量')).toBeTruthy()

    theme.setBackgroundVideoOptions({ muted: true }, false)
    await flushPromises()
    expect(rowByLabel('音量')).toBeUndefined()

    theme.setBackgroundVideoOptions({ muted: false }, false)
    await flushPromises()
    expect(rowByLabel('音量')).toBeTruthy()
  })

  it('窗口样式不是自定义标题栏时隐藏窗口圆角设置', async () => {
    await mountAppearance()
    const store = useSettingsStore(pinia)
    store.ui = { ...store.ui, theme: { ...store.ui.theme, window_chrome: 'custom' } }
    await flushPromises()
    expect(rowByLabel('窗口圆角')).toBeTruthy()

    store.ui = { ...store.ui, theme: { ...store.ui.theme, window_chrome: 'native' } }
    await flushPromises()
    expect(rowByLabel('窗口圆角')).toBeUndefined()

    // 其他窗口样式仍保留圆角以外的细节设置
    expect(rowByLabel('卡片圆角')).toBeTruthy()
  })
})
