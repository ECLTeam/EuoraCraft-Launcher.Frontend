import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NInput, NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import ConnectorNodeSettings from './ConnectorNodeSettings.vue'

const mocks = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))
enableAutoUnmount(afterEach)

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
      .find((button) => button.text().includes('恢复默认'))!
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

  it('加载失败禁止保存，重试成功才允许编辑', async () => {
    mocks.command
      .mockResolvedValueOnce({ success: false, message: '读取失败' })
      .mockResolvedValueOnce({ success: true, data: { mode: 'automatic', nodes: [] } })
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(wrapper.getComponent(NSelect).props('disabled')).toBe(true)
    expect(wrapper.get('[data-action="save"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent(NSelect).props('disabled')).toBe(false)
    expect(mocks.command).toHaveBeenCalledTimes(2)
  })

  it('自动模式隐藏地址，切换策略保留草稿且不自动保存', async () => {
    mocks.command.mockResolvedValue({ success: true, data: { mode: 'custom', nodes: ['tcp://existing.test:1'] } })
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n] } })
    await flushPromises()
    wrapper.getComponent(NInput).vm.$emit('update:value', 'tcp://draft.test:2')
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'automatic')
    await flushPromises()
    expect(wrapper.findComponent(NInput).exists()).toBe(false)
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'append')
    await flushPromises()
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://draft.test:2')
    expect(mocks.command).toHaveBeenCalledTimes(1)
  })

  it('恢复默认失败保留原模式和编辑地址', async () => {
    mocks.command
      .mockResolvedValueOnce({ success: true, data: { mode: 'custom', nodes: ['tcp://existing.test:1'] } })
      .mockResolvedValueOnce({ success: false, message: '保存失败' })
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n] } })
    await flushPromises()
    wrapper.getComponent(NInput).vm.$emit('update:value', 'tcp://draft.test:2')
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('恢复'))!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenLastCalledWith('connector_nodes_set', { mode: 'automatic', nodes: [] })
    expect(wrapper.getComponent(NSelect).props('value')).toBe('custom')
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://draft.test:2')
    expect(wrapper.get('[role="alert"]').text()).toBe('保存失败')
  })

  it('保存中防止重复写入，成功后回填规范化结果并清除过期反馈', async () => {
    let completeSave!: (response: unknown) => void
    mocks.command
      .mockResolvedValueOnce({ success: true, data: { mode: 'custom', nodes: ['tcp://existing.test:1'] } })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeSave = resolve
          })
      )
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await flushPromises()
    const input = wrapper.get('textarea')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-label')).toBe('自定义节点地址')
    wrapper.getComponent(NInput).vm.$emit('update:value', 'tcp://Relay.test:2\ntcp://relay.test:2')
    await wrapper.vm.$nextTick()
    const save = wrapper.get('[data-action="save"]')
    await save.trigger('click')
    expect(save.attributes('disabled')).toBeDefined()
    expect(wrapper.getComponent(NSelect).props('disabled')).toBe(true)
    await save.trigger('click')
    expect(mocks.command).toHaveBeenCalledTimes(2)
    completeSave({ success: true, data: { mode: 'custom', nodes: ['tcp://relay.test:2'] } })
    await flushPromises()
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://relay.test:2')
    expect(wrapper.get('[role="status"]').text()).toBe('已保存，下次连接时生效。')
    wrapper.getComponent(NInput).vm.$emit('update:value', '')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })
})
