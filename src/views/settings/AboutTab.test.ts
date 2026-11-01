import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { URLS } from '@/config/urls'
import { i18n } from '@/i18n'
import { openExternalUrl } from '@/utils/openExternal'
import AboutTab from './AboutTab.vue'

const debugModeMock = vi.hoisted(() => ({
  enabledRef: null as null | { value: boolean },
  setDebugMode: vi.fn<(value: boolean) => Promise<void>>(),
}))

vi.mock('/favicon.ico', () => ({ default: '/favicon.ico' }))
vi.mock('@/utils/openExternal', () => ({ openExternalUrl: vi.fn() }))
vi.mock('@/app/data', () => ({ launcherInfoQuery: vi.fn().mockResolvedValue(null) }))
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
