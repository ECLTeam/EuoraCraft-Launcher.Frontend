/* eslint-disable vue/one-component-per-file -- 测试挂载用辅助组件 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { resetSectionMemory } from '@/app/runtime/sectionMemory'
import { i18n } from '@/i18n'
import SectionLayout from './SectionLayout.vue'

const TallPage = defineComponent({ render: () => h('div', { style: 'height: 2000px' }, '子页面') })
const OtherPage = defineComponent({ render: () => h('div', '其他页面') })

const SectionHost = defineComponent({
  components: { SectionLayout },
  setup: () => ({
    items: [
      { path: '/settings/launcher', label: '启动器', icon: 'settings' },
      { path: '/settings/game', label: '游戏', icon: 'game' },
    ],
  }),
  template: '<SectionLayout title="设置" icon="settings" :items="items"><router-view /></SectionLayout>',
})

const RootHost = defineComponent({ template: '<router-view />' })

let wrapper: VueWrapper
let router: Router

async function mountSection(path: string): Promise<HTMLElement> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/other', component: OtherPage },
      {
        path: '/settings',
        component: SectionHost,
        children: [
          { path: 'launcher', component: TallPage },
          { path: 'game', component: TallPage },
        ],
      },
    ],
  })
  await router.push(path)
  wrapper = mount(RootHost, { attachTo: document.body, global: { plugins: [i18n, router] } })
  await flushPromises()
  await nextTick()
  return wrapper.get('.section-layout__viewport').element as HTMLElement
}

beforeEach(() => {
  resetSectionMemory()
  // jsdom 默认不提供动画帧，测试里同步执行，避免等待真实帧
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})

afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

describe('分区布局的滚动记忆', () => {
  it('切换子页面时记住各自位置，返回后恢复', async () => {
    const viewport = await mountSection('/settings/launcher')
    viewport.scrollTop = 240

    await router.push('/settings/game')
    await flushPromises()
    expect(viewport.scrollTop).toBe(0)

    viewport.scrollTop = 80
    await router.push('/settings/launcher')
    await flushPromises()
    expect(viewport.scrollTop).toBe(240)

    await router.push('/settings/game')
    await flushPromises()
    expect(viewport.scrollTop).toBe(80)
  })

  it('离开分区再回来时仍回到上次的子页面位置', async () => {
    const viewport = await mountSection('/settings/launcher')
    viewport.scrollTop = 360

    await router.push('/other')
    await flushPromises()

    const restoredViewport = await mountSection('/settings/launcher')
    expect(restoredViewport.scrollTop).toBe(360)
  })
})
