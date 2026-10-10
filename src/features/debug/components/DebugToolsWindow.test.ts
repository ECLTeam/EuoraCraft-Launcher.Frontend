import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { useDebugToolsWindowStore } from '@/features/debug/stores/debugToolsWindowStore'
import { i18n } from '@/i18n'
import DebugToolsWindow from './DebugToolsWindow.vue'

enableAutoUnmount(afterEach)
beforeEach(() => {
  setActivePinia(createPinia())
  useGlobalModalStack().reset()
  i18n.global.locale.value = 'zh-CN'
  useDebugToolsWindowStore().open()
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => true })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
})
afterEach(() => {
  useGlobalModalStack().reset()
  vi.restoreAllMocks()
})

function render() {
  return mount(DebugToolsWindow, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      stubs: {
        UiIcon: true,
        DevToolsPanel: {
          name: 'DevToolsPanel',
          setup() {
            const value = ref('')
            return () =>
              h('input', {
                'aria-label': '调试测试输入',
                value: value.value,
                onInput: (event: Event) => {
                  value.value = (event.target as HTMLInputElement).value
                },
              })
          },
        },
      },
    },
  })
}

function windowElement() {
  return new DOMWrapper(document.querySelector<HTMLElement>('.debug-tools-window')!)
}

function pointer(type: string, x: number, y: number, target: EventTarget = window): void {
  const event = new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
}

it('收起恢复保留内部输入，Esc 回到常驻浮条', async () => {
  render()
  await windowElement().get('input').setValue('保留当前调试内容')
  await windowElement().get('[aria-label="收起调试工具"]').trigger('click')
  expect(useDebugToolsWindowStore().mode).toBe('minimized')
  await windowElement().get('[aria-label="展开调试工具"]').trigger('click')
  expect((windowElement().get('input').element as HTMLInputElement).value).toBe('保留当前调试内容')
  await windowElement().trigger('keydown', { key: 'Escape' })
  expect(useDebugToolsWindowStore().mode).toBe('minimized')
})

it('模态确认期间暂停浮层交互，关闭确认后恢复', async () => {
  render()
  const stack = useGlobalModalStack()
  stack.register({ id: 'test-confirm', title: '确认操作' })
  await flushPromises()
  expect(windowElement().attributes('inert')).toBeDefined()
  await windowElement().get('[aria-label="收起调试工具"]').trigger('click')
  expect(useDebugToolsWindowStore().mode).toBe('floating')
  stack.unregister('test-confirm')
  await flushPromises()
  expect(windowElement().attributes('inert')).toBeUndefined()
  stack.addBlocker('native-dialog')
  await flushPromises()
  expect(windowElement().attributes('inert')).toBeDefined()
  stack.unregister('native-dialog')
  await flushPromises()
  expect(windowElement().attributes('inert')).toBeUndefined()
})

it('拖动遇到弹窗或卸载时停止，后续指针事件不再改变布局', async () => {
  const wrapper = render()
  const store = useDebugToolsWindowStore()
  pointer('pointerdown', 200, 100, windowElement().get('.debug-window-header').element)
  const before = { ...store.layout }
  pointer('pointermove', 220, 120)
  expect(store.layout.y).toBe(before.y + 20)
  useGlobalModalStack().register({ id: 'pause-drag' })
  await flushPromises()
  const stopped = { ...store.layout }
  pointer('pointermove', 250, 180)
  expect(store.layout).toEqual(stopped)
  useGlobalModalStack().unregister('pause-drag')
  await flushPromises()
  pointer('pointerdown', 200, 100, windowElement().get('.debug-window-resizer').element)
  wrapper.unmount()
  pointer('pointermove', 500, 300)
  expect(store.layout).toEqual(stopped)
})

it('自动常驻时不抢焦点，收起浮条仍能拖动且设置恢复会聚焦工具', async () => {
  const store = useDebugToolsWindowStore()
  store.close()
  store.activate()
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  render()
  await flushPromises()
  expect(document.activeElement).toBe(opener)
  expect(windowElement().find('[aria-label="关闭"]').exists()).toBe(false)
  pointer('pointerdown', 200, 100, windowElement().get('.debug-window-header').element)
  const before = { ...store.layout }
  pointer('pointermove', 220, 120)
  pointer('pointerup', 220, 120)
  expect(store.layout.y).toBe(before.y + 20)
  store.open()
  await flushPromises()
  expect(document.activeElement).toBe(windowElement().element)
  await windowElement().get('[aria-label="收起调试工具"]').trigger('click')
  expect(document.activeElement).toBe(opener)
  opener.remove()
})
