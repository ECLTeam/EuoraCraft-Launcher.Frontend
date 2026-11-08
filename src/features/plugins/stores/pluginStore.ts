import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ActionResult } from '@/composables/useAsyncAction'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import type {
  PluginInfo,
  PluginPackageInstallResult,
  PluginPackageSelection,
  PluginSettingsData,
} from '@/types/plugins'
import { configValuesEqual, copyConfigValue } from '@/utils/configValue'

export const usePluginStore = defineStore('plugins', () => {
  const plugins = ref<PluginInfo[]>([])
  const loading = ref(false)
  const activeOperations = ref<string[]>([])
  const error = ref('')
  const settingsCache = ref<Record<string, PluginSettingsData>>({})
  const isListStale = ref(true)
  const settingsModalVisible = ref(false)
  const settingsTargetName = ref<string | null>(null)
  const settingsTarget = computed(
    () => plugins.value.find((plugin) => plugin.name === settingsTargetName.value) ?? null
  )
  let settingsRequest = 0
  let unlistenStatus: (() => void) | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let loadPromise: Promise<void> | null = null
  let reloadRequested = false
  const executingOperations = new Set<string>()

  const reloadingPlugins = computed(() =>
    activeOperations.value.filter((operation) => operation.startsWith('reload:')).map((operation) => operation.slice(7))
  )

  async function load(force = false): Promise<void> {
    if (loadPromise) return loadPromise
    if (!force && !isListStale.value) return

    loading.value = true
    error.value = ''
    const request = (async () => {
      try {
        do {
          reloadRequested = false
          try {
            const snapshot = await pluginManagementApi.list()
            if (!reloadRequested) plugins.value = snapshot
          } catch (reason) {
            if (!reloadRequested) throw reason
          }
        } while (reloadRequested)
        isListStale.value = false
      } catch (reason) {
        plugins.value = []
        error.value = reason instanceof Error ? reason.message : '读取插件失败'
        throw reason
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()
    loadPromise = request
    return request
  }

  async function runOperation<T>(operation: string, action: () => Promise<T>): Promise<ActionResult<T>> {
    const pluginName = operation.slice(operation.indexOf(':') + 1)
    if (activeOperations.value.some((active) => active.slice(active.indexOf(':') + 1) === pluginName))
      return { status: 'skipped' }
    activeOperations.value = [...activeOperations.value, operation]
    executingOperations.add(operation)
    let succeeded = false
    try {
      try {
        const value = await action()
        succeeded = true
        return { status: 'success', value }
      } finally {
        executingOperations.delete(operation)
        isListStale.value = true
        if (refreshTimer) clearTimeout(refreshTimer)
        refreshTimer = null
        if (loadPromise) reloadRequested = true
        // 操作失败也可能已改变部分状态，刷新失败时保留原操作异常。
        const refreshing = load(true)
        if (succeeded) await refreshing
        else await refreshing.catch(() => undefined)
      }
    } finally {
      activeOperations.value = activeOperations.value.filter((item) => item !== operation)
    }
  }

  function toggle(plugin: PluginInfo): Promise<ActionResult<void>> {
    const action = ['enabled', 'stopping'].includes(plugin.status)
      ? pluginManagementApi.disable
      : pluginManagementApi.enable
    return runOperation(`toggle:${plugin.name}`, () => action(plugin.name))
  }

  function reload(pluginName: string): Promise<ActionResult<void>> {
    return runOperation(`reload:${pluginName}`, () => pluginManagementApi.reload(pluginName))
  }

  function unload(pluginName: string): Promise<ActionResult<void>> {
    return runOperation(`unload:${pluginName}`, () => pluginManagementApi.unload(pluginName))
  }

  async function install(): Promise<boolean> {
    const installed = await pluginManagementApi.installFromDirectory()
    if (installed) await load(true)
    return installed
  }

  async function selectPackage(): Promise<PluginPackageSelection | null> {
    const path = await pluginManagementApi.selectPackage()
    if (!path) return null
    return { path, preflight: await pluginManagementApi.inspectPackage(path) }
  }

  async function installPackage(
    selection: PluginPackageSelection,
    options: { allowNetwork: boolean }
  ): Promise<PluginPackageInstallResult | undefined> {
    const result = await runOperation(`install:${selection.preflight.package.name}`, () =>
      pluginManagementApi.installPackage(selection.path, options)
    )
    return result.status === 'success' ? result.value : undefined
  }

  const settingsRequests = new Map<string, number>()
  async function getSettings(pluginName: string): Promise<PluginSettingsData> {
    const request = (settingsRequests.get(pluginName) ?? 0) + 1
    settingsRequests.set(pluginName, request)
    const data = await pluginManagementApi.getSettings(pluginName)
    if (settingsRequests.get(pluginName) === request)
      settingsCache.value = { ...settingsCache.value, [pluginName]: data }
    return data
  }

  const settingsWrites = new Set<string>()

  async function updateSetting(
    pluginName: string,
    key: string,
    value: unknown,
    settings?: PluginSettingsData
  ): Promise<void> {
    if (settingsWrites.has(pluginName)) throw new Error('PLUGIN_SETTING_SAVE_BUSY')
    const cached = settings ?? settingsCache.value[pluginName]
    if (!cached) throw new Error('PLUGIN_SETTING_SCHEMA_UNAVAILABLE')
    const latest = settingsCache.value[pluginName]
    if (
      latest &&
      (latest.installation_id !== cached.installation_id ||
        latest.content_digest !== cached.content_digest ||
        latest.schema_revision !== cached.schema_revision ||
        latest.revision !== cached.revision)
    )
      throw new Error('PLUGIN_REVISION_CONFLICT')
    if (configValuesEqual(cached.values[key], value)) return
    const submitted = copyConfigValue(value)
    settingsWrites.add(pluginName)
    try {
      const result = await pluginManagementApi.updateSetting(pluginName, key, submitted, cached)
      if (
        settingsCache.value[pluginName]?.schema_revision === cached.schema_revision &&
        (settingsCache.value[pluginName]?.revision ?? 0) <= (result?.revision ?? cached.revision ?? 0)
      ) {
        settingsCache.value = {
          ...settingsCache.value,
          [pluginName]: {
            ...cached,
            revision: result?.revision ?? cached.revision,
            values: { ...cached.values, [key]: submitted },
          },
        }
      }
    } finally {
      settingsWrites.delete(pluginName)
    }
  }

  async function openSettings(pluginName: string | null = null): Promise<void> {
    const request = ++settingsRequest
    await load(true)
    if (request !== settingsRequest) return
    if (pluginName !== null && !plugins.value.some((plugin) => plugin.name === pluginName && !plugin.is_system)) {
      throw new Error('PLUGIN_NOT_FOUND')
    }
    settingsTargetName.value = pluginName
    settingsModalVisible.value = true
  }

  function closeSettings(): void {
    settingsRequest += 1
    settingsModalVisible.value = false
  }

  function scheduleRefresh(): void {
    isListStale.value = true
    if (loadPromise) reloadRequested = true
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null
    if (executingOperations.size) return
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void load().catch(() => {})
    }, 150)
  }

  async function start(): Promise<void> {
    if (!unlistenStatus) unlistenStatus = pluginManagementApi.onStatusChanged(scheduleRefresh)
    await load()
  }

  function stop(): void {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null
    unlistenStatus?.()
    unlistenStatus = null
  }

  return {
    plugins,
    loading,
    activeOperations,
    reloadingPlugins,
    error,
    settingsCache,
    isListStale,
    settingsModalVisible,
    settingsTarget,
    openSettings,
    closeSettings,
    load,
    toggle,
    reload,
    unload,
    install,
    selectPackage,
    installPackage,
    getSettings,
    subscribeSettingsChanges: pluginManagementApi.onSettingsChanged,
    updateSetting,
    start,
    stop,
  }
})
