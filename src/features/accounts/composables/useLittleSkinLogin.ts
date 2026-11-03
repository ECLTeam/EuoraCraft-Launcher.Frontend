import { computed, onScopeDispose, ref, toRef } from 'vue'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { useAccountStore } from '@/features/accounts/stores/accountStore'
import type { LittleSkinLoginConfig, LittleSkinLoginMethod, LittleSkinLoginSnapshot } from '@/types/accounts'

export function useLittleSkinLogin(onCompleted: () => void) {
  const accountStore = useAccountStore()
  const config = ref<LittleSkinLoginConfig>({ device_code: false, authorization_code: false, needs_client_id: false })
  const configLoading = ref(true)
  const session = toRef(accountStore, 'littleSkinLoginSession')
  const busy = ref(false)
  const hasError = ref(false)
  const selectedProfileId = ref('')
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pollFailures = 0
  let generation = 0

  const errorKey = computed(() => {
    const code = session.value?.error_code
    if (code === 'LITTLESKIN_NO_PROFILES') return 'littleskin.noProfiles'
    if (code === 'LITTLESKIN_ACCESS_DENIED') return 'littleskin.denied'
    if (code === 'LITTLESKIN_EXPIRED_TOKEN' || code === 'LITTLESKIN_INVALID_GRANT') return 'littleskin.expired'
    if (code === 'LITTLESKIN_INVALID_SCOPE') return 'littleskin.scopeRejected'
    if (code === 'LITTLESKIN_INVALID_CLIENT') return 'littleskin.notApproved'
    if (code === 'LITTLESKIN_CALLBACK_UNAVAILABLE' || code === 'LITTLESKIN_INVALID_REDIRECT_URI')
      return 'littleskin.callbackFailed'
    return 'littleskin.failed'
  })

  function stopPolling(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  async function loadConfig(): Promise<void> {
    configLoading.value = true
    hasError.value = false
    try {
      const result = await accountsApi.littleSkinConfig()
      if (!disposed) config.value = result
    } catch {
      if (!disposed) hasError.value = true
    } finally {
      if (!disposed) configLoading.value = false
    }
  }

  async function finish(sessionId: string): Promise<void> {
    if (busy.value) return
    busy.value = true
    stopPolling()
    try {
      await accountsApi.completeLittleSkinLogin(sessionId)
      await accountStore.load(true)
      if (session.value?.session_id === sessionId) {
        session.value = null
        if (!disposed) onCompleted()
      }
    } catch {
      if (!disposed) hasError.value = true
    } finally {
      if (!disposed) busy.value = false
    }
  }

  async function accept(result: LittleSkinLoginSnapshot): Promise<void> {
    if (disposed || session.value?.session_id !== result.session_id) return
    session.value = result
    selectedProfileId.value ||= result.profiles[0]?.id ?? ''
    if (result.status === 'error') {
      hasError.value = true
      return
    }
    if (result.status === 'ready') {
      await finish(result.session_id)
      return
    }
    if (['starting', 'pending', 'saving'].includes(result.status)) schedulePoll(result.session_id)
  }

  function schedulePoll(sessionId: string): void {
    stopPolling()
    const requestGeneration = generation
    timer = setTimeout(async () => {
      timer = undefined
      if (disposed || requestGeneration !== generation) return
      try {
        const result = await accountsApi.pollLittleSkinLogin(sessionId)
        if (disposed || requestGeneration !== generation) return
        pollFailures = 0
        await accept(result)
      } catch {
        if (disposed || requestGeneration !== generation) return
        pollFailures += 1
        if (pollFailures < 3) schedulePoll(sessionId)
        else hasError.value = true
      }
    }, 1000)
  }

  async function start(method: LittleSkinLoginMethod): Promise<void> {
    if (busy.value || session.value || !config.value[method]) return
    busy.value = true
    hasError.value = false
    const requestGeneration = ++generation
    try {
      const result = await accountsApi.startLittleSkinLogin(method)
      if (disposed || requestGeneration !== generation) {
        if (!session.value) session.value = result
        const cancelled = await accountsApi.cancelLittleSkinLogin(result.session_id)
        if (session.value?.session_id === result.session_id && cancelled.status === 'cancelled') session.value = null
        return
      }
      session.value = result
      busy.value = false
      await accept(result)
    } catch {
      if (!disposed) hasError.value = true
    } finally {
      if (!disposed) busy.value = false
    }
  }

  async function selectProfile(): Promise<void> {
    if (busy.value || !session.value || session.value.status !== 'selecting') return
    const sessionId = session.value.session_id
    busy.value = true
    hasError.value = false
    try {
      const result = await accountsApi.selectLittleSkinProfile(sessionId, selectedProfileId.value)
      busy.value = false
      await accept(result)
    } catch {
      if (!disposed) hasError.value = true
    } finally {
      if (!disposed) busy.value = false
    }
  }

  async function cancel(): Promise<boolean> {
    if (busy.value) return false
    generation += 1
    stopPolling()
    if (!session.value) return true
    busy.value = true
    try {
      const result = await accountsApi.cancelLittleSkinLogin(session.value.session_id)
      if (result.status === 'completed') await accountStore.load(true)
      if (!disposed) {
        session.value = null
        hasError.value = false
        selectedProfileId.value = ''
      }
      return true
    } catch {
      if (!disposed) hasError.value = true
      return false
    } finally {
      if (!disposed) busy.value = false
    }
  }

  async function retry(): Promise<void> {
    hasError.value = false
    const current = session.value
    if (!current) return loadConfig()
    if (current.status === 'ready') return finish(current.session_id)
    if (current.status === 'error' || current.status === 'cancelled') {
      if (await cancel()) await start(current.method)
      return
    }
    pollFailures = 0
    schedulePoll(current.session_id)
  }

  onScopeDispose(() => {
    disposed = true
    generation += 1
    stopPolling()
    const sessionId = session.value?.session_id
    if (sessionId && session.value?.status !== 'completed') {
      void accountsApi
        .cancelLittleSkinLogin(sessionId)
        .then((result) => {
          if (session.value?.session_id === sessionId && result.status === 'cancelled') session.value = null
        })
        .catch(() => {
          // 保留共享会话供再次进入后查询或取消，不把取消失败呈现为成功。
          console.warn('LittleSkin login cancellation failed during disposal')
        })
    }
  })

  void loadConfig()
  if (session.value) schedulePoll(session.value.session_id)
  return {
    config,
    configLoading,
    session,
    busy,
    hasError,
    errorKey,
    selectedProfileId,
    start,
    selectProfile,
    cancel,
    retry,
  }
}
