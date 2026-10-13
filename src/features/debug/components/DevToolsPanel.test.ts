import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { pinia } from '@/app/stores'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import { i18n } from '@/i18n'
import DevTools from './DevToolsPanel.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/settings/about', name: 'settings-about', query: {}, params: {} }),
}))

const mocks = vi.hoisted(() => ({
  resetLauncherData: vi.fn(),
  clearPlugins: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/features/settings/api/debugToolsApi', () => ({
  debugToolsApi: {
    resetLauncherData: mocks.resetLauncherData,
    clearPlugins: mocks.clearPlugins,
  },
}))

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({
    info: vi.fn(),
    success: mocks.success,
    warning: vi.fn(),
    error: mocks.error,
  }),
}))

function mountDevTools() {
  return mount(DevTools, {
    attachTo: document.body,
    global: {
      plugins: [i18n, pinia],
      mocks: {
        $router: { push: vi.fn() },
      },
      stubs: {
        UiIcon: true,
      },
    },
  })
}

describe('DevTools danger actions', () => {
  it('真实调试嵌套窗口保留父全屏，关闭父级同时清理子窗口', async () => {
    const wrapper = mountDevTools()
    try {
      const fullscreenButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('dev.fullscreenModal'))!
      await fullscreenButton.trigger('click')
      await flushPromises()
      const parent = document.querySelector<HTMLElement>('.fullscreen-modal')!
      const trigger = [...parent.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.includes(i18n.global.t('dev.openNested'))
      )!
      trigger.click()
      await flushPromises()
      expect(parent.style.display).not.toBe('none')
      expect(parent.hasAttribute('inert')).toBe(true)
      expect(globalModalStack.displayedModalIds.value).toHaveLength(2)
      const parentComponent = wrapper.findComponent({ name: 'FullscreenModal' })
      parentComponent.vm.$emit('update:visible', false)
      await flushPromises()
      expect(globalModalStack.hasActiveOverlay.value).toBe(false)
    } finally {
      wrapper.unmount()
      globalModalStack.reset()
    }
  })
  it('二次确认后安排还原启动器数据', async () => {
    mocks.resetLauncherData.mockResolvedValue({
      action: 'reset_launcher_data',
      restart_required: true,
      targets: ['setting.json', 'info_card.json', 'notice.json'],
    })
    const wrapper = mountDevTools()
    const resetButton = wrapper.findAll('.danger-action-card button')[0]

    await resetButton?.trigger('click')
    const confirmButtons = document.body.querySelectorAll('.modal-footer button:last-child')
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mocks.resetLauncherData).toHaveBeenCalledOnce()
    expect(mocks.success).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('取消确认时不会执行清理插件', async () => {
    const wrapper = mountDevTools()
    const clearPluginsButton = wrapper.findAll('.danger-action-card button')[1]

    await clearPluginsButton?.trigger('click')
    const cancelButtons = document.body.querySelectorAll('.modal-footer button:first-child')
    const cancelButton = cancelButtons[cancelButtons.length - 1]
    cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(mocks.clearPlugins).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
