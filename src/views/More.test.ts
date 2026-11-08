import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import More from './More.vue'

describe('More shell', () => {
  it('只提供插件与工具入口，不内置联机页面', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/more/plugins', component: More }],
    })
    await router.push('/more/plugins')
    const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [i18n, router] } })
    expect(wrapper.findAll('.n-menu-item')).toHaveLength(2)
    expect(wrapper.text()).not.toContain(i18n.global.t('more.nav.room'))
    wrapper.unmount()
  })
})
