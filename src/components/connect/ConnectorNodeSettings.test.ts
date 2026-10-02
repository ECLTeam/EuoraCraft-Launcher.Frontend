import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NInput, NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { CommandPayloadMap } from '@/types/api'
import ConnectorNodeSettings from './ConnectorNodeSettings.vue'

type NodeSettings = CommandPayloadMap['connector_nodes_set']
const mocks = vi.hoisted(() => ({ command: vi.fn(), showError: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => ({ error: mocks.showError }) }))
enableAutoUnmount(afterEach)

function mountSettings(settings: NodeSettings = { mode: 'custom', nodes: ['tcp://existing.test:1'] }) {
  mocks.command.mockImplementation(async (name, body) => ({
    success: true,
    data: name === 'connector_nodes_get' ? settings : body,
  }))
  return mount(ConnectorNodeSettings, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
}

function writes() {
  return mocks.command.mock.calls.filter(([name]) => name === 'connector_nodes_set').map(([, body]) => body)
}

function deferSave() {
  let complete!: (response: unknown) => void
  mocks.command.mockImplementationOnce(() => new Promise((resolve) => (complete = resolve)))
  return (settings: NodeSettings) => complete({ success: true, data: settings })
}

describe('ConnectorNodeSettings', () => {
  beforeEach(() => {
    mocks.command.mockReset()
    mocks.showError.mockReset()
    i18n.global.locale.value = 'zh-CN'
  })

  it('加载不写入，不再显示保存和恢复默认按钮或恢复说明', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('恢复默认')
    expect(writes()).toEqual([])
  })

  it('地址输入期间不保存，失焦时提交修剪后的非空行并去重请求', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    const input = wrapper.get('textarea')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-label')).toBe('自定义节点地址')
    await input.setValue(' tcp://relay.test:11010 \n\nquic://[::1]:123')
    await flushPromises()
    expect(writes()).toEqual([])
    await input.trigger('blur')
    await flushPromises()
    expect(writes()).toEqual([{ mode: 'custom', nodes: ['tcp://relay.test:11010', 'quic://[::1]:123'] }])
    expect(wrapper.get('[role="status"]').text()).toBe('已自动保存，下次连接时生效。')
    await input.trigger('blur')
    await flushPromises()
    expect(writes()).toHaveLength(1)
  })

  it('策略选择后立即保存，自动模式保留页面内地址草稿', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('textarea').setValue('tcp://draft.test:2')
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'automatic')
    await flushPromises()
    expect(writes()).toEqual([{ mode: 'automatic', nodes: ['tcp://existing.test:1'] }])
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'append')
    await flushPromises()
    expect(writes().at(-1)).toEqual({ mode: 'append', nodes: ['tcp://draft.test:2'] })
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://draft.test:2')
  })

  it('隐藏的非法草稿不阻断自动模式，切回自定义时仍保留输入', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('textarea').setValue('invalid-node')
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'automatic')
    await flushPromises()
    expect(writes()).toEqual([{ mode: 'automatic', nodes: ['tcp://existing.test:1'] }])
    mocks.command.mockResolvedValueOnce({ success: false, message: '节点格式无效' })
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    await flushPromises()
    expect(wrapper.getComponent(NInput).props('value')).toBe('invalid-node')
    expect(wrapper.get('[role="alert"]').text()).toContain('节点格式无效')
  })

  it('空的仅自定义模式失败后继续填写，失焦即可保存', async () => {
    const wrapper = mountSettings({ mode: 'automatic', nodes: [] })
    await flushPromises()
    mocks.command.mockResolvedValueOnce({ success: false, message: '仅自定义模式至少需要一个节点' })
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('仅自定义模式至少需要一个节点')
    expect(wrapper.getComponent(NSelect).props('value')).toBe('custom')
    await wrapper.get('textarea').setValue('tcp://new.test:2')
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()
    expect(writes().at(-1)).toEqual({ mode: 'custom', nodes: ['tcp://new.test:2'] })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('读取失败禁止编辑，重试只读取配置', async () => {
    mocks.command
      .mockResolvedValueOnce({ success: false, message: '读取失败' })
      .mockResolvedValueOnce({ success: true, data: { mode: 'automatic', nodes: [] } })
    const wrapper = mount(ConnectorNodeSettings, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(wrapper.getComponent(NSelect).props('disabled')).toBe(true)
    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.getComponent(NSelect).props('disabled')).toBe(false)
    expect(writes()).toEqual([])
  })

  it('保存失败保留草稿并允许重试，重试成功前不显示已保存', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    mocks.command.mockRejectedValueOnce(new Error('保存失败'))
    await wrapper.get('textarea').setValue('tcp://draft.test:2')
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('保存失败')
    expect(wrapper.get('[role="status"]').text()).toBe('')
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://draft.test:2')
    expect(mocks.showError).toHaveBeenCalledWith('保存失败')
    await wrapper.get('[data-action="retry-save"]').trigger('click')
    await flushPromises()
    expect(writes()).toHaveLength(2)
    expect(wrapper.find('[data-action="retry-save"]').exists()).toBe(false)
  })

  it('保存中继续输入时旧响应不覆盖新草稿或显示成功', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    const complete = deferSave()
    await wrapper.get('textarea').setValue('tcp://Relay.test:2\ntcp://relay.test:2')
    await wrapper.get('textarea').trigger('blur')
    expect(wrapper.getComponent(NSelect).props('disabled')).toBe(false)
    expect(wrapper.getComponent(NInput).props('disabled')).toBe(false)
    await wrapper.get('textarea').setValue('tcp://newer.test:3')
    complete({ mode: 'custom', nodes: ['tcp://relay.test:2'] })
    await flushPromises()
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://newer.test:3')
    expect(wrapper.get('[role="status"]').text()).toBe('')
    expect(writes()).toHaveLength(1)
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()
    expect(writes().at(-1)).toEqual({ mode: 'custom', nodes: ['tcp://newer.test:3'] })
  })

  it('规范化回填不触发额外写入', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    mocks.command.mockResolvedValueOnce({ success: true, data: { mode: 'custom', nodes: ['tcp://relay.test:2'] } })
    await wrapper.get('textarea').setValue('tcp://Relay.test:2\ntcp://relay.test:2')
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()
    expect(wrapper.getComponent(NInput).props('value')).toBe('tcp://relay.test:2')
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()
    expect(writes()).toHaveLength(1)
  })

  it('快速切换串行保存，合并中间状态且最终使用最新策略', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    const complete = deferSave()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'append')
    await flushPromises()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'automatic')
    await flushPromises()
    expect(writes()).toHaveLength(1)
    complete({ mode: 'append', nodes: ['tcp://existing.test:1'] })
    await flushPromises()
    expect(writes()).toEqual([
      { mode: 'append', nodes: ['tcp://existing.test:1'] },
      { mode: 'automatic', nodes: ['tcp://existing.test:1'] },
    ])
    expect(wrapper.getComponent(NSelect).props('value')).toBe('automatic')
  })

  it('切回正在保存的相同策略取消过期待保存请求', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    const complete = deferSave()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'append')
    await flushPromises()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'append')
    await flushPromises()
    complete({ mode: 'append', nodes: ['tcp://existing.test:1'] })
    await flushPromises()
    expect(writes()).toHaveLength(1)
    expect(wrapper.getComponent(NSelect).props('value')).toBe('append')
  })

  it('公共与自定义模式允许清空地址，自动模式保留已保存空列表', async () => {
    const wrapper = mountSettings({ mode: 'append', nodes: ['tcp://existing.test:1'] })
    await flushPromises()
    await wrapper.get('textarea').setValue('')
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()
    expect(writes().at(-1)).toEqual({ mode: 'append', nodes: [] })
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'automatic')
    await flushPromises()
    expect(writes().at(-1)).toEqual({ mode: 'automatic', nodes: [] })
  })

  it('卸载保存未失焦地址，不重试已经失败的相同草稿', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.get('textarea').setValue('tcp://leaving.test:2')
    wrapper.unmount()
    await flushPromises()
    expect(writes()).toEqual([{ mode: 'custom', nodes: ['tcp://leaving.test:2'] }])
    mocks.command.mockClear()
    const failing = mountSettings()
    await flushPromises()
    mocks.command.mockResolvedValueOnce({ success: false, message: '保存失败' })
    await failing.get('textarea').setValue('invalid-node')
    await failing.get('textarea').trigger('blur')
    await flushPromises()
    failing.unmount()
    await flushPromises()
    expect(writes()).toHaveLength(1)
  })

  it('卸载把新草稿排在在途请求之后，离页失败仍通知', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    const complete = deferSave()
    await wrapper.get('textarea').setValue('tcp://older.test:2')
    await wrapper.get('textarea').trigger('blur')
    await wrapper.get('textarea').setValue('tcp://leaving.test:3')
    mocks.command.mockRejectedValueOnce(new Error('离页保存失败'))
    wrapper.unmount()
    expect(writes()).toHaveLength(1)
    complete({ mode: 'custom', nodes: ['tcp://older.test:2'] })
    await flushPromises()
    expect(writes().at(-1)).toEqual({ mode: 'custom', nodes: ['tcp://leaving.test:3'] })
    expect(mocks.showError).toHaveBeenCalledWith('离页保存失败')
  })
})
