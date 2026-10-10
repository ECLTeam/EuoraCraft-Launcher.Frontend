import { ref, computed } from 'vue'
import backend from '@/api/client'
import { URLS } from '@/config/urls'

const USER_AGREEMENT_URL = URLS.userAgreement

interface UserAgreementState {
  accepted: boolean
  loading: boolean
}

const state = ref<UserAgreementState>({
  accepted: true,
  loading: false,
})

export function useUserAgreement() {
  const isAccepted = computed(() => state.value.accepted)
  const isLoading = computed(() => state.value.loading)
  const agreementUrl = computed(() => USER_AGREEMENT_URL)

  const markNotAccepted = () => {
    state.value.accepted = false
  }

  const acceptUserAgreement = async (): Promise<boolean> => {
    state.value.loading = true
    if (!backend.runtime.isAvailable) {
      state.value.accepted = true
      state.value.loading = false
      return true
    }

    const result = await backend.command('user_agreement_save')
    state.value.loading = false
    if (!result?.success) {
      console.error('[UserAgreement] 保存失败:', result?.message)
      return false
    }
    state.value.accepted = true
    return true
  }

  const rejectUserAgreement = async (): Promise<void> => {
    state.value.accepted = false
    if (!backend.runtime.isAvailable) return

    const result = await backend.command('user_agreement_clear')
    if (!result?.success) {
      console.warn('[UserAgreement] 后端清除失败:', result?.message)
    }
  }

  return {
    isAccepted,
    isLoading,
    agreementUrl,
    markNotAccepted,
    acceptUserAgreement,
    rejectUserAgreement,
  }
}
