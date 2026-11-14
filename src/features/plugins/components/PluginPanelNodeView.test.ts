import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginPanelData, PluginPanelNode } from '@/types/plugins'
import PluginPanelNodeView from './PluginPanelNodeView.vue'

const emptyData: PluginPanelData = { lists: {}, tasks: {} }

function mountNode(node: PluginPanelNode, data: PluginPanelData = emptyData) {
  return mount(PluginPanelNodeView, {
    props: { node, data, settings: null, busy: false },
    global: { plugins: [i18n] },
  })
}

describe('plugin panel node view', () => {
  it('renders heading with level class and text', () => {
    const wrapper = mountNode({ type: 'heading', level: 2, text: '概览' })
    expect(wrapper.find('.panel-heading.is-l2').text()).toBe('概览')
  })

  it('renders divider as separator', () => {
    const wrapper = mountNode({ type: 'divider' })
    expect(wrapper.find('.panel-divider[role="separator"]').exists()).toBe(true)
  })

  it('renders metric with value, label and hint', () => {
    const wrapper = mountNode({ type: 'metric', label: '实例数', value: '12', tone: 'primary', hint: '本机' })
    expect(wrapper.find('.panel-metric.is-primary').exists()).toBe(true)
    expect(wrapper.find('.panel-metric-value').text()).toBe('12')
    expect(wrapper.find('.panel-metric-label').text()).toBe('实例数')
    expect(wrapper.find('.panel-metric-hint').text()).toBe('本机')
  })

  it('renders badge with tone', () => {
    const wrapper = mountNode({ type: 'badge', text: '运行中', tone: 'success' })
    expect(wrapper.find('.panel-badge.is-success').text()).toBe('运行中')
  })

  it('renders list row actions and emits command with row_key', async () => {
    const wrapper = mountNode(
      {
        type: 'list',
        source: 'rows',
        columns: [
          { key: 'key', label: '键' },
          { key: 'name', label: '名' },
        ],
        row_actions: [{ label: '删除', command: 'demo.remove', tone: 'danger' }],
      },
      { lists: { rows: [{ key: 'a1', name: 'alpha' }] }, tasks: {} }
    )
    expect(wrapper.find('.panel-table-actions').exists()).toBe(true)
    const button = wrapper.findAll('button').find((item) => item.text() === '删除')
    expect(button).toBeDefined()
    await button!.trigger('click')
    expect(wrapper.emitted('action')?.[0]).toEqual(['demo.remove', { row_key: 'a1' }])
  })

  it('hides action column when list declares no row actions', () => {
    const wrapper = mountNode(
      { type: 'list', source: 'rows', columns: [{ key: 'name', label: '名' }] },
      { lists: { rows: [{ name: 'alpha' }] }, tasks: {} }
    )
    expect(wrapper.find('.panel-table-actions').exists()).toBe(false)
  })
})
