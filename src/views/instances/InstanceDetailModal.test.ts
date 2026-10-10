import { flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InstanceResourcesTab from '@/components/instances/InstanceResourcesTab.vue'
import { instanceKey } from '@/composables/useResourceInstallTarget'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import type { ScannedVersion } from '@/types/instances'
import InstanceDetailModal from './InstanceDetailModal.vue'
import type * as NaiveUi from 'naive-ui'
import type * as VueRouter from 'vue-router'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  resetSettings: vi.fn(),
  selectJava: vi.fn(),
  openFolder: vi.fn(),
  getStats: vi.fn(),
  onStatsChanged: vi.fn(),
  analyzeCrash: vi.fn(),
  listCrashCandidates: vi.fn(),
}))
const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return { ...actual, useRouter: () => ({ push: mocks.push }) }
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }),
}))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

vi.mock('@/features/instances/api/instanceSettingsApi', () => ({
  instanceSettingsApi: {
    get: mocks.getSettings,
    save: mocks.saveSettings,
    reset: mocks.resetSettings,
    selectJava: mocks.selectJava,
  },
}))

// 测试环境没有挂载 n-dialog-provider，mock useDialog 避免组件 setup 抛错
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof NaiveUi>()
  return {
    ...actual,
    useDialog: () => ({
      warning: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    }),
  }
})

vi.mock('@/features/instances/api/instanceInstallApi', () => ({
  instanceInstallApi: {
    openFolder: mocks.openFolder,
  },
}))

vi.mock('@/features/instances/api/instanceRuntimeApi', () => ({
  instanceRuntimeApi: {
    getStats: mocks.getStats,
    onChanged: mocks.onStatsChanged,
    analyzeCrash: mocks.analyzeCrash,
    listCrashCandidates: mocks.listCrashCandidates,
  },
}))

const version: ScannedVersion = {
  id: '1.21.5',
  versionId: '1.21.5',
  versionType: 'release',
  path: 'D:/Games/.minecraft',
  displayName: '1.21.5',
  primaryLoader: 'Vanilla',
  vanillaName: '1.21.5',
  hasForge: false,
  hasNeoForge: false,
  hasFabric: false,
  hasQuilt: false,
  hasOptiFine: false,
  jsonPath: 'D:/Games/.minecraft/versions/1.21.5/1.21.5.json',
}

const wrappers: ReturnType<typeof mount>[] = []
function mountModal(
  initialTab: 'overview' | 'mods' | 'settings' | 'resourcepacks' = 'settings',
  targetVersion = version
) {
  const wrapper = mount(InstanceDetailModal, {
    global: {
      plugins: [i18n],
      stubs: { Teleport: true },
    },
    props: {
      visible: true,
      version: targetVersion,
      initialTab,
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('InstanceDetailModal', () => {
  afterEach(async () => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
    await flushPromises()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSettings.mockResolvedValue({
      isolationMode: 'inherit',
      customMemory: false,
      memory: 4096,
      customJava: false,
      javaPath: '',
      jvmArgs: '',
      gameArgs: '',
    })
    mocks.getStats.mockResolvedValue({
      launchCount: 4,
      lastRunDurationSeconds: 65,
      totalRunDurationSeconds: 3665,
    })
    mocks.onStatsChanged.mockReturnValue(vi.fn())
    mocks.listCrashCandidates.mockResolvedValue([
      { path: 'D:/Games/.minecraft/logs/latest.log', name: 'latest.log', size: 1024, mtime: 1700000000 },
    ])
    mocks.analyzeCrash.mockResolvedValue({
      reportId: 'b'.repeat(32),
      versionId: '1.21.5',
      exitCode: null,
      detectedBy: ['manual'],
      reasons: [],
      sourceFiles: ['latest.log'],
      hasOutput: true,
    })
  })

  it('navigates resource search to downloads while retaining instance, world and query', async () => {
    mock.state!.mocks.command.mockResolvedValue({ success: true, data: [] })
    const wrapper = mountModal('resourcepacks')
    await flushPromises()
    wrapper
      .getComponent(InstanceResourcesTab)
      .vm.$emit('openOnlineSearch', { type: 'datapack', worldId: 'My World', query: 'custom query' })
    expect(mocks.push).toHaveBeenCalledWith({
      name: 'download',
      query: { tab: 'datapack', instance: instanceKey(version), world: 'My World', q: 'custom query' },
    })
    expect(wrapper.emitted('update:visible')).toContainEqual([false])
  })

  it('uses horizontal tabs and opens the requested settings page', async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.find('.vdm-tabs').exists()).toBe(true)
    expect(wrapper.find('.version-settings-page').exists()).toBe(true)
    expect(
      wrapper
        .findAllComponents(NSelect)
        .filter((select) => select.props('options')?.some((option) => option.value === 'auto'))
    ).toHaveLength(2)
    expect(mocks.getSettings).toHaveBeenCalledWith({
      versionId: '1.21.5',
      path: 'D:/Games/.minecraft',
    })
  })

  it('hides mod management for a vanilla instance and falls back to overview', async () => {
    const wrapper = mountModal('mods')
    await flushPromises()

    expect(wrapper.findAll('.vdm-tab-button').some((button) => button.text().includes('模组管理'))).toBe(false)
    expect(wrapper.find('.overview-page').exists()).toBe(true)
  })

  it('shows mod management for a mod-loader instance', async () => {
    const fabricVersion: ScannedVersion = {
      ...version,
      id: 'fabric-loader-0.16.14-1.21.5',
      versionId: 'fabric-loader-0.16.14-1.21.5',
      displayName: '1.21.5 Fabric',
      primaryLoader: 'Fabric',
      hasFabric: true,
    }
    const wrapper = mountModal('overview', fabricVersion)
    await flushPromises()

    expect(wrapper.findAll('.vdm-tab-button').some((button) => button.text().includes('模组管理'))).toBe(true)
  })

  it('switches from version settings to the compact overview page', async () => {
    const wrapper = mountModal()
    await flushPromises()
    const overviewTab = wrapper.findAll('.vdm-tab-button').find((button) => button.text().includes('总览'))

    await overviewTab?.trigger('click')

    expect(wrapper.find('.overview-page').exists()).toBe(true)
    expect(wrapper.findAll('.info-item')).toHaveLength(6)
    expect(wrapper.text()).toContain('4 次')
    expect(wrapper.text()).toContain('1m 5s')
    expect(mocks.getStats).toHaveBeenCalledWith('D:/Games/.minecraft', '1.21.5')
  })

  it('opens the crash log picker and lists detected logs from the instance folder', async () => {
    const wrapper = mountModal('overview')
    await flushPromises()
    const analyzeButton = wrapper.findAll('button').find((button) => button.text().includes('分析崩溃日志'))

    await analyzeButton?.trigger('click')
    await flushPromises()

    expect(mocks.listCrashCandidates).toHaveBeenCalledWith('D:/Games/.minecraft', '1.21.5')
    expect(wrapper.find('.crash-picker-modal').exists()).toBe(true)
  })

  it('closing the crash log picker does not analyze anything', async () => {
    const wrapper = mountModal('overview')
    await flushPromises()
    const analyzeButton = wrapper.findAll('button').find((button) => button.text().includes('分析崩溃日志'))

    await analyzeButton?.trigger('click')
    await flushPromises()

    expect(wrapper.find('.crash-picker-modal').exists()).toBe(true)
    expect(mocks.analyzeCrash).not.toHaveBeenCalled()
  })

  it('user edits auto-save after 300ms debounce', async () => {
    vi.useFakeTimers()
    const wrapper = mountModal()
    await flushPromises()
    wrapper
      .findAllComponents(NSelect)
      .find((select) => select.props('options')?.some((option) => option.value === 'auto'))!
      .vm.$emit('update:value', 'manual')
    await wrapper.vm.$nextTick()
    await vi.advanceTimersByTimeAsync(300)
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1)
    expect(mocks.saveSettings).toHaveBeenCalledWith(
      { versionId: '1.21.5', path: 'D:/Games/.minecraft' },
      expect.objectContaining({ memoryMode: 'manual' })
    )
    vi.useRealTimers()
  })

  it('does not auto-save during settings load', async () => {
    mountModal()
    await flushPromises()
    expect(mocks.saveSettings).not.toHaveBeenCalled()
  })

  it('flushes pending settings save when modal closes', async () => {
    vi.useFakeTimers()
    const wrapper = mountModal()
    await flushPromises()
    wrapper
      .findAllComponents(NSelect)
      .find((select) => select.props('options')?.some((option) => option.value === 'auto'))!
      .vm.$emit('update:value', 'manual')
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ visible: false })
    await flushPromises()
    expect(mocks.saveSettings).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
