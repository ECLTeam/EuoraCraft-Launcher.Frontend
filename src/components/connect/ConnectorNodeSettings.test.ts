import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { i18n } from '@/i18n'
import ConnectorNodeSettings from './ConnectorNodeSettings.vue'

const mocks = vi.hoisted(() => ({ showError: vi.fn() }))
vi.mock('@/features/settings/api/settingsApi', () => ({
  settingsApi: { load: vi.fn(), saveConnector: vi.fn() },
}))
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => ({ error: mocks.showError }) }))
enableAutoUnmount(afterEach)

function mountSettings() {
  return mount(ConnectorNodeSettings, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
}

describe('ConnectorNodeSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    i18n.global.locale.value = 'zh-CN'
    vi.mocked(settingsApi.load).mockResolvedValue({
      ui: {},
      game: { minecraft_paths: [] },
      download: { mirror_source: 'official' },
      launcher: {},
      connector: { mode: 'automatic', nodes: [] },
    })
  })

  it('加载普通配置表单，没有保存、恢复、重试按钮和额外说明', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/自动保存|下次|恢复默认|重试|有效地址/)
    expect(settingsApi.saveConnector).not.toHaveBeenCalled()
  })

  it('仅自定义允许先保存空配置，未完成地址输入也立即保存原文', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    await flushPromises()
    expect(settingsApi.saveConnector).toHaveBeenLastCalledWith({ mode: 'custom', nodes: [] })
    const input = wrapper.get('textarea')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    await input.setValue(' tcp://unfinished \n')
    await flushPromises()
    expect(settingsApi.saveConnector).toHaveBeenLastCalledWith({ mode: 'custom', nodes: [' tcp://unfinished ', ''] })
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('隐藏再显示地址时保留已保存草稿', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'append')
    await flushPromises()
    await wrapper.get('textarea').setValue('draft')
    await flushPromises()
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'automatic')
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(settingsApi.saveConnector).toHaveBeenLastCalledWith({ mode: 'automatic', nodes: ['draft'] })
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('draft')
  })

  it('保存失败由共用消息提示，表单不增加错误和重试面板', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    vi.mocked(settingsApi.saveConnector).mockRejectedValueOnce(new Error('写入失败'))
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'custom')
    await flushPromises()
    expect(mocks.showError).toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
