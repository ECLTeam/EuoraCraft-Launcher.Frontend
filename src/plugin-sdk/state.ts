// 插件可读取的只读全局状态

import { ref, readonly, watch, type DeepReadonly, type Ref } from 'vue'
import backend from '@/api/client'
import { accountsQuery, configQuery, launcherInfoQuery } from '@/app/data'
import type { AccountListData } from '@/types/accounts'
import type { LauncherConfig } from '@/types/config'
import type { LauncherInfo } from '@/types/system'
import type { AccountState, LauncherState, SidebarState, ThemeState } from './types'

// ---- 工厂：统一 ref + readonly + watch + refresh 模板 ----

interface StateSlice<T> {
  state: Ref<T>
  getReadonly: () => DeepReadonly<Ref<T>>
  watch: (cb: (state: T) => void) => () => void
  refresh: () => Promise<void>
}

function createStateSlice<T>(initial: T, refreshFn?: (state: Ref<T>) => Promise<void>): StateSlice<T> {
  const state = ref(initial) as unknown as Ref<T>
  return {
    state,
    getReadonly: () => readonly(state) as DeepReadonly<Ref<T>>,
    watch: (cb: (state: T) => void) => watch(() => state.value, cb, { deep: true, immediate: true }),
    refresh: () => (refreshFn ? refreshFn(state) : Promise.resolve()),
  }
}

// ---- 同步函数 ----

interface ThemeConfigPayload {
  mode?: 'light' | 'dark' | 'system'
  primary_color?: string
  background_opacity?: number
}

function syncTheme(state: Ref<ThemeState>, ui: ThemeConfigPayload): void {
  if (ui.mode) state.value.mode = ui.mode
  if (ui.primary_color) state.value.primaryColor = ui.primary_color
  if (typeof ui.background_opacity === 'number') state.value.backgroundOpacity = ui.background_opacity
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  state.value.isDark = ui.mode === 'dark' || (ui.mode === 'system' && prefersDark)
}

function syncLauncher(state: Ref<LauncherState>, launcher: LauncherConfig): void {
  state.value.devMode = launcher.debug === true
}

function syncLauncherRuntimeMetadata(state: Ref<LauncherState>, launcherInfo: LauncherInfo): void {
  state.value.version = launcherInfo.version || ''
  state.value.versionType =
    launcherInfo.version_type === 'alpha' ||
    launcherInfo.version_type === 'beta' ||
    launcherInfo.version_type === 'rc' ||
    launcherInfo.version_type === 'release'
      ? launcherInfo.version_type
      : 'release'
}

function syncAccounts(state: Ref<AccountState>, data: AccountListData): void {
  state.value.list = data.accounts || []
  state.value.current = data.current
}

// ---- Slices ----

const themeSlice = createStateSlice<ThemeState>(
  {
    mode: 'system',
    isDark: false,
    primaryColor: '',
    backgroundImage: '',
    backgroundOpacity: 1,
  },
  async (state) => {
    try {
      // 传入原始 UI 分区对象，保持插件可见的主题同步字段解析方式不变。
      syncTheme(state, (await configQuery()).ui as unknown as ThemeConfigPayload)
    } catch {
      /* 读取失败时保留默认主题状态 */
    }
  }
)

const launcherSlice = createStateSlice<LauncherState>(
  {
    version: '',
    versionType: 'release',
    devMode: false,
  },
  async (state) => {
    try {
      const [config, launcherInfo] = await Promise.all([configQuery(), launcherInfoQuery()])
      syncLauncher(state, config.launcher)
      if (launcherInfo) syncLauncherRuntimeMetadata(state, launcherInfo)
    } catch {
      /* 读取失败时保留默认启动器状态 */
    }
  }
)

const accountSlice = createStateSlice<AccountState>(
  {
    current: null,
    list: [],
  },
  async (state) => {
    try {
      syncAccounts(state, await accountsQuery())
    } catch {
      /* 读取失败时保留空账户状态 */
    }
  }
)

const sidebarSlice = createStateSlice<SidebarState>({ collapsed: false })

// ---- 初始化 ----

let initialized = false
const unlistenFns: (() => void)[] = []

export function initPluginState(): () => void {
  if (initialized) return () => {}
  initialized = true

  const unlistenConfig = backend.on('config:init', (payload) => {
    if (payload.launcher) {
      syncLauncher(launcherSlice.state, payload.launcher as LauncherConfig)
    }
    if (payload.ui) {
      syncTheme(themeSlice.state, payload.ui as ThemeConfigPayload)
    }
  })

  const unlistenAccount = backend.on('accounts_changed', (payload) => {
    if (payload && typeof payload === 'object' && 'accounts' in payload) {
      syncAccounts(accountSlice.state, payload as unknown as AccountListData)
    }
  })

  unlistenFns.push(unlistenConfig, unlistenAccount)

  accountSlice.refresh()

  return () => {
    for (const fn of unlistenFns) fn()
    unlistenFns.length = 0
    initialized = false
  }
}

// ---- 对外 API ----

export function getThemeState(): DeepReadonly<Ref<ThemeState>> {
  return themeSlice.getReadonly()
}

export function getLauncherState(): DeepReadonly<Ref<LauncherState>> {
  return launcherSlice.getReadonly()
}

export function getAccountState(): DeepReadonly<Ref<AccountState>> {
  return accountSlice.getReadonly()
}

export function getSidebarState(): DeepReadonly<Ref<SidebarState>> {
  return sidebarSlice.getReadonly()
}

export function watchTheme(cb: (state: ThemeState) => void): () => void {
  return themeSlice.watch(cb)
}

export function watchLauncher(cb: (state: LauncherState) => void): () => void {
  return launcherSlice.watch(cb)
}

export function watchAccount(cb: (state: AccountState) => void): () => void {
  return accountSlice.watch(cb)
}

export function watchSidebar(cb: (state: SidebarState) => void): () => void {
  return sidebarSlice.watch(cb)
}

export function setSidebarState(collapsed: boolean): void {
  sidebarSlice.state.value.collapsed = collapsed
}

export function refreshTheme(): Promise<void> {
  return themeSlice.refresh()
}

export function refreshLauncher(): Promise<void> {
  return launcherSlice.refresh()
}

export function refreshAccounts(): Promise<void> {
  return accountSlice.refresh()
}
