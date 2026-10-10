import { computed, onMounted, ref } from 'vue'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { ScannedVersion } from '@/types/instances'
import { gamePathIdentity } from '@/utils/path'

/** 安装位置缓存键：在线资源类型 + 存档（存档仅本地导入）。 */
export type InstallTargetKey = string

/** 用 path\u0000versionId 拼接的实例唯一键，与现存各页选择器一致。 */
export function instanceKey(version: Pick<ScannedVersion, 'path' | 'versionId' | 'instanceKey'>): string {
  return version.instanceKey ?? `${gamePathIdentity(version.path)}\u0000${version.versionId}`
}

export function parseInstanceKey(key: string): { path: string; versionId: string } {
  const [path = '', versionId = ''] = key.split('\u0000')
  return { path, versionId }
}

/** 启动预取与分类页共用安装目标选择规则，显式的“无实例”优先于自动选择。 */
export function resolveInitialResourceTarget(
  versions: ScannedVersion[],
  cached: { gamePath: string; versionId: string } | undefined,
  selectedVersion: string,
  currentGamePath: string,
  autoSelect = true
): ScannedVersion | null {
  if (cached) {
    if (!cached.gamePath || !cached.versionId) return null
    const hit = versions.find(
      (version) =>
        gamePathIdentity(version.path) === gamePathIdentity(cached.gamePath) && version.versionId === cached.versionId
    )
    if (hit) return hit
  }
  if (!autoSelect) return null
  return (
    versions.find(
      (version) =>
        version.versionId === selectedVersion && gamePathIdentity(version.path) === gamePathIdentity(currentGamePath)
    ) ??
    versions[0] ??
    null
  )
}

export function useResourceInstallTarget(resourceType: InstallTargetKey, autoSelect = true) {
  const instanceStore = useInstanceStore()
  const selectedKey = ref('')
  const ready = ref(false)
  // 兼容性筛选条件：由详情弹窗按所选模组的版本/加载器设置，空时不过滤
  const compatibleFilter = ref<{ gameVersions: string[]; loaders: string[] } | null>(null)

  const installableInstances = computed<ScannedVersion[]>(() => instanceStore.scannedVersions)

  const compatibleInstances = computed<ScannedVersion[]>(() => {
    const filter = compatibleFilter.value
    if (!filter) return installableInstances.value
    return installableInstances.value.filter(
      (version) =>
        (filter.gameVersions.length === 0 || filter.gameVersions.includes(version.vanillaName)) &&
        (filter.loaders.length === 0 ||
          filter.loaders.some((loader) => loader.toLocaleLowerCase() === version.primaryLoader.toLocaleLowerCase()))
    )
  })

  const selectedInstance = computed<ScannedVersion | null>(
    () => installableInstances.value.find((version) => instanceKey(version) === selectedKey.value) ?? null
  )

  async function loadCache(): Promise<void> {
    await instanceStore.loadAll()
    const config = unwrapResponse(await backend.config.get('download'), '读取下载设置')
    const cfg = config as { resourceInstallCache?: Record<string, { gamePath: string; versionId: string }> }
    const chosen = resolveInitialResourceTarget(
      installableInstances.value,
      cfg?.resourceInstallCache?.[resourceType],
      instanceStore.selectedVersion,
      instanceStore.currentGamePath,
      autoSelect
    )
    selectedKey.value = chosen ? instanceKey(chosen) : ''
    // 自动选中不写入缓存，只有用户显式选择才会被记住
    ready.value = true
  }

  function setTarget(version: ScannedVersion): void {
    selectedKey.value = instanceKey(version)
  }

  function clearTarget(): void {
    selectedKey.value = ''
  }

  function setCompatibleFilter(filter: { gameVersions: string[]; loaders: string[] } | null): void {
    compatibleFilter.value = filter
    // 当前选中实例不再兼容时清空选择，避免未经用户确认改装到另一个实例。
    if (filter) {
      const current = selectedInstance.value
      if (current && !compatibleInstances.value.some((version) => instanceKey(version) === selectedKey.value)) {
        selectedKey.value = ''
      }
    }
  }

  async function refreshInstances(): Promise<void> {
    const previousKey = selectedKey.value
    await instanceStore.loadAll(true)
    if (previousKey && !installableInstances.value.some((version) => instanceKey(version) === previousKey)) {
      selectedKey.value = ''
    }
  }

  async function persist(instance: ScannedVersion | null = selectedInstance.value): Promise<void> {
    await useSettingsStore().patchDownload({
      resourceInstallCache: {
        // 选"无"时写空记录，代表显式选择"不绑定实例"，便于切页后恢复
        [resourceType]: instance
          ? { gamePath: instance.path, versionId: instance.versionId }
          : { gamePath: '', versionId: '' },
      },
    })
  }

  onMounted(() => {
    void loadCache()
  })

  return {
    ready,
    installableInstances,
    compatibleInstances,
    selectedKey,
    selectedInstance,
    setTarget,
    clearTarget,
    setCompatibleFilter,
    refreshInstances,
    persist,
    loadCache,
  }
}
