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
  const host = document.createElement('div')
  host.id = 'main-content'
  document.body.append(host)
  useGlobalModalStack().reset()
  i18n.global.locale.value = 'zh-CN'
  useDebugToolsWindowStore().open()
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => true })
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
})
afterEach(() => {
  useGlobalModalStack().reset()
  document.getElementById('main-content')?.remove()
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

it('复用页面容器时补偿滚动，悬浮条不随内容滚走', async () => {
  const page = document.getElementById('main-content')!
  page.style.padding = '20px'
  vi.spyOn(page, 'getBoundingClientRect').mockReturnValue(new DOMRect(56, 48, 904, 552))
  const store = useDebugToolsWindowStore()
  store.close()
  store.activate()
  render()
  await flushPromises()
  expect(windowElement().element.style.top).toBe('20px')
  page.scrollTop = 100
  page.dispatchEvent(new Event('scroll'))
  await vi.waitFor(() => expect(windowElement().element.style.top).toBe('120px'))
  expect(Number.parseFloat(windowElement().element.style.top) - page.scrollTop).toBe(20)
})

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
  expect(windowElement().element.style.display).toBe('none')
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

it('全屏宿主内可交互，子确认期间隐藏，切换宿主保留内容', async () => {
  render()
  await windowElement().get('input').setValue('保留全屏调试状态')
  const host = document.createElement('div')
  host.className = 'fullscreen-modal-wrapper'
  const root = document.createElement('div')
  root.dataset.modalId = 'details'
  root.append(host)
  document.body.append(root)
  const stack = useGlobalModalStack()
  stack.register({ id: 'details', isFullscreen: true })
  await flushPromises()
  expect(host.contains(windowElement().element)).toBe(true)
  expect(windowElement().attributes('inert')).toBeUndefined()
  stack.register({ id: 'confirm', parentId: 'details' })
  await flushPromises()
  expect(windowElement().element.style.display).toBe('none')
  stack.unregister('confirm')
  await flushPromises()
  expect(host.contains(windowElement().element)).toBe(true)
  expect((windowElement().get('input').element as HTMLInputElement).value).toBe('保留全屏调试状态')
  stack.unregister('details')
  await flushPromises()
  expect(document.getElementById('main-content')?.contains(windowElement().element)).toBe(true)
  root.remove()
})

it('从页面移入全屏的展开工具收起时，将焦点交给当前全屏区域', async () => {
  const opener = document.createElement('button')
  document.body.append(opener)
  opener.focus()
  const store = useDebugToolsWindowStore()
  store.close()
  store.open()
  render()
  const root = document.createElement('div')
  root.dataset.modalId = 'focus-fullscreen'
  const wrapper = document.createElement('div')
  wrapper.className = 'fullscreen-modal-wrapper'
  wrapper.tabIndex = -1
  const host = document.createElement('div')
  wrapper.append(host)
  root.append(wrapper)
  document.body.append(root)
  useGlobalModalStack().register({ id: 'focus-fullscreen', isFullscreen: true })
  await flushPromises()
  windowElement().element.focus()
  await windowElement().trigger('keydown', { key: 'Escape' })
  await flushPromises()
  expect(store.mode).toBe('minimized')
  expect(document.activeElement).toBe(wrapper)
  root.remove()
  opener.remove()
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

it('自动常驻默认左上角，收起条可拖动并保留位置，展开独立保存位置', async () => {
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
  await flushPromises()
  expect(store.layout).toEqual(before)
  expect(store.minimizedPosition).toEqual({ x: 20, y: 20 })
  expect(windowElement().element.style.left).toBe('20px')
  expect(windowElement().element.style.top).toBe('20px')
  store.open()
  await flushPromises()
  expect(document.activeElement).toBe(windowElement().element)
  await windowElement().get('[aria-label="收起调试工具"]').trigger('click')
  expect(store.minimizedPosition).toEqual({ x: 20, y: 20 })
  expect(document.activeElement).toBe(opener)
  opener.remove()
})
