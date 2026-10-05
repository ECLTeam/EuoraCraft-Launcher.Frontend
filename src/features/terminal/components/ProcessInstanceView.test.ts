import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useProcessInstances } from '../composables/useProcessInstances'
import ProcessInstanceView from './ProcessInstanceView.vue'
vi.mock('@/api/client', () => ({ default: { on: vi.fn(() => vi.fn()) } }))
vi.mock('../api/terminalApi', () => ({ terminalApi: {} }))

afterEach(() => {
  const state = useProcessInstances()
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
