import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import { i18n } from '@/i18n'
import FullscreenModal from './FullscreenModal.vue'
import Modal from './Modal.vue'

function createHost(options: { template: string; setup: () => object }) {
  return defineComponent({ components: { Modal, FullscreenModal }, ...options })
}

describe('Modal', () => {
  afterEach(() => {
    globalModalStack.reset()
    document.body.innerHTML = ''
  })

  it('全局栈会先展示 CurseForge 警告，关闭后才展示低优先级更新提示', async () => {
    const warningVisible = ref(true)
    const updateVisible = ref(true)
    const host = createHost({
      setup: () => ({ updateVisible, warningVisible }),
      template: `
        <Modal :visible="warningVisible" :priority="75" title="CurseForge API Key 未配置">Key 缺失</Modal>
        <Modal :visible="updateVisible" :priority="60" title="检测到更新">新版本可用</Modal>
      `,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: [i18n] } })

    const visibleContent = () =>
      Array.from(document.body.querySelectorAll<HTMLElement>('.modal-overlay'))
        .filter((modal) => modal.style.display !== 'none')
        .map((modal) => modal.textContent)

    expect(visibleContent()).toContain('CurseForge API Key 未配置Key 缺失')

    warningVisible.value = false
    await nextTick()

    expect(visibleContent()).toContain('检测到更新新版本可用')
    wrapper.unmount()
  })

  it('多层子窗口只允许顶层交互，Tab 环绕且父窗口关闭后全部清理', async () => {
    const parentVisible = ref(true)
    const childVisible = ref(false)
    const grandchildVisible = ref(false)
    const host = createHost({
      setup: () => ({ parentVisible, childVisible, grandchildVisible }),
      template: `
        <FullscreenModal v-model:visible="parentVisible" title="账户">
          <button id="open-child" @click="childVisible = true">添加</button>
          <Modal v-model:visible="childVisible" title="添加">
            <button id="open-grandchild" @click="grandchildVisible = true">选择</button>
            <Modal v-model:visible="grandchildVisible" title="选择" :closable="false">
              <input id="first-field" /><button id="last-action">最后一项</button>
            </Modal>
          </Modal>
        </FullscreenModal>
      `,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: [i18n], stubs: { transition: false } } })
    await nextTick()
    document.querySelector<HTMLButtonElement>('#open-child')!.click()
    await nextTick()
    document.querySelector<HTMLButtonElement>('#open-grandchild')!.click()
    await nextTick()
    await nextTick()
    const overlays = [...document.querySelectorAll<HTMLElement>('.modal-overlay')]
    expect(overlays.every((overlay) => overlay.style.display !== 'none')).toBe(true)
    expect(overlays.map((overlay) => overlay.hasAttribute('inert'))).toEqual([true, false])
    const last = document.querySelector<HTMLButtonElement>('#last-action')!
    last.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('first-field')
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    )
    expect(document.activeElement).toBe(last)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(grandchildVisible.value).toBe(true)
    expect(childVisible.value).toBe(true)
    parentVisible.value = false
    await nextTick()
    expect(childVisible.value).toBe(false)
    expect(grandchildVisible.value).toBe(false)
    expect(globalModalStack.activeModalId.value).toBeNull()
    await vi.waitFor(() => expect(overlays.every((overlay) => overlay.style.display === 'none')).toBe(true))
    wrapper.unmount()
  })

  it('并列窗口通过显式父级关联，关闭动画结束后背景恢复交互', async () => {
    const parentVisible = ref(true)
    const childVisible = ref(false)
    const host = createHost({
      setup: () => ({ parentVisible, childVisible, parentRef: ref<InstanceType<typeof FullscreenModal> | null>(null) }),
      template: `
        <FullscreenModal ref="parentRef" v-model:visible="parentVisible" title="详情">
          <button id="open-picker" @click="childVisible = true">图标</button>
        </FullscreenModal>
        <Modal v-model:visible="childVisible" :parentId="parentRef?.modalId" title="图标"><input /></Modal>
      `,
    })
    const wrapper = mount(host, { attachTo: document.body, global: { plugins: [i18n], stubs: { transition: false } } })
    await nextTick()
    document.querySelector<HTMLButtonElement>('#open-picker')!.click()
    await nextTick()
    const parent = document.querySelector<HTMLElement>('.fullscreen-modal')!
    expect(parent.style.display).not.toBe('none')
    expect(parent.hasAttribute('inert')).toBe(true)
    childVisible.value = false
    await nextTick()
    expect(parent.hasAttribute('inert')).toBe(true)
    expect(globalModalStack.interactiveModalId.value).toBeNull()
    await vi.waitFor(() => expect(parent.hasAttribute('inert')).toBe(false))
    expect(parentVisible.value).toBe(true)
    wrapper.unmount()
  })
})
