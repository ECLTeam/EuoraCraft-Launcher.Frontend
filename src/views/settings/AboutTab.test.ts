import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { URLS } from '@/config/urls'
import { i18n } from '@/i18n'
import { openExternalUrl } from '@/utils/openExternal'
import AboutTab from './AboutTab.vue'

vi.mock('/favicon.ico', () => ({ default: '/favicon.ico' }))
vi.mock('@/utils/openExternal', () => ({ openExternalUrl: vi.fn() }))
vi.mock('@/features/settings/api/aboutApi', () => ({ aboutApi: { getLauncherInfo: vi.fn().mockResolvedValue(null) } }))
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
it('关于页文档入口使用集中定义的文档链接及原外部打开方式', async () => {
  i18n.global.locale.value = 'zh-CN'
  const wrapper = mount(AboutTab, {
    global: { plugins: [i18n], stubs: { AboutEntryRow: true, UiIcon: true, PluginSlotHost: true } },
  })
  await flushPromises()
  const link = wrapper.get(`a[href="${URLS.docs}"]`)
  expect(link.text()).toBe('文档')
  await link.trigger('click')
  expect(openExternalUrl).toHaveBeenCalledWith(URLS.docs)
})
