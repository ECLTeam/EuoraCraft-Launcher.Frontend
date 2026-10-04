import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import Modal from '@/components/modals/Modal.vue'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import SettingSection from '@/features/settings/components/SettingSection.vue'
import { i18n } from '@/i18n'
import Card from './Card.vue'

afterEach(() => {
  globalModalStack.reset()
  document.body.innerHTML = ''
})

describe('共享标题图标', () => {
  it('标准卡片与设置分组缺省提供离线 SVG 图标，业务图标可覆盖', async () => {
    const card = mount(Card, { props: { title: '标准卡片' } })
    const section = mount(SettingSection, { props: { title: '设置' } })
    expect(card.find('.card-header .icon-cube svg').exists()).toBe(true)
    expect(section.find('.settings-section__header .icon-settings svg').exists()).toBe(true)
    await card.setProps({ icon: 'icon-download' })
    expect(card.find('.card-header .icon-download svg').exists()).toBe(true)
    await section.setProps({ icon: 'palette' })
    expect(section.find('.settings-section__header .icon-palette svg').exists()).toBe(true)
    card.unmount()
    section.unmount()
  })

  it('普通小弹窗有默认标题图标，并保留自定义业务图标', async () => {
    const modal = mount(Modal, {
      props: { visible: true, title: '详情' },
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await nextTick()
    expect(document.querySelector('.header-title .icon-info svg')).not.toBeNull()
    await modal.setProps({ icon: 'download' })
    expect(document.querySelector('.header-title .icon-download svg')).not.toBeNull()
    modal.unmount()
  })
})
