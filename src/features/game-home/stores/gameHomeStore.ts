import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { readResource, invalidateResource } from '@/app/data/refreshCoordinator'
import { queryKeys } from '@/app/queryKeys'
import { useAsyncState } from '@/composables/useAsyncState'
import { gameHomeApi } from '@/features/game-home/api/gameHomeApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { InfoCardAnnouncement } from '@/types/system'

export const useGameHomeStore = defineStore('game-home', () => {
  const settingsStore = useSettingsStore()
  const announcements = ref<InfoCardAnnouncement[]>([])
  const { status } = useAsyncState()
  const error = ref('')

  const hasGamePath = computed(() => settingsStore.game.minecraft_paths.length > 0)

  async function load(): Promise<void> {
    status.value = 'loading'
    error.value = ''
    try {
      const [items] = await Promise.all([
        readResource({
          queryKey: queryKeys.gameHome.announcements,
          load: () => gameHomeApi.getAnnouncements(),
        }),
        settingsStore.load(),
      ])
      announcements.value = items
      status.value = 'ready'
    } catch (reason) {
      status.value = 'error'
      error.value = reason instanceof Error ? reason.message : '加载首页失败'
      throw reason
    }
  }

  function cancelLaunch(): Promise<boolean> {
    return gameHomeApi.cancelLaunch().finally(() => invalidateResource(queryKeys.gameHome.announcements))
  }

  return {
    announcements,
    status,
    error,
    hasGamePath,
    load,
    cancelLaunch,
  }
})
