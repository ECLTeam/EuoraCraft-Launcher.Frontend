import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { instancePathConfigApi } from '@/features/instances/api/instancePathConfigApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { ScannedVersion } from '@/types/instances'
import { gamePathIdentity, normalizeGamePath } from '@/utils/path'

export interface VersionItem {
  id: string
  type: string
  versionType: ScannedVersion['versionType']
  gamePath: string
}

export const useInstanceStore = defineStore('versions', () => {
  const settingsStore = useSettingsStore()
  const scannedVersions = ref<ScannedVersion[]>([])
  const selectedVersion = ref('')
  const currentGamePath = ref('')
  const loadingCount = ref(0)
  const scanRequests = new Map<string, Promise<ScannedVersion[]>>()
  let loadAllRequest: Promise<void> | null = null
  let hasLoaded = false
  let stopWatching: (() => void) | null = null
  let latestLoadId = 0
  let selectionRevision = 0

  const loading = computed(() => loadingCount.value > 0)
  const versions = computed<VersionItem[]>(() =>
    scannedVersions.value
      .filter((version) => !version.isBroken)
      .map((version) => ({
        id: version.versionId,
        type: version.primaryLoader,
        versionType: version.versionType,
        gamePath: version.path,
      }))
  )

  function startWatching(): void {
    if (stopWatching) return
    stopWatching = instanceInstallApi.onVersionsChanged(({ gamePath }) => {
      void loadAll(true).catch((error) => {
        console.warn('[instanceStore] 同步实例变更失败:', gamePath, error)
      })
    })
  }

  function replacePathVersions(path: string, versionsForPath: ScannedVersion[]): void {
    const key = versionsForPath[0]?.rootKey ?? gamePathIdentity(path)
    const pathKey = normalizeGamePath(path)
    scannedVersions.value = [
      ...scannedVersions.value.filter(
        (version) =>
          normalizeGamePath(version.path) !== pathKey && (version.rootKey ?? gamePathIdentity(version.path)) !== key
      ),
      ...versionsForPath.map((version) => ({ ...version, path })),
    ]
  }

  async function scanPath(path: string, force = false): Promise<ScannedVersion[]> {
    startWatching()
    const key = normalizeGamePath(path)
    const existing = scanRequests.get(key)
    if (existing && !force) return existing
    if (existing) await existing.catch(() => undefined)

    loadingCount.value += 1
    const request = instanceInstallApi
      .scan([path], { force })
      .then((result) => {
        if (scanRequests.get(key) === request) replacePathVersions(path, result)
        return result
      })
      .finally(() => {
        if (scanRequests.get(key) === request) scanRequests.delete(key)
        loadingCount.value = Math.max(0, loadingCount.value - 1)
      })
    scanRequests.set(key, request)
    return request
  }

  function getVersionGamePath(version: ScannedVersion, fallback: string): string {
    if (version.path) return version.path
    const pathMatch = version.jsonPath?.match(/^(.*)[\\/]versions[\\/]/i)
    return pathMatch?.[1] || fallback
  }

  async function loadAllImpl(force: boolean): Promise<void> {
    const loadId = ++latestLoadId
    const initialSelectionRevision = selectionRevision
    startWatching()
    await settingsStore.load()
    if (loadId !== latestLoadId) return
    const paths = settingsStore.game.minecraft_paths.map((entry) => (typeof entry === 'string' ? entry : entry.path))
    if (paths.length === 0) {
      scannedVersions.value = []
      if (initialSelectionRevision === selectionRevision) {
        selectedVersion.value = ''
        currentGamePath.value = ''
      }
      hasLoaded = true
      return
    }

    loadingCount.value += 1
    try {
      const scanned = await instanceInstallApi.scan(paths, { force })
      // 手动刷新与后端变更事件可能并发触发扫描；仅允许最后一次请求提交状态。
      if (loadId !== latestLoadId) return
      // 按「游戏目录 + 版本标识」去重，防止同一实例被多个路径重复展示。
      const seen = new Set<string>()
      const firstPath = paths[0] ?? ''
      const deduped = scanned
        .filter((version) => !version.isBroken)
        .filter((version) => {
          const id = version.versionId || version.id
          const gamePath = getVersionGamePath(version, firstPath)
          const key = version.instanceKey ?? `${gamePathIdentity(gamePath)}\0${id}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map((version) => ({ ...version, path: getVersionGamePath(version, firstPath) }))
      scannedVersions.value = deduped
      hasLoaded = true
      if (initialSelectionRevision !== selectionRevision) return

      // 确定当前激活的游戏路径：优先用全局 active_path，其次用之前已选中的路径，最后用第一个
      const activePath = settingsStore.game.active_path || currentGamePath.value || firstPath || ''
      const pathVersions = versions.value.filter(
        (version) => gamePathIdentity(version.gamePath) === gamePathIdentity(activePath)
      )

      // 尝试从该路径的 ecl.json 读取 activeVersion
      let activeVersionId: string | null = null
      if (activePath && pathVersions.length > 0) {
        try {
          activeVersionId = await instancePathConfigApi.getActiveVersion(activePath, { force })
        } catch (error) {
          if (initialSelectionRevision !== selectionRevision || loadId !== latestLoadId) return
          console.warn('[instanceStore] 读取 ecl.json activeVersion 失败:', error)
        }
      }

      const selected =
        (activeVersionId && pathVersions.find((version) => version.id === activeVersionId)) ??
        pathVersions[0] ??
        versions.value.find(
          (version) => version.id === selectedVersion.value && version.gamePath === currentGamePath.value
        ) ??
        versions.value.find((version) => version.id === selectedVersion.value) ??
        versions.value[0]
      if (loadId !== latestLoadId || initialSelectionRevision !== selectionRevision) return
      if (selected) {
        selectVersion(selected.id, selected.gamePath)
      } else {
        selectedVersion.value = ''
        currentGamePath.value = ''
      }
      hasLoaded = true
    } finally {
      loadingCount.value = Math.max(0, loadingCount.value - 1)
    }
  }

  async function loadAll(force = false): Promise<void> {
    if (!force && loadAllRequest) return loadAllRequest
    if (force && loadAllRequest) {
      latestLoadId += 1
      const previous = loadAllRequest
      await previous.catch(() => undefined)
      if (loadAllRequest && loadAllRequest !== previous) return loadAllRequest
    }
    const request = loadAllImpl(force)
    loadAllRequest = request
    try {
      await request
    } finally {
      if (loadAllRequest === request) loadAllRequest = null
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (hasLoaded) return
    await loadAll()
  }

  function selectVersion(versionId: string, gamePath?: string): void {
    selectionRevision++
    const prevId = selectedVersion.value
    const prevPath = currentGamePath.value
    const selected = gamePath
      ? versions.value.find(
          (version) => version.id === versionId && gamePathIdentity(version.gamePath) === gamePathIdentity(gamePath)
        )
      : versions.value.find((version) => version.id === versionId)
    const resolvedPath = selected?.gamePath || gamePath || currentGamePath.value
    selectedVersion.value = selected?.id || versionId
    currentGamePath.value = resolvedPath
    // 值未变化时跳过写入，避免每次页面加载都重写 ecl.json
    if (versionId && resolvedPath && (versionId !== prevId || resolvedPath !== prevPath)) {
      void instancePathConfigApi.setActiveVersion(resolvedPath, versionId).catch((error) => {
        console.warn('[instanceStore] 写入 ecl.json activeVersion 失败:', error)
      })
    }
  }

  function setGamePath(path: string): void {
    selectionRevision++
    currentGamePath.value = path
  }

  /**
   * 切换到指定游戏路径，并从该路径的 ecl.json 中读取 activeVersion
   * 作为该路径下的选中实例；若没有则选第一个。
   */
  async function switchPath(gamePath: string, options: { forceConfig?: boolean } = {}): Promise<void> {
    const revision = ++selectionRevision
    currentGamePath.value = gamePath
    const settingsStore = useSettingsStore()
    // 持久化全局 active_path
    if (settingsStore.game.active_path !== gamePath) {
      void settingsStore.patchGame({ active_path: gamePath }).catch((error) => {
        console.warn('[instanceStore] 保存 active_path 失败:', error)
      })
    }

    // 先尝试从 ecl.json 读取该路径下的选中版本
    let activeVersionId: string | null = null
    try {
      activeVersionId = await instancePathConfigApi.getActiveVersion(gamePath, { force: options.forceConfig })
    } catch (error) {
      if (revision !== selectionRevision) return
      console.warn('[instanceStore] 读取 ecl.json activeVersion 失败:', error)
    }

    if (revision !== selectionRevision) return
    const pathVersions = versions.value.filter((v) => gamePathIdentity(v.gamePath) === gamePathIdentity(gamePath))
    const matched = activeVersionId ? pathVersions.find((v) => v.id === activeVersionId) : null
    const target = matched ?? pathVersions[0]
    if (target) {
      selectVersion(target.id, target.gamePath)
    } else {
      selectedVersion.value = ''
      currentGamePath.value = gamePath
    }
  }

  function removePath(path: string): void {
    selectionRevision++
    const key = gamePathIdentity(path)
    scannedVersions.value = scannedVersions.value.filter((version) => gamePathIdentity(version.path) !== key)
    instanceInstallApi.invalidateScanCache(path)
    instancePathConfigApi.invalidateActiveVersionCache(path)
    if (gamePathIdentity(currentGamePath.value) === key) {
      const next = versions.value[0]
      selectVersion(next?.id ?? '', next?.gamePath ?? '')
    }
  }

  return {
    scannedVersions,
    versions,
    selectedVersion,
    currentGamePath,
    loading,
    loadAll,
    ensureLoaded,
    scanPath,
    selectVersion,
    setGamePath,
    switchPath,
    removePath,
  }
})
