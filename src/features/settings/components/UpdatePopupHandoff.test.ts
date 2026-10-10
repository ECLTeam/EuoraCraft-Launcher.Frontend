import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import type { LauncherPopup } from '@/app/runtime/useLauncherPopupQueue'
import LauncherPopupModal from '@/components/modals/LauncherPopupModal.vue'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import { i18n } from '@/i18n'
import UpdateResultModal from './UpdateResultModal.vue'

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  return createMockBackend().backend
})
vi.mock('../composables/useUpdateCheck', () => ({ useUpdateCheck: () => updateState }))

const updateState = {
  lastResult: ref({
    status: 'update_available',
    current_version: '0.0.1-alpha',
    latest_version: '0.1.0-beta.2',
    latest_url: 'https://example.com/release',
    latest_notes: '回归测试',
  }),
  selfUpdateEnabled: ref(false),
  downloading: ref(false),
  downloadPercent: ref(-1),
  downloadUpdate: vi.fn(),
  applyUpdate: vi.fn(),
}

describe('更新与配置警告的退场交接', () => {
  afterEach(() => globalModalStack.reset())

  it.each(['update-first', 'warning-first', 'same-tick'] as const)(
    '%s 时独立弹窗等待真实退场且隐藏不记已读',
    async (order) => {
      const updateVisible = ref(order !== 'warning-first')
      const warningVisible = ref(order !== 'update-first')
      const rememberUpdate = vi.fn()
      const warning: LauncherPopup = {
        id: 'microsoft-client-id-required',
        title: 'Microsoft client_id 未配置',
        content: '正版登录需要配置 client_id。',
        level: 'warning',
        priority: 75,
        source: 'launcher',
        dismissible: true,
        cacheable: true,
        once: false,
        seq: 0,
      }
      const host = defineComponent({
        components: { LauncherPopupModal, UpdateResultModal },
        setup: () => ({ updateVisible, warningVisible, warning, rememberUpdate }),
        template: `
        <UpdateResultModal v-model:visible="updateVisible" @close="rememberUpdate" />
        <LauncherPopupModal :visible="warningVisible" :popup="warning" @dismiss="warningVisible = false" />
      `,
      })
      const wrapper = mount(host, {
        attachTo: document.body,
        global: { plugins: [i18n], stubs: { transition: false } },
      })
      try {
        await nextTick()
        const update = document
          .querySelector<HTMLElement>('.update-result-modal-container')!
          .closest<HTMLElement>('.modal-overlay')!
        const warningOverlay = document
          .querySelector<HTMLElement>('.launcher-popup-modal')!
          .closest<HTMLElement>('.modal-overlay')!
        if (order === 'update-first') {
          warningVisible.value = true
          await nextTick()
          expect(warningOverlay.style.display).toBe('none')
          await vi.waitFor(() => expect(warningOverlay.style.display).not.toBe('none'))
        } else if (order === 'warning-first') {
          updateVisible.value = true
          await nextTick()
        } else {
          await vi.waitFor(() => expect(warningOverlay.style.display).not.toBe('none'))
        }
        expect(update.style.display).toBe('none')
        expect(warningOverlay.style.display).not.toBe('none')
        expect(rememberUpdate).not.toHaveBeenCalled()
        const confirm = [...warningOverlay.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
          button.textContent?.includes('确定')
        )!
        confirm.click()
        await nextTick()
        expect(update.style.display).toBe('none')
        await vi.waitFor(() => expect(update.style.display).not.toBe('none'))
        expect(warningOverlay.style.display).toBe('none')
        expect(rememberUpdate).not.toHaveBeenCalled()
        const later = [...update.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
          button.textContent?.includes('稍后')
        )!
        later.click()
        await nextTick()
        expect(rememberUpdate).toHaveBeenCalledOnce()
      } finally {
        wrapper.unmount()
      }
    }
  )
})
