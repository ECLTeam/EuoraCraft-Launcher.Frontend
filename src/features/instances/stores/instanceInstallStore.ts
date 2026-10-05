import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { queryClient } from '@/app/queryClient'
import { queryKeys } from '@/app/queryKeys'
import type { ActionResult } from '@/composables/useAsyncAction'
import { instanceInstallApi, type InstallableLoader } from '@/features/instances/api/instanceInstallApi'
import type { CommandPayloadMap } from '@/types/api'
import type { InstallVersionResult } from '@/types/instances'

export const useInstanceInstallStore = defineStore('version-install', () => {
  const loaderVersions = reactive<Record<InstallableLoader, string[]>>({
    fabric: [],
    forge: [],
    neoforge: [],
    quilt: [],
  })
  const fabricApiVersions = ref<string[]>([])
  const fabricApiVersionsLoading = ref(false)
  const pendingLoaders = reactive(new Set<InstallableLoader>())
  const loaderVersionsLoading = computed(() => pendingLoaders.size > 0)
  const submittingVersionId = ref<string | null>(null)
  const loaderRequestIds: Record<InstallableLoader, number> = { fabric: 0, forge: 0, neoforge: 0, quilt: 0 }
  let fabricApiRequestId = 0

  const isSubmittingInstall = computed(() => submittingVersionId.value !== null)

  async function loadLoaderVersions(loader: InstallableLoader, gameVersion: string): Promise<string[] | null> {
    const requestId = ++loaderRequestIds[loader]
    if (!gameVersion) {
      pendingLoaders.delete(loader)
      loaderVersions[loader] = []
      return []
    }
    pendingLoaders.add(loader)
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.instanceInstall.loaderVersions(loader, gameVersion),
        queryFn: () => instanceInstallApi.getLoaderVersions(loader, gameVersion),
      })
      if (requestId !== loaderRequestIds[loader]) return null
      loaderVersions[loader] = result
      return result
    } catch (error) {
      if (requestId !== loaderRequestIds[loader]) return null
      throw error
    } finally {
      if (requestId === loaderRequestIds[loader]) pendingLoaders.delete(loader)
    }
  }

  async function loadFabricApiVersions(gameVersion: string): Promise<string[] | null> {
    const requestId = ++fabricApiRequestId
    if (!gameVersion) {
      fabricApiVersionsLoading.value = false
      fabricApiVersions.value = []
      return []
    }
    fabricApiVersionsLoading.value = true
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.instanceInstall.fabricApiVersions(gameVersion),
        queryFn: () => instanceInstallApi.getFabricApiVersions(gameVersion),
      })
      if (requestId !== fabricApiRequestId) return null
      fabricApiVersions.value = result
      return result
    } catch (error) {
      if (requestId !== fabricApiRequestId) return null
      throw error
    } finally {
      if (requestId === fabricApiRequestId) fabricApiVersionsLoading.value = false
    }
  }

  function clearLoaderVersions(): void {
    for (const loader of Object.keys(loaderRequestIds) as InstallableLoader[]) loaderRequestIds[loader]++
    fabricApiRequestId++
    pendingLoaders.clear()
    fabricApiVersionsLoading.value = false
    loaderVersions.fabric = []
    loaderVersions.forge = []
    loaderVersions.neoforge = []
    loaderVersions.quilt = []
    fabricApiVersions.value = []
  }

  function hasVersionConflict(gamePath: string, versionName: string): Promise<boolean> {
    return instanceInstallApi.exists(`${gamePath}/versions/${versionName}`)
  }

  async function install(
    versionId: string,
    params: CommandPayloadMap['game_install']
  ): Promise<ActionResult<InstallVersionResult>> {
    if (isSubmittingInstall.value) return { status: 'skipped' }
    submittingVersionId.value = versionId
    try {
      return { status: 'success', value: await instanceInstallApi.install(params) }
    } finally {
      submittingVersionId.value = null
    }
  }

  return {
    loaderVersions,
    fabricApiVersions,
    fabricApiVersionsLoading,
    loaderVersionsLoading,
    submittingVersionId,
    isSubmittingInstall,
    loadLoaderVersions,
    loadFabricApiVersions,
    clearLoaderVersions,
    hasVersionConflict,
    install,
  }
})
