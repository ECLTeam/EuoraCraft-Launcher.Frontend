import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { URLS } from '@/config/urls'
import { i18n } from '@/i18n'
import type { PluginInfo } from '@/types/plugins'
import { openExternalUrl } from '@/utils/openExternal'
import AboutTab from './AboutTab.vue'

const debugModeMock = vi.hoisted(() => ({
  enabledRef: null as null | { value: boolean },
  setDebugMode: vi.fn<(value: boolean) => Promise<void>>(),
}))

const pluginStoreMock = vi.hoisted(() => ({
  state: null as null | { plugins: PluginInfo[] },
  load: vi.fn<() => Promise<void>>(),
}))

vi.mock('/favicon.ico', () => ({ default: '/favicon.ico' }))
vi.mock('@/utils/openExternal', () => ({ openExternalUrl: vi.fn() }))
vi.mock('@/app/data', () => ({ launcherInfoQuery: vi.fn().mockResolvedValue(null) }))
vi.mock('@/features/plugins/stores/pluginStore', async () => {
  const { reactive } = await import('vue')
  pluginStoreMock.state = reactive({ plugins: [] as PluginInfo[] })
  pluginStoreMock.load.mockResolvedValue(undefined)
  // 组件读取 state.plugins 并调用 state.load；把 load 并入同一对象模拟 setup store 的解包形态。
  return { usePluginStore: () => Object.assign(pluginStoreMock.state!, { load: pluginStoreMock.load }) }
})
vi.mock('@/composables/useDebugMode', async () => {
  const { computed, ref } = await import('vue')
  debugModeMock.enabledRef = ref(false)
  return {
    useDebugMode: () => ({
      debugMode: computed(() => debugModeMock.enabledRef!.value),
      setDebugMode: debugModeMock.setDebugMode,
    }),
  }
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({
    loading: vi.fn(() => ({ destroy: vi.fn() })),
    success: vi.fn(),
    info: vi.fn(() => ({ destroy: vi.fn() })),
    error: vi.fn(),
  }),
}))
vi.mock('@/features/settings/composables/useUpdateCheck', async () => {
  const { ref } = await import('vue')
  return {
    useUpdateCheck: () => ({
      lastResult: ref(null),
      checking: ref(false),
      checkUpdate: vi.fn(),
      updateDialogVisible: ref(false),
    }),
  }
})

enableAutoUnmount(afterEach)

const DebugInfoModalStub = defineComponent({
  name: 'DebugInfoModal',
  props: { visible: Boolean, debugEnabled: Boolean },
  emits: ['update:visible'],
  template: '<div class="debug-info-modal-stub" />',
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  debugModeMock.enabledRef!.value = false
  pluginStoreMock.state!.plugins = []
  debugModeMock.setDebugMode.mockImplementation(async (value: boolean) => {
    debugModeMock.enabledRef!.value = value
  })
  i18n.global.locale.value = 'zh-CN'
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mountAboutTab() {
  return mount(AboutTab, {
    global: {
      plugins: [i18n],
      provide: { launcherVersion: ref(''), launcherVersionType: ref('release') },
      stubs: { AboutEntryRow: true, UiIcon: true, PluginSlotHost: true, DebugInfoModal: DebugInfoModalStub },
    },
  })
}

it('六张卡片标题均使用对应的本地图标并保留标题文字', () => {
  const wrapper = mountAboutTab()
  const titles = wrapper.findAll('.about-card > .card-title')
  expect(titles).toHaveLength(6)
  expect(titles.map((title) => title.get('ui-icon-stub').attributes('name'))).toEqual([
    'info',
    'users',
    'star',
    'user',
    'layers',
    'shield',
  ])
  expect(titles.every((title) => title.text().trim().length > 0)).toBe(true)
})

it('技术栈通过公共折叠面板独立展开和收起，隐藏内容不能聚焦', async () => {
  const wrapper = mountAboutTab()
  const categories = wrapper.findAll('.technology-category')
  const first = categories[0]!
  const second = categories[1]!
  const toggle = first.get('button')
  const panel = first.get('.collapsible-panel')
  expect(toggle.attributes('aria-expanded')).toBe('false')
  expect(toggle.attributes('aria-controls')).toBe(panel.attributes('id'))
  expect(panel.attributes('inert')).toBeDefined()
  expect(panel.classes()).not.toContain('is-open')
  await toggle.trigger('click')
  expect(toggle.attributes('aria-expanded')).toBe('true')
  expect(panel.classes()).toContain('is-open')
  expect(panel.attributes('inert')).toBeUndefined()
  expect(first.findAll('about-entry-row-stub').length).toBeGreaterThan(0)
  expect(second.get('.collapsible-panel').classes()).not.toContain('is-open')
  await second.get('button').trigger('click')
  await toggle.trigger('click')
  expect(toggle.attributes('aria-expanded')).toBe('false')
  expect(panel.attributes('inert')).toBeDefined()
  expect(second.get('.collapsible-panel').classes()).toContain('is-open')
})

it('关于页文档入口使用集中定义的文档链接及原外部打开方式', async () => {
  const wrapper = mountAboutTab()
  await flushPromises()
  const link = wrapper.get(`a[href="${URLS.docs}"]`)
  expect(link.text()).toBe('文档')
  await link.trigger('click')
  expect(openExternalUrl).toHaveBeenCalledWith(URLS.docs)
})

it('社区贡献者卡片位于鸣谢与技术栈之间，加载时保留感谢文案', async () => {
  const wrapper = mountAboutTab()
  await nextTick()
  const titles = wrapper.findAll('.about-card > .card-title').map((title) => title.text())
  const contributorsIndex = titles.indexOf('社区贡献者')
  expect(contributorsIndex).toBeGreaterThan(0)
  expect(titles[contributorsIndex - 1]).toBe('特别鸣谢')
  expect(titles[contributorsIndex + 1]).toBe('技术栈')
  const card = wrapper.get('.community-contributors')
  expect(card.get('.contributors-message').text()).toBe('感谢所有社区贡献者对 EuoraCraft Launcher 的贡献！')
  const image = card.get('img')
  expect(image.attributes('src')).toBe('https://contrib.rocks/image?repo=ECLTeam/EuoraCraft-Launcher')
  expect(image.attributes('alt')).toBe('EuoraCraft Launcher 社区贡献者头像')
  expect(image.attributes('style')).toContain('display: none')
  expect(card.get('[role="status"]').text()).toContain('正在加载贡献者')
  expect(card.find('button').exists()).toBe(false)
})

it('图片加载成功后展示头像并结束等待，不会被稍后的超时改变', async () => {
  const wrapper = mountAboutTab()
  await nextTick()
  const card = wrapper.get('.community-contributors')
  await card.get('img').trigger('load')
  expect(card.get('img').attributes('style')).not.toContain('display: none')
  expect(card.find('[role="status"]').exists()).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(20_000)
  expect(card.get('img').attributes('style')).not.toContain('display: none')
})

it('失败后可以重试，连续点击只开始一轮，旧图片事件不影响新结果', async () => {
  const wrapper = mountAboutTab()
  await nextTick()
  const card = wrapper.get('.community-contributors')
  const oldImage = card.get('img').element
  await card.get('img').trigger('error')
  expect(card.find('img').exists()).toBe(false)
  expect(card.text()).toContain('贡献者图片暂时无法加载')
  expect(card.get('.contributors-message').isVisible()).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
  const retry = card.get('button')
  expect(retry.attributes('type')).toBe('button')
  expect(retry.text()).toBe('重试')
  await Promise.all([retry.trigger('click'), retry.trigger('click')])
  expect(card.findAll('img')).toHaveLength(1)
  expect(card.get('img').element).not.toBe(oldImage)
  expect(card.get('img').attributes('src')).toBe(URLS.contributorsImage)
  expect(vi.getTimerCount()).toBe(1)
  oldImage.dispatchEvent(new Event('load'))
  oldImage.dispatchEvent(new Event('error'))
  await nextTick()
  expect(card.get('img').attributes('style')).toContain('display: none')
  expect(card.get('[role="status"]').text()).toContain('正在加载贡献者')
  await card.get('img').trigger('load')
  oldImage.dispatchEvent(new Event('error'))
  await nextTick()
  expect(card.get('img').attributes('style')).not.toContain('display: none')
  expect(card.find('button').exists()).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('单次加载等待最多二十秒，超时后允许重试', async () => {
  const wrapper = mountAboutTab()
  await nextTick()
  const card = wrapper.get('.community-contributors')
  await vi.advanceTimersByTimeAsync(19_999)
  expect(card.find('button').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(card.find('img').exists()).toBe(false)
  expect(card.text()).toContain('贡献者图片暂时无法加载')
  await card.get('button').trigger('click')
  expect(card.get('[role="status"]').text()).toContain('正在加载贡献者')
  await card.get('img').trigger('load')
  expect(card.get('img').attributes('style')).not.toContain('display: none')
})

it('图片已从缓存加载时直接显示，不遗留计时器', async () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(336)
  const wrapper = mountAboutTab()
  await nextTick()
  const card = wrapper.get('.community-contributors')
  expect(card.get('img').attributes('style')).not.toContain('display: none')
  expect(card.find('[role="status"]').exists()).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('离开页面清理等待计时器，已移除图片的事件不会重启等待', async () => {
  const wrapper = mountAboutTab()
  await nextTick()
  const image = wrapper.get('.community-contributors img').element
  expect(vi.getTimerCount()).toBe(1)
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
  image.dispatchEvent(new Event('load'))
  image.dispatchEvent(new Event('error'))
  await vi.advanceTimersByTimeAsync(20_000)
  expect(vi.getTimerCount()).toBe(0)
})

it('启动器图标是可点击按钮并带无障碍名称', async () => {
  const wrapper = mountAboutTab()
  const icon = wrapper.get('.launcher-summary__logo-cell')
  expect(icon.element.tagName).toBe('BUTTON')
  expect(icon.attributes('type')).toBe('button')
  expect(icon.attributes('aria-label')).toBe('EuoraCraft Launcher 图标')
  // 未开启调试模式时不带旋转标记，图标保持静态
  expect(icon.classes()).not.toContain('is-debug')
  expect(wrapper.getComponent(DebugInfoModalStub).props('visible')).toBe(false)
})

it('连续点击图标七次开启调试模式并打开调试信息弹窗', async () => {
  const wrapper = mountAboutTab()
  await flushPromises()
  const icon = wrapper.get('.launcher-summary__logo-cell')

  for (let index = 0; index < 6; index += 1) await icon.trigger('click')
  await flushPromises()
  expect(debugModeMock.setDebugMode).not.toHaveBeenCalled()
  expect(wrapper.getComponent(DebugInfoModalStub).props('visible')).toBe(false)

  await icon.trigger('click')
  await flushPromises()
  expect(debugModeMock.setDebugMode).toHaveBeenCalledWith(true)
  expect(wrapper.getComponent(DebugInfoModalStub).props('visible')).toBe(true)
  expect(wrapper.getComponent(DebugInfoModalStub).props('debugEnabled')).toBe(true)
  // 开启后图标才带旋转标记
  expect(icon.classes()).toContain('is-debug')
})

it('调试模式已开启时单击图标直接打开调试信息弹窗', async () => {
  debugModeMock.enabledRef!.value = true
  const wrapper = mountAboutTab()
  await flushPromises()

  await wrapper.get('.launcher-summary__logo-cell').trigger('click')
  await flushPromises()

  expect(debugModeMock.setDebugMode).not.toHaveBeenCalled()
  expect(wrapper.getComponent(DebugInfoModalStub).props('visible')).toBe(true)
  expect(wrapper.get('.launcher-summary__logo-cell').classes()).toContain('is-debug')
})

const enabledPlugin: PluginInfo = {
  name: 'example-plugin',
  title: '示例插件',
  version: '1.0.0',
  description: '独立提供示例能力。',
  author: 'ECLTeam',
  homepage: 'https://github.com/ECLTeam/ECL-Plugin-Example',
  license: 'GPL-3.0',
  icon: '',
  status: 'enabled',
  error: null,
  dependencies: {},
  services: [],
  is_system: false,
}

const disabledPlugin: PluginInfo = { ...enabledPlugin, name: 'disabled-plugin', status: 'disabled' }

it('已启用的插件在关于页只读展示，禁用插件不出现', async () => {
  pluginStoreMock.state!.plugins = [enabledPlugin, disabledPlugin]
  const wrapper = mountAboutTab()
  await flushPromises()
  const card = wrapper.get('.about-plugins')
  const rows = card.findAll('.about-plugin-row')
  expect(rows).toHaveLength(1)
  expect(rows[0]!.text()).toContain('示例插件')
  expect(rows[0]!.text()).toContain('v1.0.0')
  expect(rows[0]!.text()).toContain('ECLTeam')
  expect(rows[0]!.text()).toContain('独立提供示例能力。')
  expect(rows[0]!.text()).toContain('GPL-3.0')
  await rows[0]!.get('.about-plugin-row__action').trigger('click')
  expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/ECLTeam/ECL-Plugin-Example')
})

it('没有启用插件时不渲染插件卡片，加载失败也不阻塞页面', async () => {
  pluginStoreMock.state!.plugins = [disabledPlugin]
  pluginStoreMock.load.mockRejectedValueOnce(new Error('boom'))
  const wrapper = mountAboutTab()
  await flushPromises()
  expect(wrapper.find('.about-plugins').exists()).toBe(false)
  // 其余卡片照常渲染
  expect(wrapper.findAll('.about-card > .card-title').length).toBe(6)
})

it('主页链接仅在 http(s) 地址时渲染，其他值被忽略', async () => {
  pluginStoreMock.state!.plugins = [{ ...enabledPlugin, homepage: 'javascript:alert(1)' }]
  const wrapper = mountAboutTab()
  await flushPromises()
  expect(wrapper.get('.about-plugins').find('.about-plugin-row__action').exists()).toBe(false)
})
