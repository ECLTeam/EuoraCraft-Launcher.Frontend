import { flushPromises, mount } from '@vue/test-utils'
import { NInput, NSelect } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import ConnectorNodeSettings from './ConnectorNodeSettings.vue'

const mocks = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))

describe('ConnectorNodeSettings', () => {
  beforeEach(() => {
    mocks.command.mockReset()
    i18n.global.locale.value = 'zh-CN'
  })
  it('loads custom nodes, saves normalized lines and resets to automatic mode', async () => {
    mocks.command.mockImplementation(async (name, body) => ({
      success: true,
      data: name === 'connector_nodes_get' ? { mode: 'custom', nodes: ['tcp://existing.test:1'] } : body,
    }))
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(wrapper.getComponent(NSelect).props('value')).toBe('custom')
    wrapper.getComponent(NInput).vm.$emit('update:value', ' tcp://relay.test:11010 \n\nquic://[::1]:123')
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('connector_nodes_set', {
      mode: 'custom',
      nodes: ['tcp://relay.test:11010', 'quic://[::1]:123'],
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('恢复自动'))!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenLastCalledWith('connector_nodes_set', { mode: 'automatic', nodes: [] })
    wrapper.unmount()
  })
  it('shows validation errors and preserves custom mode on a rejected save', async () => {
    mocks.command
      .mockResolvedValueOnce({ success: true, data: { mode: 'custom', nodes: ['tcp://existing.test:1'] } })
      .mockResolvedValueOnce({ success: false, message: '节点格式无效' })
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n] } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('节点格式无效')
    expect(wrapper.getComponent(NSelect).props('value')).toBe('custom')
    wrapper.unmount()
  })
})
