import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useProcessInstances } from '../composables/useProcessInstances'
import ProcessInstanceView from './ProcessInstanceView.vue'
vi.mock('@/api/client', () => ({ default: { on: vi.fn(() => vi.fn()) } }))
vi.mock('../api/terminalApi', () => ({ terminalApi: {} }))

afterEach(() => useProcessInstances().syncList([]))

it('空实例只显示统一占位，实例进入和退出后正确恢复布局', async () => {
  const process = useProcessInstances()
  const wrapper = mount(ProcessInstanceView, { global: { plugins: [i18n] } })
  expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
  expect(wrapper.find('.piv-list').exists()).toBe(false)
  expect(wrapper.find('.piv-hint').exists()).toBe(false)
  process.syncList([{ id: 'test', pid: 123, name: 'test', type: 'Minecraft', running: true, stdin: false, lines: [] }])
  await flushPromises()
  expect(wrapper.find('.piv-list').exists()).toBe(true)
  expect(wrapper.find('.piv-hint').exists()).toBe(true)
  process.syncList([])
  await flushPromises()
  expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
  expect(wrapper.find('.piv-main').exists()).toBe(false)
  wrapper.unmount()
})
