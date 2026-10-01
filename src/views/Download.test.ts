import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/i18n'
import Download from './Download.vue'

async function mountDownload(query: Record<string, string>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/download', component: { template: '<div />' } }],
  })
  await router.push({ path: '/download', query })
  await router.isReady()
  const wrapper = mount(Download, {
    global: {
      plugins: [router, i18n],
      stubs: {
        OnlineModSearch: {
          props: ['resourceType'],
          template: '<div class="test-resource-type">{{ resourceType }}</div>',
        },
        InstancesTab: { template: '<div class="test-instances" />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('Download navigation', () => {
  it('responds to query changes and removes world only when leaving datapacks', async () => {
    const { wrapper, router } = await mountDownload({
      tab: 'datapack',
      instance: 'instance-key',
      world: 'My World',
      q: 'packs',
    })
    expect(wrapper.get('.test-resource-type').text()).toBe('datapack')
    await router.replace({ query: { tab: 'shaderpack', instance: 'instance-key' } })
    await flushPromises()
    expect(wrapper.get('.test-resource-type').text()).toBe('shaderpack')
    await router.replace({ query: { tab: 'datapack', instance: 'instance-key', world: 'My World' } })
    await flushPromises()
    await wrapper
      .findAll('.download-nav-item')
      .find((button) => button.text().includes('资源包'))!
      .trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ tab: 'resourcepack', instance: 'instance-key' })
    expect(router.currentRoute.value.query.world).toBeUndefined()
    wrapper.unmount()
  })
  it('uses the instance page for unknown tab values', async () => {
    const { wrapper } = await mountDownload({ tab: 'unsupported' })
    expect(wrapper.find('.test-instances').exists()).toBe(true)
    wrapper.unmount()
  })
})
