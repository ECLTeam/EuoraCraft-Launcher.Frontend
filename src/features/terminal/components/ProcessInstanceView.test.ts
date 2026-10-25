import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useProcessInstances } from '../composables/useProcessInstances'
import ProcessInstanceView from './ProcessInstanceView.vue'
vi.mock('@/api/client', () => ({ default: { on: vi.fn(() => vi.fn()) } }))
const controls = vi.hoisted(() => ({ stop: vi.fn() }))
vi.mock('../api/terminalApi', () => ({ terminalApi: { stopProcess: controls.stop } }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  vi.clearAllMocks()
})

afterEach(() => {
  const state = useProcessInstances()
  state.dispose()
  state.sessions.value = []
  state.outputByProcessId.value = {}
  state.selectedProcessId.value = null
})

it('空态显示统一占位，退出后保留输出并禁用进程控制', async () => {
  const process = useProcessInstances()
  const wrapper = mount(ProcessInstanceView, { global: { plugins: [i18n] } })
  expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
  expect(wrapper.find('.piv-list').exists()).toBe(false)
  expect(wrapper.find('.piv-hint').exists()).toBe(false)
  process.syncList([{ id: 'test', pid: 123, name: 'test', type: 'Minecraft', running: true, stdin: false, lines: [] }])
  await flushPromises()
  expect(wrapper.find('.piv-list').exists()).toBe(true)
  expect(wrapper.find('.piv-output').exists()).toBe(true)
  process.onLog({ instanceId: 'test', name: 'test', type: 'Minecraft', line: 'final output' })
  process.syncList([])
  await flushPromises()
  expect(wrapper.find('.piv-main').exists()).toBe(true)
  expect(wrapper.text()).toContain('final output')
  expect(wrapper.text()).toContain('已停止')
  expect(wrapper.get('.piv-btn--stop').attributes('disabled')).toBeDefined()
  wrapper.unmount()
})

function addSessions() {
  const process = useProcessInstances()
  process.syncList([
    {
      id: 'stopped',
      pid: null,
      name: '已结束实例',
      type: 'Minecraft',
      running: false,
      stdin: false,
      lines: ['old output'],
    },
    { id: 'running', pid: 123, name: '运行实例', type: 'Minecraft', running: true, stdin: false, lines: [] },
  ])
  return process
}

it('只为已停止记录提供独立移除按钮，不切换选择或停止运行进程', async () => {
  const process = addSessions()
  process.select('running')
  const select = vi.spyOn(process, 'select')
  try {
    const wrapper = mount(ProcessInstanceView, { global: { plugins: [i18n] } })
    expect(wrapper.findAll('.piv-remove')).toHaveLength(1)
    expect(wrapper.find('button button').exists()).toBe(false)
    expect(wrapper.get('.piv-remove').attributes('aria-label')).toContain('已结束实例')
    await wrapper.get('.piv-remove').trigger('click')
    expect(process.selectedProcessId.value).toBe('running')
    expect(wrapper.text()).not.toContain('已结束实例')
    expect(select).not.toHaveBeenCalled()
    expect(controls.stop).not.toHaveBeenCalled()
    expect(wrapper.get('.piv-clear').attributes('disabled')).toBeDefined()
  } finally {
    select.mockRestore()
  }
})

it('移除焦点所在的停止记录后，焦点进入保留的运行会话', async () => {
  const process = addSessions()
  const wrapper = mount(ProcessInstanceView, { attachTo: document.body, global: { plugins: [i18n] } })
  const remove = wrapper.get<HTMLButtonElement>('.piv-remove')
  remove.element.focus()
  await remove.trigger('click')
  await flushPromises()
  expect(process.selectedProcessId.value).toBe('running')
  expect(document.activeElement).toBe(wrapper.get('.piv-select').element)
})

it('批量清除保留运行会话，清除最后一条记录后进入空态并保留焦点', async () => {
  const process = addSessions()
  const wrapper = mount(ProcessInstanceView, { attachTo: document.body, global: { plugins: [i18n] } })
  await wrapper.get('.piv-clear').trigger('click')
  expect(process.sessions.value.map((session) => session.processId)).toEqual(['running'])
  expect(controls.stop).not.toHaveBeenCalled()
  process.syncList([])
  await flushPromises()
  const clear = wrapper.get<HTMLButtonElement>('.piv-clear')
  clear.element.focus()
  await clear.trigger('click')
  await flushPromises()
  expect(wrapper.find('.piv-list').exists()).toBe(false)
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  expect(document.activeElement).toBe(wrapper.element)
})
