import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { pinia } from '@/app/stores'
import { useLayoutStore } from '@/app/stores/layoutStore'
import { useFullscreenModal } from '@/composables/useFullscreenModal'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import { i18n } from '@/i18n'
import FullscreenModal from './FullscreenModal.vue'
import Modal from './Modal.vue'

function createHost(options: { template: string; setup: () => object }) {
  return defineComponent({ components: { Modal, FullscreenModal }, ...options })
}

describe('FullscreenModal', () => {
  afterEach(() => {
    globalModalStack.reset()
    document.body.innerHTML = ''
  })

  it('关闭子弹窗后恢复已经打开的父弹窗', async () => {
    const accountVisible = ref(true)
    const taskVisible = ref(false)
    const host = createHost({
      setup: () => ({ accountVisible, taskVisible }),
      template: `
        <FullscreenModal v-model:visible="accountVisible" title="账户管理">
          <div>账户内容</div>
        </FullscreenModal>
        <FullscreenModal v-model:visible="taskVisible" title="任务列表">
          <div>任务内容</div>
        </FullscreenModal>
      `,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { stubs: { transition: false } } })
    await nextTick()

    taskVisible.value = true
    await nextTick()

    expect(accountVisible.value).toBe(true)
    expect(taskVisible.value).toBe(true)
    expect(globalModalStack.interactiveModalId.value).toBeNull()
    await vi.waitFor(() => expect(useFullscreenModal().title.value).toBe('任务列表'))

    const visibleModals = Array.from(document.body.querySelectorAll<HTMLElement>('.fullscreen-modal')).filter(
      (modal) => modal.style.display !== 'none'
    )
    expect(visibleModals).toHaveLength(1)
    expect(visibleModals[0]?.textContent).toContain('任务内容')

    taskVisible.value = false
    await nextTick()

    expect(accountVisible.value).toBe(true)
    await vi.waitFor(() => expect(useFullscreenModal().title.value).toBe('账户管理'))

    wrapper.unmount()
  })

  it('添加账户覆盖时父全屏保持显示、标题和布局稳定，只有子弹窗处理 Esc', async () => {
    const accountVisible = ref(true)
    const addVisible = ref(false)
    const host = createHost({
      setup: () => ({ accountVisible, addVisible }),
      template: `
        <FullscreenModal v-model:visible="accountVisible" title="账户管理">
          <button id="add-account" @click="addVisible = true">添加账户</button>
          <Modal v-model:visible="addVisible" title="添加账户"><input /></Modal>
        </FullscreenModal>
      `,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: [i18n], stubs: { transition: false } } })
    await nextTick()
    const parent = document.querySelector<HTMLElement>('.fullscreen-modal')!
    const trigger = document.querySelector<HTMLButtonElement>('#add-account')!
    trigger.focus()
    trigger.click()
    await nextTick()
    await nextTick()
    expect(parent.style.display).not.toBe('none')
    expect(parent.hasAttribute('inert')).toBe(true)
    expect(parent.getAttribute('aria-modal')).toBe('false')
    expect(useFullscreenModal().title.value).toBe('账户管理')
    expect(useLayoutStore(pinia).modalPageSlideOut).toBe(true)
    expect(document.querySelector('.modal-overlay')?.contains(document.activeElement)).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(addVisible.value).toBe(false)
    expect(accountVisible.value).toBe(true)
    expect(parent.style.display).not.toBe('none')
    await vi.waitFor(() => expect(parent.hasAttribute('inert')).toBe(false))
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })
})
