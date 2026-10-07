import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { pinia } from '@/app/stores'
import { useTaskQueueStore } from '@/composables/useTaskQueue'
import { i18n } from '@/i18n'
import TitleBar from './TitleBar.vue'

vi.mock('/favicon.ico', () => ({ default: '/favicon.ico' }))

vi.mock('@/api/client', () => ({ default: { runtime: { isDesktop: true, isShowcase: false } } }))
vi.mock('@/app/runtime/desktopWindow', () => ({
  desktopWindow: { minimize: vi.fn(), close: vi.fn(), startDragging: vi.fn() },
}))
vi.mock('@/composables/useTheme', async () => {
  const { ref } = await import('vue')
  return { useTheme: () => ({ isDark: ref(false), toggleTheme: vi.fn() }) }
})
vi.mock('@/composables/useTopNav', async () => {
  const { ref } = await import('vue')
  return { useTopNav: () => ({ topNavEnabled: ref(false) }) }
})

enableAutoUnmount(afterEach)
beforeEach(() => {
  useTaskQueueStore(pinia).tasks = []
  i18n.global.locale.value = 'zh-CN'
})

it.each([
  [0, ''],
  [1, '1'],
  [12, '12'],
  [100, '99+'],
])('任务入口在 %s 个活动任务时显示 %s', async (count, expected) => {
  const queue = useTaskQueueStore(pinia)
  for (let index = 0; index < count; index++) {
    queue.addTask({ type: 'download', name: '下载文件', versionId: '', loaderType: '' })
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  const wrapper = mount(TitleBar, {
    global: { plugins: [i18n, router], stubs: { PluginSlotHost: true, TitleBarTray: true, UiIcon: true } },
  })
  expect(wrapper.get('.titlebar-btn-task').text()).toBe(expected)
  if (count === 0) expect(wrapper.find('.task-badge').exists()).toBe(false)
})
