import { flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import JavaRuntimeSelector from './JavaRuntimeSelector.vue'
const mocks = vi.hoisted(() => ({ scan: vi.fn(), browse: vi.fn() }))
vi.mock('@/features/settings/api/settingsApi', () => ({ settingsApi: { selectJava: mocks.browse } }))
vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    isJavaLoading: false,
    javaInstallations: [
      {
        path: 'C:/Java/bin/java.exe',
        major_version: 21,
        java_type: 'Microsoft',
        vendor: 'Microsoft',
        runtime_kind: 'JDK',
        version: '21.0.2',
        arch: 'x64',
      },
    ],
    loadJavaInstallations: mocks.scan,
  }),
}))

describe('JavaRuntimeSelector', () => {
  beforeEach(() => {
    mocks.scan.mockReset().mockResolvedValue([])
    mocks.browse.mockReset().mockResolvedValue(null)
    i18n.global.locale.value = 'zh-CN'
  })
  it('keeps a configured path outside scan results and shares refresh behavior', async () => {
    const wrapper = mount(JavaRuntimeSelector, {
      props: { value: 'D:/Custom Java/java.exe' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    const options = wrapper.getComponent(NSelect).props('options')
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'D:/Custom Java/java.exe' }),
        expect.objectContaining({ label: expect.stringContaining('21.0.2') }),
        expect.objectContaining({ label: expect.stringContaining('Microsoft · JDK') }),
      ])
    )
    expect(mocks.scan).toHaveBeenCalledWith(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('刷新'))!
      .trigger('click')
    expect(mocks.scan).toHaveBeenLastCalledWith(true)
    wrapper.unmount()
  })
  it('preserves the selection when browse is cancelled and emits only a selected path', async () => {
    const wrapper = mount(JavaRuntimeSelector, {
      props: { value: 'C:/Existing/java.exe' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    const browse = wrapper.findAll('button').find((button) => button.text().includes('浏览'))!
    await browse.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:value')).toBeUndefined()
    mocks.browse.mockResolvedValue('C:/New/java.exe')
    await browse.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:value')).toEqual([['C:/New/java.exe']])
    wrapper.unmount()
  })
  it('shows scan failures without clearing the configured path', async () => {
    mocks.scan.mockRejectedValue(new Error('扫描失败'))
    const wrapper = mount(JavaRuntimeSelector, {
      props: { value: 'C:/Existing/java.exe' },
      global: { plugins: [i18n] },
    })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('扫描失败')
    expect(wrapper.getComponent(NSelect).props('value')).toBe('C:/Existing/java.exe')
    wrapper.unmount()
  })
})
