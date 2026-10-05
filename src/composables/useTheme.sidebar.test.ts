import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useThemeStore } from '@/composables/useTheme'
import { settingsApi } from '@/features/settings/api/settingsApi'
import type * as SettingsModule from '@/features/settings/api/settingsApi'

vi.mock('@/features/settings/api/settingsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof SettingsModule>()
  return {
    ...actual,
    settingsApi: {
      ...actual.settingsApi,
      isAvailable: true,
      getUi: vi.fn().mockResolvedValue({}),
      saveUi: vi.fn().mockResolvedValue(undefined),
    },
  }
})

const storageKey = 'euoracraft-sidebar-collapsed'

describe('侧栏折叠状态本地保存', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([true, false])('创建 Store 时恢复本地 %s，并优先于相反旧配置', async (collapsed) => {
    localStorage.setItem(storageKey, String(collapsed))
    const store = useThemeStore(createPinia())
    expect(store.sidebarCollapsed).toBe(collapsed)

    await store.initTheme({ theme: { sidebar_collapsed: !collapsed } })
    expect(store.sidebarCollapsed).toBe(collapsed)
  })

  it.each([null, 'invalid', '1'])('本地没有有效值 %s 时默认折叠，不迁移旧配置', async (storedValue) => {
    if (storedValue !== null) localStorage.setItem(storageKey, storedValue)
    const store = useThemeStore(createPinia())
    await store.initTheme({ theme: { sidebar_collapsed: false } })
    expect(store.sidebarCollapsed).toBe(true)
    expect(localStorage.getItem(storageKey)).toBe(storedValue)
    expect(settingsApi.saveUi).not.toHaveBeenCalled()
  })

  it('切换后恢复最后状态，不读取或保存全局设置', async () => {
    const store = useThemeStore(createPinia())
    store.setSidebarCollapsed(false)
    store.setSidebarCollapsed(true)
    store.setSidebarCollapsed(false)
    await vi.advanceTimersByTimeAsync(200)

    expect(document.documentElement.dataset.sidebarCollapsed).toBe('0')
    expect(localStorage.getItem(storageKey)).toBe('false')
    expect(useThemeStore(createPinia()).sidebarCollapsed).toBe(false)
    expect(settingsApi.getUi).not.toHaveBeenCalled()
    expect(settingsApi.saveUi).not.toHaveBeenCalled()
  })

  it('同值操作不重复写入', async () => {
    const store = useThemeStore(createPinia())
    const write = vi.spyOn(Storage.prototype, 'setItem')
    store.setSidebarCollapsed(true)
    expect(write).not.toHaveBeenCalled()

    store.setSidebarCollapsed(false)
    write.mockClear()
    store.setSidebarCollapsed(false)
    expect(write).not.toHaveBeenCalled()
  })

  it('用户先切换，迟到的初始配置和后续刷新都不能覆盖', async () => {
    const store = useThemeStore(createPinia())
    store.setSidebarCollapsed(false)
    await store.initTheme({ theme: { sidebar_collapsed: true } })
    await store.initTheme({ theme: { mode: 'dark', sidebar_collapsed: true } })
    expect(store.sidebarCollapsed).toBe(false)
    expect(store.themeMode).toBe('dark')
  })

  it('本地读写均失败时保留会话内状态，不回退后端保存且只警告一次', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const store = useThemeStore(createPinia())
    store.setSidebarCollapsed(false)
    await store.initTheme({ theme: { sidebar_collapsed: false } })
    await store.initTheme({ theme: { sidebar_collapsed: true } })
    expect(store.sidebarCollapsed).toBe(false)
    store.setSidebarCollapsed(true)
    store.setSidebarCollapsed(false)
    await vi.advanceTimersByTimeAsync(200)

    expect(store.sidebarCollapsed).toBe(false)
    expect(warning).toHaveBeenCalledTimes(1)
    expect(settingsApi.getUi).not.toHaveBeenCalled()
    expect(settingsApi.saveUi).not.toHaveBeenCalled()
  })

  it('其他主题设置继续保存，并停止序列化侧栏状态', async () => {
    const store = useThemeStore(createPinia())
    store.setSidebarCollapsed(false)
    store.setAppearance({ radius_card: 20 })
    await vi.advanceTimersByTimeAsync(100)

    expect(settingsApi.saveUi).toHaveBeenCalledOnce()
    const saved = vi.mocked(settingsApi.saveUi).mock.calls[0]![0]
    expect(saved.theme?.appearance?.radius_card).toBe(20)
    expect(saved.theme).not.toHaveProperty('sidebar_collapsed')
    await store.initTheme({ theme: { sidebar_collapsed: true } })
    expect(store.sidebarCollapsed).toBe(false)
  })
})
