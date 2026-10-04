import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { globalCache } from '@/cache'
import { i18n } from '@/i18n'
import type { ModSearchItem, ModSearchResult } from '@/types/mods'
import OnlineModSearch from './OnlineModSearch.vue'

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  popular: vi.fn(),
  info: vi.fn(),
  versions: vi.fn(),
  ready: null as Ref<boolean> | null,
}))
vi.mock('@/composables/useResourceInstallTarget', async (original) => ({
  ...(await original<object>()),
  useResourceInstallTarget: () => {
    mocks.ready = ref(false)
    return {
      ready: mocks.ready,
      selectedKey: ref(''),
      selectedInstance: ref(null),
      installableInstances: ref([]),
      compatibleInstances: ref([]),
      setCompatibleFilter: vi.fn(),
      persist: vi.fn(),
      refreshInstances: vi.fn(),
    }
  },
}))
vi.mock('@/cache/composable', () => ({
  useAutoRefreshCache: () => ({ data: ref(null), fetchData: vi.fn() }),
}))
vi.mock('@/features/mods/api/modApi', () => ({
  modApi: { search: mocks.search, info: mocks.info, versions: mocks.versions },
}))
vi.mock('@/features/download/model/downloadQueries', () => ({
  getPopularPage: mocks.popular,
  getResourceSourceConfig: async () => ({ curseforge: { available: true } }),
}))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }),
}))

function row(name: string, alternatives = 1): ModSearchItem {
  return {
    id: name,
    projectId: name,
    groupId: `mod:modrinth:${name}`,
    source: 'modrinth',
    title: name,
    displayTitle: name,
    slug: name,
    author: 'Author',
    description: '',
    downloads: 1,
    follows: 0,
    categories: [],
    loaders: [],
    gameVersions: [],
    projectUrl: '',
    alternatives: [
      { source: 'modrinth', projectId: name, slug: name, projectUrl: '' },
      ...(alternatives === 2 ? [{ source: 'curseforge' as const, projectId: '123', slug: name, projectUrl: '' }] : []),
    ],
  }
}
function result(name: string, page = 1, extra: Partial<ModSearchResult> = {}): ModSearchResult {
  return {
    items: [row(name)],
    sources: {},
    total: 40,
    query: '',
    sessionId: 'session-1',
    page,
    pageCount: 2,
    hasMore: true,
    totalExact: false,
    truncated: false,
    ...extra,
  }
}
async function mountSearch() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  const wrapper = shallowMount(OnlineModSearch, {
    global: {
      plugins: [router, i18n],
      stubs: {
        Button: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
        Scrollbar: { template: '<div><slot /></div>' },
        UiLoading: { props: ['show'], template: '<div :data-loading="show"><slot /></div>' },
        Alert: { template: '<div class="test-alert"><slot /></div>' },
      },
    },
  })
  mocks.ready!.value = true
  await flushPromises()
  return { wrapper, router }
}
function button(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find((entry) => entry.text() === label)!
}

describe('双平台搜索页面', () => {
  beforeEach(() => {
    globalCache.clear()
    vi.resetAllMocks()
    mocks.popular.mockResolvedValue(result('first'))
    mocks.search.mockResolvedValue(result('second', 2))
    mocks.info.mockResolvedValue({ id: 'first', title: 'first', loaders: [], gameVersions: [] })
    mocks.versions.mockResolvedValue([])
  })

  it('使用会话逐页查询，返回第一页重新获取合并入口且不显示虚构总页数', async () => {
    const { wrapper } = await mountSearch()
    expect(wrapper.get('.mods-pagination-info').text()).toBe('第 1 页')
    expect(button(wrapper, '下十页')).toBeUndefined()
    await button(wrapper, i18n.global.t('mods.nextPage')).trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'all', page: 2, session_id: 'session-1', offset: 0 })
    )
    mocks.search.mockResolvedValueOnce(result('first', 1, { items: [row('first', 2)] }))
    await button(wrapper, i18n.global.t('mods.prevPage')).trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, session_id: 'session-1' }))
    expect(wrapper.get('.mod-meta-source').text()).toBe('Modrinth · CurseForge')
    wrapper.unmount()
  })

  it('会话过期只重新建立一次并回到第一页', async () => {
    const { wrapper } = await mountSearch()
    mocks.search.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'SEARCH_SESSION_EXPIRED' }))
    mocks.search.mockResolvedValueOnce(result('fresh', 1, { sessionId: 'new' }))
    await button(wrapper, i18n.global.t('mods.nextPage')).trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenCalledTimes(2)
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, session_id: '', refresh: true }))
    expect(wrapper.get('.mod-row-name').text()).toBe('fresh')
    wrapper.unmount()
  })

  it('失败保留原列表、显示重试，并结束加载', async () => {
    const { wrapper } = await mountSearch()
    mocks.search.mockRejectedValueOnce(new Error('双平台失败'))
    await button(wrapper, i18n.global.t('mods.nextPage')).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('双平台失败')
    expect(button(wrapper, '重试').exists()).toBe(true)
    expect(wrapper.get('.mod-row-name').text()).toBe('first')
    expect(wrapper.get('[data-loading]').attributes('data-loading')).toBe('false')
    wrapper.unmount()
  })

  it('快速切换搜索时旧响应不会覆盖新结果或提前结束加载', async () => {
    const { wrapper, router } = await mountSearch()
    let finishOld!: (value: ModSearchResult) => void
    let finishNew!: (value: ModSearchResult) => void
    mocks.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve
        })
    )
    mocks.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNew = resolve
        })
    )
    await router.replace({ query: { q: 'old' } })
    await flushPromises()
    await router.replace({ query: { q: 'new' } })
    await flushPromises()
    finishOld(result('old'))
    await flushPromises()
    expect(wrapper.get('[data-loading]').attributes('data-loading')).toBe('true')
    expect(wrapper.get('.mod-row-name').text()).toBe('first')
    finishNew(result('new'))
    await flushPromises()
    expect(wrapper.get('.mod-row-name').text()).toBe('new')
    expect(wrapper.get('[data-loading]').attributes('data-loading')).toBe('false')
    wrapper.unmount()
  })

  it('尚有候选但当前无项目时提供继续读取入口', async () => {
    mocks.popular.mockResolvedValueOnce(result('', 1, { items: [], total: 0, pageCount: 0 }))
    const { wrapper } = await mountSearch()
    await button(wrapper, '继续读取').trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'all', page: 1, session_id: 'session-1' })
    )
    wrapper.unmount()
  })
})
