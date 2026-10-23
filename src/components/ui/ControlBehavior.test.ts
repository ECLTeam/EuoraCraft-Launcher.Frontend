import { enableAutoUnmount, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import UiInput from './Input.vue'
import UiSelect from './Select.vue'
import UiSlider from './Slider.vue'

enableAutoUnmount(afterEach)

const global = { plugins: [i18n] }

beforeEach(() => {
  const app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)
})

describe('公共输入控件', () => {
  it('只读和禁用内容不可清空，只读内容仍可聚焦和选择', async () => {
    const wrapper = mount(UiInput, {
      attachTo: '#app',
      global,
      props: { modelValue: '保留内容', readonly: true, clearable: true },
    })
    expect(wrapper.find('button').exists()).toBe(false)
    const input = wrapper.get('input')
    expect(input.element.readOnly).toBe(true)
    expect(input.element.disabled).toBe(false)
    input.element.focus()
    input.element.select()
    expect(document.activeElement).toBe(input.element)
    expect(input.element.selectionEnd).toBe(4)
    await wrapper.setProps({ readonly: false, disabled: true })
    expect(input.element.disabled).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('可编辑内容清空后提交一次并恢复输入焦点', async () => {
    const wrapper = mount(UiInput, {
      attachTo: '#app',
      global,
      props: { modelValue: 'value', clearable: true },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  it('选择提交一次，保留显示名称、描述及描述搜索，禁用后不提交', async () => {
    const options = [
      { value: 'automatic', desc: '推荐设置' },
      { value: 'manual', label: '手动', desc: '指定 Java' },
    ]
    const wrapper = mount(UiSelect, {
      attachTo: '#app',
      global,
      props: { modelValue: 'automatic', options, searchable: true },
    })
    const select = wrapper.getComponent(NSelect)
    expect(select.props('options')).toEqual([
      { value: 'automatic', label: 'automatic', desc: '推荐设置' },
      { value: 'manual', label: '手动', desc: '指定 Java' },
    ])
    expect(options[0]).not.toHaveProperty('label')
    expect(select.props('filter')!('JAVA', { value: 'manual', label: '手动', desc: '指定 Java' })).toBe(true)
    select.vm.$emit('update:value', 'manual')
    expect(wrapper.emitted('update:modelValue')).toEqual([['manual']])
    expect(wrapper.emitted('change')).toEqual([['manual']])
    await wrapper.setProps({ disabled: true })
    select.vm.$emit('update:value', 'automatic')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })

  it('空字符串业务选项可以被选中并显示', () => {
    const wrapper = mount(UiSelect, {
      attachTo: '#app',
      global,
      props: { modelValue: '', options: [{ value: '', label: '全部' }] },
    })
    expect(wrapper.getComponent(NSelect).props('value')).toBe('')
    expect(wrapper.text()).toContain('全部')
  })

  it('滑块填充相对于最小值计算，并限制在轨道范围内', async () => {
    const wrapper = mount(UiSlider, { props: { modelValue: 0.5, min: 0.25, max: 1.25, ariaLabel: '动画速度' } })
    expect(wrapper.get('input').element.style.getPropertyValue('--ui-slider-percent')).toBe('25%')
    expect(wrapper.get('input').attributes('aria-label')).toBe('动画速度')
    await wrapper.setProps({ modelValue: 9 })
    expect(wrapper.get('input').element.style.getPropertyValue('--ui-slider-percent')).toBe('100%')
    await wrapper.setProps({ modelValue: -1 })
    expect(wrapper.get('input').element.style.getPropertyValue('--ui-slider-percent')).toBe('0%')
    await wrapper.setProps({ min: 2, max: 2 })
    expect(wrapper.get('input').element.style.getPropertyValue('--ui-slider-percent')).toBe('0%')
  })

  it('滑块调整提交实际数值，禁用后不提交', async () => {
    const wrapper = mount(UiSlider, { props: { modelValue: 25 } })
    await wrapper.get('input').setValue('75')
    expect(wrapper.emitted('update:modelValue')).toEqual([[75]])
    await wrapper.setProps({ disabled: true })
    await wrapper.get('input').setValue('50')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })
})
