import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import AccountLocatorColor from './AccountLocatorColor.vue'

const mocks = vi.hoisted(() => ({ copy: vi.fn(), copied: { value: false }, success: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copy: mocks.copy, copied: mocks.copied }) }))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: mocks.success, warning: mocks.warning }),
}))
const uuid = '069a79f4-44e9-4726-a5be-fca90e38aaf5'
const mountColor = () => mount(AccountLocatorColor, { props: { uuid }, global: { plugins: [i18n] } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.copied.value = false
  mocks.copy.mockImplementation(async () => {
    mocks.copied.value = true
  })
})

describe('账户定位栏颜色展示', () => {
  it('详情颜色随 UUID 更新，缺失时显示不可用状态', async () => {
    const wrapper = mountColor()
    try {
      expect(wrapper.get('code').text()).toBe('#E66185')
      await wrapper.setProps({ uuid: '00000000-0000-0000-0000-000000ff0000' })
      expect(wrapper.get('.locator-color-marker').attributes('style')).toContain('rgb(230, 0, 0)')
      expect(wrapper.get('code').text()).toBe('#E60000')
      await wrapper.setProps({ uuid: undefined })
      expect(wrapper.find('.locator-color-marker').exists()).toBe(false)
      expect(wrapper.text()).toContain('暂无可用 UUID')
    } finally {
      wrapper.unmount()
    }
  })

  it('详情复制准确 HEX，提示成功并保留可选择文本', async () => {
    const wrapper = mountColor()
    try {
      expect(wrapper.get('code').text()).toBe('#E66185')
      await wrapper.get('button').trigger('click')
      await flushPromises()
      expect(mocks.copy).toHaveBeenCalledWith('#E66185')
      expect(mocks.success).toHaveBeenCalledOnce()
      expect(wrapper.get('button').attributes('aria-label')).toContain('#E66185')
    } finally {
      wrapper.unmount()
    }
  })

  it('剪贴板拒绝或不支持时提供失败反馈，色值仍可手动复制', async () => {
    const wrapper = mountColor()
    try {
      mocks.copy.mockRejectedValueOnce(new Error('权限拒绝'))
      await wrapper.get('button').trigger('click')
      await flushPromises()
      expect(mocks.warning).toHaveBeenCalledOnce()
      mocks.copy.mockResolvedValueOnce(undefined)
      await wrapper.get('button').trigger('click')
      await flushPromises()
      expect(mocks.warning).toHaveBeenCalledTimes(2)
      expect(mocks.success).not.toHaveBeenCalled()
      expect(wrapper.get('code').text()).toBe('#E66185')
    } finally {
      wrapper.unmount()
    }
  })

  it('无效 UUID 在详情显示不可用状态，不展示复制操作', async () => {
    const wrapper = mountColor()
    try {
      await wrapper.setProps({ uuid: 'invalid' })
      expect(wrapper.text()).toContain('暂无可用 UUID')
      expect(wrapper.find('button').exists()).toBe(false)
      expect(wrapper.find('.locator-color-marker').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
