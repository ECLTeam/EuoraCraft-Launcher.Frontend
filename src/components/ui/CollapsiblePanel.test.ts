import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CollapsiblePanel from './CollapsiblePanel.vue'

describe('CollapsiblePanel', () => {
  it('收起时隐藏内容并禁止聚焦，展开后恢复', async () => {
    const wrapper = mount(CollapsiblePanel, {
      props: { open: false },
      slots: { default: '<p>内容</p>' },
    })

    expect(wrapper.classes()).not.toContain('is-open')
    expect(wrapper.attributes('inert')).toBeDefined()
    expect(wrapper.get('.collapsible-panel__inner').text()).toBe('内容')

    await wrapper.setProps({ open: true })
    expect(wrapper.classes()).toContain('is-open')
    expect(wrapper.attributes('inert')).toBeUndefined()
  })
})
