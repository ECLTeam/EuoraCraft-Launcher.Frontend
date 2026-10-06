import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type backend from '@/api/client'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { i18n } from '@/i18n'
import LauncherTab from './LauncherTab.vue'

const mocks = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/api/client', async (importOriginal) => {
  const original = await importOriginal<{ default: typeof backend }>()
  return { default: { ...original.default, command: mocks.command } }
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}))
enableAutoUnmount(afterEach)

let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let scroll: ReturnType<typeof vi.fn>
let animations: ReturnType<typeof vi.fn>

async function advanceFrames() {
  for (let index = 0; index < 2; index++) {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(performance.now()))
    await flushPromises()
  }
}

async function mountSettings(query: Record<string, string> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings/launcher', component: LauncherTab }],
  })
  await router.push({ path: '/settings/launcher', query })
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.spyOn(useSettingsStore(pinia), 'load').mockResolvedValue(undefined)
  const wrapper = mount(LauncherTab, {
    attachTo: document.body,
    global: { plugins: [i18n, router, pinia], stubs: { PluginSlotHost: true, UiIcon: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('LauncherTab 联机设置定位', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
    frames = new Map()
    nextFrame = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    scroll = vi.fn()
    animations = vi.fn().mockReturnValue([])
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', { configurable: true, value: animations })
    mocks.command.mockReset().mockResolvedValue({ success: true, data: { mode: 'automatic', nodes: [] } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('挂载联机表单，普通进入和未知参数不滚动', async () => {
    const { wrapper, router } = await mountSettings()
    expect(wrapper.find('[data-settings-section="connector"] .node-settings-form').exists()).toBe(true)
    await advanceFrames()
    expect(scroll).not.toHaveBeenCalled()
    await router.push({ query: { section: 'unknown' } })
    await advanceFrames()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('快捷进入后定位并聚焦，已挂载页面更新参数也能定位', async () => {
    const { wrapper, router } = await mountSettings({ section: 'connector' })
    await advanceFrames()
    const target = wrapper.get('[data-settings-section="connector"]').element
    expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
    expect(document.activeElement).toBe(target)
    scroll.mockClear()
    await router.push({ query: {} })
    await router.push({ query: { section: 'connector' } })
    await flushPromises()
    await advanceFrames()
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('等待进入动画完成，取消定位后不会因动画完成而抢焦点', async () => {
    let finishAnimation!: () => void
    animations.mockReturnValue([
      {
        finished: new Promise<void>((resolve) => {
          finishAnimation = resolve
        }),
      },
    ])
    const { router } = await mountSettings({ section: 'connector' })
    await advanceFrames()
    expect(scroll).not.toHaveBeenCalled()
    await router.push({ query: {} })
    finishAnimation()
    await flushPromises()
    expect(scroll).not.toHaveBeenCalled()
  })

  it('页面卸载清理待执行定位', async () => {
    const { wrapper } = await mountSettings({ section: 'connector' })
    expect(frames.size).toBe(1)
    wrapper.unmount()
    await advanceFrames()
    expect(frames.size).toBe(0)
    expect(scroll).not.toHaveBeenCalled()
  })

  it('模组源下拉展示官方与 MCIM，切换后提交下载配置补丁', async () => {
    const { wrapper } = await mountSettings()
    const rows = wrapper.findAll('.setting-item')
    const modSourceRow = rows.find((row) => row.text().includes(i18n.global.t('settings.modSource')))
    expect(modSourceRow).toBeTruthy()

    const store = useSettingsStore()
    const patchDownload = vi.spyOn(store, 'patchDownload').mockResolvedValue(undefined)
    await modSourceRow!.getComponent(NSelect).vm.$emit('update:value', 'mcim')
    await flushPromises()

    expect(patchDownload).toHaveBeenCalledWith({ mod_source: 'mcim' })
  })

  it('游戏下载源标签与模组源分开显示', async () => {
    const { wrapper } = await mountSettings()
    const text = wrapper.text()
    expect(text).toContain(i18n.global.t('settings.gameDownloadSource'))
    expect(text).toContain(i18n.global.t('settings.modSource'))
  })
})
