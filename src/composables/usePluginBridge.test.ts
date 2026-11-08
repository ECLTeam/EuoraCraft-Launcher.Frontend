import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, onBeforeUnmount } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  clearPluginSlots,
  clearPluginVueSlots,
  fullCleanupPlugin,
  pluginRoutes,
  pluginSlots,
  pluginVueSlots,
  renderSlot,
  scopePluginCss,
} from './usePluginBridge'

beforeEach(() => {
  document.body.innerHTML = ''
  pluginSlots.value = {}
  pluginVueSlots.value = {}
  pluginRoutes.value = []
})

describe('plugin frontend styles', () => {
  it('lets Vue unmount the active page and its teleported modal before removing DOM', async () => {
    const connectedAtUnmount: boolean[] = []
    const page = defineComponent({
      setup() {
        onBeforeUnmount(() => {
          connectedAtUnmount.push(!!document.querySelector('.plugin-test-page')?.isConnected)
          connectedAtUnmount.push(!!document.querySelector('.plugin-test-modal')?.isConnected)
        })
      },
      template:
        '<div data-plugin="demo" class="plugin-test-page"><Teleport to="body"><div data-plugin="demo" class="plugin-test-modal" /></Teleport></div>',
    })
    const appRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/more/plugins', component: { template: '<div>插件</div>' } },
        { path: '/more/room', name: 'plugin-test-page', component: page, meta: { pluginName: 'demo' } },
      ],
    })
    await appRouter.push('/more/room')
    const wrapper = mount({ template: '<RouterView />' }, { attachTo: document.body, global: { plugins: [appRouter] } })
    try {
      await flushPromises()
      await fullCleanupPlugin('demo', appRouter)
      await flushPromises()
      expect(connectedAtUnmount).toEqual([true, true])
      expect(document.querySelector('.plugin-test-modal')).toBeNull()
      expect(appRouter.currentRoute.value.path).toBe('/more/plugins')
    } finally {
      wrapper.unmount()
    }
  })
  it('limits injected CSS to the plugin root', () => {
    expect(scopePluginCss('demo', '.title { color: red; }')).toBe(
      '@scope ([data-plugin="demo"]) {\n.title { color: red; }\n}'
    )
  })

  it('removes disabled plugin HTML while keeping other entries', () => {
    document.body.innerHTML = '<div id="plugin-slot-sidebar-bottom"></div>'
    pluginSlots.value = {
      'sidebar-bottom': [
        { plugin: 'demo', html: '<span>demo</span>' },
        { plugin: 'other', html: '<span>other</span>' },
      ],
    }
    renderSlot('sidebar-bottom')

    clearPluginSlots('demo')

    expect(pluginSlots.value['sidebar-bottom']).toEqual([{ plugin: 'other', html: '<span>other</span>' }])
    expect(document.querySelector('[data-plugin="demo"]')).toBeNull()
    expect(document.querySelector('[data-plugin="other"]')?.textContent).toBe('other')
  })

  it('removes disabled plugin Vue slot definitions', () => {
    pluginVueSlots.value = {
      'sidebar-bottom': [
        { plugin: 'demo', component_name: 'demo-card', template: '<div />', script: '', style: '' },
        { plugin: 'other', component_name: 'other-card', template: '<div />', script: '', style: '' },
      ],
    }

    clearPluginVueSlots('demo')

    expect(pluginVueSlots.value['sidebar-bottom']).toEqual([
      { plugin: 'other', component_name: 'other-card', template: '<div />', script: '', style: '' },
    ])
  })

  it('removes disabled plugin routes and leaves its active page', async () => {
    const appRouter = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
    })
    appRouter.addRoute({
      path: '/plugin/demo/page',
      name: 'plugin-demo-page',
      component: { template: '<div />' },
      meta: { pluginRoute: true, pluginName: 'demo' },
    })
    pluginRoutes.value = [
      { plugin: 'demo', path: '/page', title: 'Demo' },
      { plugin: 'other', path: '/page', title: 'Other' },
    ]
    await appRouter.push('/plugin/demo/page')

    await fullCleanupPlugin('demo', appRouter)

    expect(pluginRoutes.value).toEqual([{ plugin: 'other', path: '/page', title: 'Other' }])
    expect(appRouter.hasRoute('plugin-demo-page')).toBe(false)
    expect(appRouter.currentRoute.value.path).toBe('/more/plugins')
  })
})
