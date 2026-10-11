import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import backend from '@/api/client'
import { globalCache } from '@/cache'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import ResourceInstanceSelect from '@/components/resources/ResourceInstanceSelect.vue'
import type { DownloadResourceType } from '@/features/download/model/downloadQueries'
import { i18n } from '@/i18n'
import type { ScannedVersion } from '@/types/instances'
import type { ModSearchItem, ModSearchResult } from '@/types/mods'
import OnlineModSearch from './OnlineModSearch.vue'

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  popular: vi.fn(),
  info: vi.fn(),
  versions: vi.fn(),
  ready: null as Ref<boolean> | null,
  instance: null as Ref<ScannedVersion | null> | null,
  openOnline: vi.fn(),
}))
vi.mock('@/composables/useResourceInstallTarget', async (original) => ({
  ...(await original<object>()),
  useResourceInstallTarget: () => {
    mocks.ready = ref(false)
    mocks.instance = ref(null)
    return {
      ready: mocks.ready,
      selectedKey: ref(''),
      selectedInstance: mocks.instance,
      installableInstances: ref([]),
      compatibleInstances: ref([]),
      setCompatibleFilter: vi.fn(),
      persist: vi.fn(),
      refreshInstances: vi.fn(),
      clearTarget: () => {
        mocks.instance!.value = null
      },
    }
  },
}))
vi.mock('@/cache/composable', () => ({
  useAutoRefreshCache: () => ({ data: ref(null), fetchData: vi.fn() }),
}))
vi.mock('@/features/mods/api/modApi', () => ({
  modApi: { search: mocks.search, info: mocks.info, versions: mocks.versions },
}))
vi.mock('@/features/instances/stores/modpackImportStore', () => ({
  useModpackImportStore: () => ({ openOnline: mocks.openOnline }),
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
async function mountSearch(resourceType: DownloadResourceType = 'mod') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  const wrapper = shallowMount(OnlineModSearch, {
    props: { resourceType },
    global: {
      plugins: [router, i18n],
      stubs: {
        Button: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
        Scrollbar: { template: '<div><slot /></div>' },
        UiLoading: { props: ['show'], template: '<div :data-loading="show"><slot /></div>' },
        Alert: { template: '<div class="test-alert"><slot /></div>' },
        FullscreenModal: {
          props: ['visible'],
          template: '<div v-if="visible" class="test-details"><slot /><slot name="footer" /></div>',
        },
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
    mocks.search.mockResolvedValue(result('second', 2, { hasMore: false, totalExact: true }))
    mocks.info.mockResolvedValue({ id: 'first', title: 'first', loaders: [], gameVersions: [] })
    mocks.versions.mockResolvedValue([])
    vi.spyOn(backend, 'command').mockResolvedValue({ success: true, data: { path: null } })
    vi.spyOn(backend.config, 'get').mockResolvedValue({ success: true, data: {} })
  })

  it('预加载会话后缓存切页，返回第一页仍保留合并来源且不显示虚构总页数', async () => {
    mocks.popular.mockResolvedValueOnce(result('first', 1, { items: [row('first', 2)] }))
    const { wrapper } = await mountSearch()
    expect(wrapper.get('.mods-pagination-info').text()).toBe('第 1 页')
    expect(button(wrapper, '下十页')).toBeUndefined()
    await button(wrapper, i18n.global.t('mods.nextPage')).trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'all', page: 2, session_id: 'session-1', offset: 0 })
    )
    const requestCount = mocks.search.mock.calls.length
    await button(wrapper, i18n.global.t('mods.prevPage')).trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenCalledTimes(requestCount)
    expect(wrapper.get('.mod-meta-source').text()).toBe('Modrinth · CurseForge')
    wrapper.unmount()
  })

  it('会话过期只重新建立一次并回到第一页', async () => {
    mocks.search.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'SEARCH_SESSION_EXPIRED' }))
    const { wrapper } = await mountSearch()
    mocks.search.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'SEARCH_SESSION_EXPIRED' }))
    mocks.popular.mockResolvedValueOnce(result('fresh', 1, { sessionId: 'new', hasMore: false }))
    await button(wrapper, i18n.global.t('mods.nextPage')).trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenCalledTimes(2)
    expect(mocks.popular).toHaveBeenLastCalledWith('mod', null, '', true)
    expect(wrapper.get('.mod-row-name').text()).toBe('fresh')
    wrapper.unmount()
  })

  it('失败保留原列表、显示重试，并结束加载', async () => {
    mocks.search.mockRejectedValueOnce(new Error('后台读取失败'))
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
    mocks.search.mockResolvedValueOnce(result('first', 1, { hasMore: false }))
    await button(wrapper, '继续读取').trigger('click')
    await flushPromises()
    expect(mocks.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: 'all', page: 1, session_id: 'session-1' })
    )
    wrapper.unmount()
  })

  it('详情文件数量按 ID 去重，分组展开不触发另存为', async () => {
    mocks.versions.mockResolvedValue([
      {
        id: 'shared',
        projectId: 'first',
        name: 'AppleSkin',
        versionNumber: '3.0',
        gameVersions: ['1.21.8', '1.21.7'],
        loaders: ['fabric', 'neoforge'],
        filename: 'shared.jar',
        downloads: 1,
        releaseType: 'release',
      },
      {
        id: 'single',
        projectId: 'first',
        name: 'AppleSkin',
        versionNumber: '2.0',
        gameVersions: ['1.21.8'],
        loaders: ['fabric'],
        filename: 'single.jar',
        downloads: 1,
        releaseType: 'release',
      },
    ])
    const { wrapper } = await mountSearch()
    await wrapper.get('.mod-row').trigger('click')
    await flushPromises()
    expect(wrapper.get('.version-result-count').text()).toBe('2 个文件')
    expect(wrapper.findAll('.version-group-header')).toHaveLength(4)
    await wrapper.get('.version-group-header').trigger('click')
    await flushPromises()
    expect(backend.command).not.toHaveBeenCalledWith('select_save_file', expect.anything())
    await wrapper.get('.version-file-row').trigger('click')
    await flushPromises()
    expect(backend.command).toHaveBeenCalledWith('select_save_file', expect.objectContaining({ purpose: 'mod-file' }))
    wrapper.unmount()
  })

  it.each(['mod', 'resourcepack', 'shaderpack', 'datapack', 'world'] as const)(
    '未绑定实例的 %s 详情明确显示另存为语义',
    async (resourceType) => {
      const { wrapper } = await mountSearch(resourceType)
      await wrapper.get('.mod-row').trigger('click')
      await flushPromises()
      const target = wrapper
        .findAllComponents(ResourceInstanceSelect)
        .find((component) => component.props('compatibleOnly'))!
      expect(target.props('noneLabel')).toBe('未选择实例')
      expect(wrapper.get('.detail-target-hint').text()).toBe('选择文件后可另存为')
      expect(wrapper.find('.detail-loader-field').exists()).toBe(resourceType === 'mod')
      wrapper.unmount()
    }
  )

  it('整合包详情不显示安装到既有实例或另存为提示', async () => {
    const { wrapper } = await mountSearch('modpack')
    await wrapper.get('.mod-row').trigger('click')
    await flushPromises()
    expect(
      wrapper.findAllComponents(ResourceInstanceSelect).filter((component) => component.props('compatibleOnly'))
    ).toHaveLength(0)
    expect(wrapper.find('.detail-target-hint').exists()).toBe(false)
    wrapper.unmount()
  })

  it('整合包忽略共享实例，加载和展开分组不跳过版本选择页', async () => {
    mocks.versions.mockResolvedValue([
      {
        id: 'pack',
        projectId: 'first',
        name: 'Pack',
        versionNumber: '1.0',
        gameVersions: ['1.21.8'],
        loaders: ['fabric'],
        filename: 'pack.mrpack',
        downloads: 1,
        releaseType: 'release',
      },
    ])
    const { wrapper } = await mountSearch('modpack')
    mocks.instance!.value = {
      path: 'D:/Fixture',
      versionId: 'fixture',
      vanillaName: '1.21.8',
      primaryLoader: 'fabric',
      displayName: 'Fixture',
    } as ScannedVersion
    await wrapper.get('.mod-row').trigger('click')
    await flushPromises()
    expect(mocks.openOnline).not.toHaveBeenCalled()
    await wrapper.get('.version-group-header').trigger('click')
    await flushPromises()
    expect(mocks.openOnline).not.toHaveBeenCalled()
    await wrapper.get('.version-file-row').trigger('click')
    await flushPromises()
    expect(mocks.openOnline).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'pack' }))
    wrapper.unmount()
  })

  it('详情来源切换后只显示新来源文件，文件数量随筛选更新', async () => {
    mocks.popular.mockResolvedValue(result('first', 1, { items: [row('first', 2)] }))
    mocks.versions
      .mockResolvedValueOnce([
        {
          id: 'old',
          projectId: 'first',
          name: 'old',
          versionNumber: 'old',
          gameVersions: ['1.21.8'],
          loaders: ['fabric'],
          filename: 'old.jar',
          downloads: 1,
          releaseType: 'release',
        },
      ])
      .mockResolvedValueOnce([])
    const { wrapper } = await mountSearch()
    await wrapper.get('.mod-row').trigger('click')
    await flushPromises()
    expect(wrapper.get('.version-result-count').text()).toBe('1 个文件')
    const source = wrapper
      .findAllComponents(NSelect)
      .find((component) => component.classes().includes('detail-source-select'))!
    source.vm.$emit('update:value', 'curseforge:123')
    await flushPromises()
    expect(wrapper.get('.version-result-count').text()).toBe('0 个文件')
    expect(wrapper.find('.version-group-header').exists()).toBe(false)
    expect(wrapper.get('.version-hint').text()).toBe('当前条件下没有可用文件')
    wrapper.unmount()
  })

  it('实例选择同步条件，具体文件进入安装确认而不是另存为', async () => {
    mocks.versions.mockResolvedValue([
      {
        id: 'fabric-file',
        projectId: 'first',
        name: 'AppleSkin',
        versionNumber: '3.0',
        gameVersions: ['1.21.8'],
        loaders: ['fabric'],
        filename: 'fabric.jar',
        downloads: 1,
        releaseType: 'release',
      },
      {
        id: 'neoforge-file',
        projectId: 'first',
        name: 'AppleSkin',
        versionNumber: '3.0',
        gameVersions: ['1.21.8'],
        loaders: ['neoforge'],
        filename: 'neoforge.jar',
        downloads: 1,
        releaseType: 'release',
      },
    ])
    const { wrapper } = await mountSearch()
    await wrapper.get('.mod-row').trigger('click')
    await flushPromises()
    mocks.instance!.value = {
      path: 'D:/Fixture',
      versionId: 'fixture',
      vanillaName: '1.21.8',
      primaryLoader: 'fabric',
      displayName: 'Fixture',
    } as ScannedVersion
    await flushPromises()
    expect(wrapper.get('.version-result-count').text()).toBe('1 个文件')
    expect(wrapper.find('.detail-target-hint').exists()).toBe(false)
    await wrapper.get('.version-group-header').trigger('click')
    await wrapper.get('.version-file-row').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(ConfirmDialog).props('visible')).toBe(true)
    expect(backend.command).not.toHaveBeenCalledWith('select_save_file', expect.anything())
    wrapper.unmount()
  })

  it('修改为不兼容的筛选条件后清空实例并恢复另存为提示', async () => {
    mocks.versions.mockResolvedValue([
      {
        id: 'file',
        projectId: 'first',
        name: 'AppleSkin',
        versionNumber: '3.0',
        gameVersions: ['1.21.8', '1.21.7'],
        loaders: ['fabric'],
        filename: 'fabric.jar',
        downloads: 1,
        releaseType: 'release',
      },
    ])
    const { wrapper } = await mountSearch()
    await wrapper.get('.mod-row').trigger('click')
    await flushPromises()
    mocks.instance!.value = {
      path: 'D:/Fixture',
      versionId: 'fixture',
      vanillaName: '1.21.8',
      primaryLoader: 'fabric',
      displayName: 'Fixture',
    } as ScannedVersion
    await flushPromises()
    const gameVersion = wrapper
      .findAllComponents(NSelect)
      .find((component) => component.element.closest('.detail-game-version-field'))!
    gameVersion.vm.$emit('update:value', '1.21.7')
    await flushPromises()
    expect(mocks.instance!.value).toBeNull()
    expect(wrapper.get('.detail-target-hint').text()).toBe('选择文件后可另存为')
    wrapper.unmount()
  })
})
