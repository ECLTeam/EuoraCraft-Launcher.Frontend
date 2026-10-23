import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import UiLoading from './Loading.vue'

describe('UiLoading', () => {
  it('以区域状态和可访问说明呈现加载指示器', () => {
    const wrapper = mount(UiLoading, {
      props: { label: '正在加载资源' },
      global: { plugins: [i18n] },
    })

    expect(wrapper.classes()).toContain('ui-loading--block')
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('正在加载资源')
    expect(wrapper.get('svg.ui-loading__ring').attributes('width')).toBe('24')
  })

  it('在遮罩模式下保留内容并可隐藏加载指示器', async () => {
    const wrapper = mount(UiLoading, {
      props: { mode: 'overlay', show: true },
      slots: { default: '<div class="content">内容</div>' },
      global: { plugins: [i18n] },
    })

    expect(wrapper.get('.content').text()).toBe('内容')
    expect(wrapper.find('[role="status"]').exists()).toBe(true)

    await wrapper.setProps({ show: false })
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
