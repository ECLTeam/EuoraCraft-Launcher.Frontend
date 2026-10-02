import { mount } from '@vue/test-utils'
import { NEmpty } from 'naive-ui'
import { describe, expect, it } from 'vitest'
import UiLoading from '@/components/ui/Loading.vue'
import { i18n } from '@/i18n'
import InstanceContentState from './InstanceContentState.vue'

describe('InstanceContentState', () => {
  it('加载优先于空提示及列表，结束后使用标准空箱并保留操作', async () => {
    const wrapper = mount(InstanceContentState, {
      props: { loading: true, empty: true, emptyDescription: '没有内容' },
      slots: { default: '<article>列表内容</article>', 'empty-actions': '<button>添加内容</button>' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.getComponent(UiLoading).props('mode')).toBe('block')
    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBeTruthy()

    await wrapper.setProps({ loading: false })
    expect(wrapper.findComponent(UiLoading).exists()).toBe(false)
    expect(wrapper.getComponent(NEmpty).props('description')).toBe('没有内容')
    expect(wrapper.find('.n-empty__icon svg').exists()).toBe(true)
    expect(wrapper.get('button').text()).toBe('添加内容')

    await wrapper.setProps({ empty: false })
    expect(wrapper.findComponent(NEmpty).exists()).toBe(false)
    expect(wrapper.get('article').text()).toBe('列表内容')
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})
