// 插件可读取的只读全局状态

import { ref, readonly, watch, type DeepReadonly, type Ref } from 'vue'
import backend from '@/api/client'
import { accountsQuery, configQuery, launcherInfoQuery } from '@/app/data'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import type { AccountListData } from '@/types/accounts'
import type { LauncherConfig } from '@/types/config'
import type { LauncherInfo } from '@/types/system'
import { getPluginList } from './api'
import type {
  AccountState,
  LauncherState,
  PluginInstanceState,
  PluginPluginsState,
  PluginTasksState,
  SidebarState,
  ThemeState,
} from './types'

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

/** 主题同步只依赖 ui.theme 的三个字段，不把完整设置模型耦合进插件 SDK。 */
interface ThemeSource {
  theme?: {
    mode?: 'light' | 'dark' | 'system'
    primary_color?: string
    background_opacity?: number
  }
}

/**
 * 把宿主 ui 分区同步为插件可见的主题状态。
 *
 * 主题字段位于 `ui.theme` 分支，`ui` 顶层只有 locale 与窗口偏好；读取顶层会把
 * 插件主题固定成默认值。模式缺省时沿用当前状态，避免局部更新重置已生效模式。
 */
function syncTheme(state: Ref<ThemeState>, ui: ThemeSource): void {
  const theme = ui.theme
  if (theme?.mode) state.value.mode = theme.mode
  if (theme?.primary_color) state.value.primaryColor = theme.primary_color
  if (typeof theme?.background_opacity === 'number') state.value.backgroundOpacity = theme.background_opacity
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  state.value.isDark = state.value.mode === 'dark' || (state.value.mode === 'system' && prefersDark)
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
      syncTheme(state, (await configQuery()).ui)
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

/** 任务队列摘要切片：任务队列 UI 已展示的字段，不含凭据。 */
const tasksSlice = createStateSlice<PluginTasksState>([], async (state) => {
  try {
    state.value = globalTaskQueue.tasks.value.map((task) => ({
      id: task.id,
      name: task.name,
      type: task.type,
      status: task.status,
      progress: task.progress,
      message: task.message,
    }))
  } catch {
    /* 读取失败时保留原任务状态 */
  }
})

/** 实例列表摘要切片：实例管理页可见口径（id/名称/版本/加载器/路径）。 */
const instancesSlice = createStateSlice<PluginInstanceState>([], async (state) => {
  try {
    const store = useInstanceStore()
    await store.ensureLoaded()
    state.value = store.scannedVersions.map((version) => ({
      id: version.id,
      name: version.displayName,
      versionId: version.versionId,
      loader: version.primaryLoader,
      path: version.path,
    }))
  } catch {
    /* 读取失败时保留原实例状态 */
  }
})

/** 插件清单摘要切片：插件管理页可见口径。 */
const pluginsSlice = createStateSlice<PluginPluginsState>([], async (state) => {
  try {
    const result = await getPluginList()
    if (result.success && result.data) {
      state.value = result.data.map((plugin) => ({
        name: plugin.name,
        version: plugin.version,
        enabled: plugin.status === 'enabled',
        hasUi: plugin.has_panels,
      }))
    }
  } catch {
    /* 读取失败时保留原插件状态 */
  }
})

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
      syncTheme(themeSlice.state, payload.ui)
    }
  })

  const unlistenAccount = backend.on('accounts_changed', (payload) => {
    if (payload && typeof payload === 'object' && 'accounts' in payload) {
      syncAccounts(accountSlice.state, payload as unknown as AccountListData)
    }
  })

  const unlistenUpdates = backend.on('config:updated', (payload) => {
    if (payload.section === 'ui') void themeSlice.refresh()
    if (payload.section === 'launcher') void launcherSlice.refresh()
  })

  unlistenFns.push(unlistenConfig, unlistenAccount, unlistenUpdates)

  // 任务队列与实例列表是响应式 store，直接订阅保持切片同步。
  const unlistenTasks = watch(globalTaskQueue.tasks, () => void tasksSlice.refresh())
  const unlistenInstances = watch(
    () => useInstanceStore().scannedVersions,
    () => void instancesSlice.refresh()
  )
  const unlistenPluginStatus = backend.on('plugin:status_changed', () => void pluginsSlice.refresh())

  unlistenFns.push(
    unlistenConfig,
    unlistenAccount,
    unlistenUpdates,
    unlistenTasks,
    unlistenInstances,
    unlistenPluginStatus
  )

  themeSlice.refresh()
  launcherSlice.refresh()
  accountSlice.refresh()
  void tasksSlice.refresh()
  void instancesSlice.refresh()
  void pluginsSlice.refresh()

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

export function getTasksState(): DeepReadonly<Ref<PluginTasksState>> {
  return tasksSlice.getReadonly()
}

export function getInstancesState(): DeepReadonly<Ref<PluginInstanceState>> {
  return instancesSlice.getReadonly()
}

export function getPluginsState(): DeepReadonly<Ref<PluginPluginsState>> {
  return pluginsSlice.getReadonly()
}

export function watchTasks(cb: (state: PluginTasksState) => void): () => void {
  return tasksSlice.watch(cb)
}

export function watchInstances(cb: (state: PluginInstanceState) => void): () => void {
  return instancesSlice.watch(cb)
}

export function watchPlugins(cb: (state: PluginPluginsState) => void): () => void {
  return pluginsSlice.watch(cb)
}

export function refreshTasks(): Promise<void> {
  return tasksSlice.refresh()
}

export function refreshInstances(): Promise<void> {
  return instancesSlice.refresh()
}

export function refreshPlugins(): Promise<void> {
  return pluginsSlice.refresh()
}
