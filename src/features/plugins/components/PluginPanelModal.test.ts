import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginInfo, PluginPanelData, PluginPanelDefinition } from '@/types/plugins'
import PluginPanelModal from './PluginPanelModal.vue'

const mocks = vi.hoisted(() => ({
  getPanels: vi.fn(),
  getPanelData: vi.fn(),
  getSettings: vi.fn(),
  runPanelAction: vi.fn(),
  updateSetting: vi.fn(),
}))

vi.mock('@/features/plugins/api/pluginManagementApi', () => ({ pluginManagementApi: mocks }))

const plugin: PluginInfo = {
  name: 'demo',
  title: 'Demo',
  version: '1',
  description: '',
  author: '',
  icon: '',
  status: 'enabled',
  error: null,
  dependencies: {},
  services: [],
  is_system: false,
}

const panels: PluginPanelDefinition[] = [
  {
    key: 'main',
    title: '主面板',
    description: '示例说明',
    nodes: [
      { type: 'text', text: '第一段说明' },
      { type: 'group', title: '分组', children: [{ type: 'button', label: '执行', command: 'run' }] },
      { type: 'setting', key: 'greeting' },
      { type: 'list', source: 'rows', columns: [{ key: 'name', label: '名称' }] },
      { type: 'task', source: 'job' },
    ],
  },
]

const data: PluginPanelData = {
  lists: { rows: [{ name: 'alpha' }] },
  tasks: { job: { state: 'running', percent: 40, detail: '进行中' } },
}

function mountModal() {
  return mount(PluginPanelModal, {
    props: { visible: true, plugin },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
}

describe('plugin panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPanels.mockResolvedValue(panels)
    mocks.getPanelData.mockResolvedValue(data)
    mocks.getSettings.mockResolvedValue({
      schema: [{ key: 'greeting', type: 'string', default: 'hello' }],
      values: { greeting: 'hello' },
      revision: 0,
    })
    mocks.runPanelAction.mockResolvedValue({ ok: true })
  })

  it('renders every node type and refreshes data after an action', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain('第一段说明')
    expect(wrapper.text()).toContain('分组')
    expect(wrapper.text()).toContain('alpha')
    expect(wrapper.text()).toContain('进行中')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.runPanelAction).toHaveBeenCalledWith('demo', 'run', {})
    expect(mocks.getPanelData).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('shows an empty state when the plugin registers no panel', async () => {
    mocks.getPanels.mockResolvedValue([])
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain(i18n.global.t('plugins.panelEmpty'))
    wrapper.unmount()
  })

  it('rejects a panel with an unknown node type instead of rendering part of it', async () => {
    mocks.getPanels.mockResolvedValue([
      { key: 'main', title: '主面板', nodes: [{ type: 'chart', text: 'x' } as never] },
    ])
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain(i18n.global.t('plugins.panelUnsupported'))
    expect(wrapper.text()).not.toContain('第一段说明')
    wrapper.unmount()
  })

  it('reports a failed action without dropping the panel', async () => {
    mocks.runPanelAction.mockRejectedValue(new Error('PLUGIN_COMMAND_FAILED'))
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(i18n.global.t('plugins.panelActionFailed'))
    expect(wrapper.text()).toContain('第一段说明')
    wrapper.unmount()
  })
})
