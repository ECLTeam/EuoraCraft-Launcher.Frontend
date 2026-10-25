import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiIcon from '@/components/ui/Icon.vue'
import { i18n } from '@/i18n'
import ConfirmDialog from './ConfirmDialog.vue'
import Modal from './Modal.vue'

function mountDialog(overrides: Partial<InstanceType<typeof ConfirmDialog>['$props']> = {}) {
  return mount(ConfirmDialog, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      stubs: {
        UiIcon: true,
      },
    },
    props: {
      visible: true,
      title: '确认操作',
      content: '该操作不可撤销',
      ...overrides,
    },
  })
}

describe('ConfirmDialog', () => {
  it.each([true, false])('危险状态 %s 使用符合操作含义的图标', (danger) => {
    const wrapper = mountDialog({ danger })
    expect(wrapper.getComponent(Modal).findComponent(UiIcon).props('name')).toBe(danger ? 'warning' : 'help')
    wrapper.unmount()
  })
  it('确认后发出操作事件并默认关闭', async () => {
    const wrapper = mountDialog()
    const buttons = document.body.querySelectorAll('button')

    await buttons[buttons.length - 1]?.click()

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    wrapper.unmount()
  })

  it('加载状态下不会取消操作', async () => {
    const wrapper = mountDialog({ loading: true })
    const buttons = document.body.querySelectorAll('button')

    await buttons[0]?.click()

    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    wrapper.unmount()
  })

  it('禁用确认时不会发出操作事件', async () => {
    const wrapper = mountDialog({ confirmDisabled: true })
    const buttons = document.body.querySelectorAll('button')

    await buttons[buttons.length - 1]?.click()

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    wrapper.unmount()
  })
})
