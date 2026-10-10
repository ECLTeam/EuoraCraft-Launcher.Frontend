import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIntervalFn } from '@/composables/useIntervalFn'
import {
  createLocalizedInfoCard,
  resolveInitialInfoCardView,
  type InfoCardView,
} from '@/features/game-home/model/infoCard'
import { useGameHomeStore } from '@/features/game-home/stores/gameHomeStore'

const WELCOME_STORAGE_KEY = 'euora-welcome-shown'

export function useGameInfoCard() {
  const store = useGameHomeStore()
  const { announcements } = storeToRefs(store)
  const { t, locale } = useI18n()
  const infoCardData = computed(() => createLocalizedInfoCard(announcements.value, t, locale.value))
  const infoCardMode = ref<InfoCardView>('tip')
  const isWelcome = ref(true)
  const currentTipIndex = ref(0)
  const currentAnnounceIndex = ref(0)
  let welcomeTimer: ReturnType<typeof setTimeout> | null = null

  const hasAnnouncements = computed(() => infoCardData.value.announcements.length > 0)
  const hasTips = computed(() => infoCardData.value.tips.length > 0)
  const currentTip = computed(() => {
    const tips = infoCardData.value.tips
    return tips.length === 0 ? '' : (tips[currentTipIndex.value % tips.length] ?? '')
  })
  const currentAnnouncement = computed(() => {
    const announcements = infoCardData.value.announcements
    return announcements.length === 0
      ? null
      : (announcements[currentAnnounceIndex.value % announcements.length] ?? null)
  })
  const welcomeInfo = computed(() => infoCardData.value.welcome)
  const canToggleInfoCard = computed(() => ['auto', 'rotate', 'announcement_first'].includes(infoCardData.value.mode))

  function rotate(): void {
    const mode = infoCardData.value.mode
    if (mode === 'tip_only' || mode === 'announcement_only') return
    if (mode === 'announcement_first') {
      if (hasAnnouncements.value) infoCardMode.value = infoCardMode.value === 'announce' ? 'tip' : 'announce'
      return
    }
    if (mode === 'rotate') {
      if (infoCardMode.value === 'tip') {
        if (hasAnnouncements.value) infoCardMode.value = 'announce'
        else currentTipIndex.value = (currentTipIndex.value + 1) % Math.max(infoCardData.value.tips.length, 1)
      } else {
        if (hasTips.value) {
          infoCardMode.value = 'tip'
          currentTipIndex.value = (currentTipIndex.value + 1) % Math.max(infoCardData.value.tips.length, 1)
        }
        currentAnnounceIndex.value =
          (currentAnnounceIndex.value + 1) % Math.max(infoCardData.value.announcements.length, 1)
      }
      return
    }
    if (infoCardMode.value === 'tip' && hasAnnouncements.value) infoCardMode.value = 'announce'
    else if (infoCardMode.value === 'announce' && hasTips.value) infoCardMode.value = 'tip'
  }

  const { pause, resume } = useIntervalFn(rotate, () => infoCardData.value.interval ?? 8000)

  function pauseRotation(): void {
    pause()
  }

  function resumeRotation(): void {
    if (infoCardData.value.mode === 'tip_only' || infoCardData.value.mode === 'announcement_only') return
    resume()
  }

  async function start(): Promise<void> {
    await store.load()
    infoCardMode.value = resolveInitialInfoCardView(infoCardData.value.mode, hasTips.value, hasAnnouncements.value)
    if (infoCardData.value.mode !== 'tip_only' && infoCardData.value.mode !== 'announcement_only') resume()

    let welcomeShown = false
    try {
      welcomeShown = localStorage.getItem(WELCOME_STORAGE_KEY) === 'true'
    } catch {
      // 存储不可用（隐私模式等）时按未看过欢迎页处理
    }
    if (welcomeShown) {
      isWelcome.value = false
      return
    }
    welcomeTimer = setTimeout(() => {
      isWelcome.value = false
      try {
        localStorage.setItem(WELCOME_STORAGE_KEY, 'true')
      } catch {
        // 写入失败仅影响下次是否跳过欢迎页
      }
      welcomeTimer = null
      if (hasTips.value) infoCardMode.value = 'tip'
    }, 5000)
  }

  function stop(): void {
    pause()
    if (welcomeTimer) clearTimeout(welcomeTimer)
    welcomeTimer = null
  }

  function toggle(): void {
    infoCardMode.value = infoCardMode.value === 'tip' ? 'announce' : 'tip'
  }

  return {
    infoCardData,
    infoCardMode,
    isWelcome,
    hasAnnouncements,
    hasTips,
    currentTip,
    currentAnnouncement,
    welcomeInfo,
    canToggleInfoCard,
    start,
    stop,
    toggle,
    pauseRotation,
    resumeRotation,
  }
}
