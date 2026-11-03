import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { useLittleSkinLogin } from '@/features/accounts/composables/useLittleSkinLogin'
import { useAccountStore } from '@/features/accounts/stores/accountStore'
import type { LittleSkinLoginSnapshot } from '@/types/accounts'

vi.mock('@/features/accounts/api/accountsApi', () => ({
  accountsApi: {
    littleSkinConfig: vi.fn(),
    startLittleSkinLogin: vi.fn(),
    pollLittleSkinLogin: vi.fn(),
    selectLittleSkinProfile: vi.fn(),
    completeLittleSkinLogin: vi.fn(),
    cancelLittleSkinLogin: vi.fn(),
  },
}))

const initial: LittleSkinLoginSnapshot = {
  session_id: '0123456789abcdef0123456789abcdef',
  account_id: null,
  method: 'device_code',
  status: 'pending',
  user_code: 'ABCD-EFGH',
  verification_uri: 'https://open.littleskin.cn/oauth/link',
  expires_at: 2000000000,
  profiles: [],
  error_code: '',
}

function harness(completed = vi.fn()) {
  let login!: ReturnType<typeof useLittleSkinLogin>
  const wrapper = mount(
    defineComponent({
      setup() {
        login = useLittleSkinLogin(completed)
        return () => null
      },
    })
  )
  return { wrapper, login, completed }
}

describe('LittleSkin login lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    setActivePinia(createPinia())
    vi.spyOn(useAccountStore(), 'load').mockResolvedValue()
    vi.mocked(accountsApi.littleSkinConfig).mockResolvedValue({
      device_code: true,
      authorization_code: true,
      needs_client_id: false,
    })
    vi.mocked(accountsApi.startLittleSkinLogin).mockResolvedValue({ ...initial })
    vi.mocked(accountsApi.pollLittleSkinLogin).mockResolvedValue({ ...initial })
    vi.mocked(accountsApi.cancelLittleSkinLogin).mockResolvedValue({ ...initial, status: 'cancelled' })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('explains a rejected scope as an application permission issue', async () => {
    const { wrapper, login } = harness()
    await flushPromises()
    await login.start('device_code')
    vi.mocked(accountsApi.pollLittleSkinLogin).mockResolvedValue({
      ...initial,
      status: 'error',
      error_code: 'LITTLESKIN_INVALID_SCOPE',
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(login.hasError.value).toBe(true)
    expect(login.errorKey.value).toBe('littleskin.scopeRejected')
    wrapper.unmount()
    await flushPromises()
  })

  it('prevents duplicate starts and completes once after the backend becomes ready', async () => {
    const { wrapper, login, completed } = harness()
    await flushPromises()
    await Promise.all([login.start('device_code'), login.start('device_code')])
    expect(accountsApi.startLittleSkinLogin).toHaveBeenCalledTimes(1)
    vi.mocked(accountsApi.pollLittleSkinLogin).mockResolvedValue({ ...initial, status: 'ready' })
    vi.mocked(accountsApi.completeLittleSkinLogin).mockResolvedValue({ id: 'saved', alias: 'Player', type: 'authlib' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(accountsApi.completeLittleSkinLogin).toHaveBeenCalledTimes(1)
    expect(useAccountStore().load).toHaveBeenCalledWith(true)
    expect(completed).toHaveBeenCalledOnce()
    expect(login.session.value).toBeNull()
    wrapper.unmount()
  })

  it('keeps device login available without a client secret', async () => {
    vi.mocked(accountsApi.littleSkinConfig).mockResolvedValue({
      device_code: true,
      authorization_code: false,
      needs_client_id: false,
    })
    const { wrapper, login } = harness()
    await flushPromises()
    await login.start('authorization_code')
    expect(accountsApi.startLittleSkinLogin).not.toHaveBeenCalled()
    await login.start('device_code')
    expect(accountsApi.startLittleSkinLogin).toHaveBeenCalledWith('device_code', undefined)
    wrapper.unmount()
    await flushPromises()
  })

  it('cancels on disposal and ignores the old polling response', async () => {
    let resolvePoll!: (snapshot: LittleSkinLoginSnapshot) => void
    vi.mocked(accountsApi.pollLittleSkinLogin).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve
        })
    )
    const { wrapper, login, completed } = harness()
    await flushPromises()
    await login.start('device_code')
    await vi.advanceTimersByTimeAsync(1000)
    wrapper.unmount()
    resolvePoll({ ...initial, status: 'ready' })
    await flushPromises()
    expect(accountsApi.cancelLittleSkinLogin).toHaveBeenCalledWith(initial.session_id)
    expect(accountsApi.completeLittleSkinLogin).not.toHaveBeenCalled()
    expect(completed).not.toHaveBeenCalled()
  })

  it('retains a failed cancellation for recovery on reopening', async () => {
    vi.mocked(accountsApi.cancelLittleSkinLogin).mockRejectedValue(new Error('unavailable'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = harness()
    await flushPromises()
    await first.login.start('device_code')
    first.wrapper.unmount()
    await flushPromises()
    expect(useAccountStore().littleSkinLoginSession?.session_id).toBe(initial.session_id)
    const second = harness()
    await flushPromises()
    expect(second.login.session.value?.session_id).toBe(initial.session_id)
    vi.mocked(accountsApi.cancelLittleSkinLogin).mockResolvedValue({ ...initial, status: 'cancelled' })
    expect(await second.login.cancel()).toBe(true)
    expect(useAccountStore().littleSkinLoginSession).toBeNull()
    second.wrapper.unmount()
    warning.mockRestore()
  })

  it('retries a failed save without starting a second authorization', async () => {
    const { wrapper, login, completed } = harness()
    await flushPromises()
    await login.start('device_code')
    vi.mocked(accountsApi.pollLittleSkinLogin).mockResolvedValue({ ...initial, status: 'ready' })
    vi.mocked(accountsApi.completeLittleSkinLogin).mockRejectedValueOnce(new Error('disk unavailable'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(login.hasError.value).toBe(true)
    expect(completed).not.toHaveBeenCalled()
    vi.mocked(accountsApi.completeLittleSkinLogin).mockResolvedValue({ id: 'saved', alias: 'Player', type: 'authlib' })
    await login.retry()
    expect(accountsApi.startLittleSkinLogin).toHaveBeenCalledTimes(1)
    expect(accountsApi.completeLittleSkinLogin).toHaveBeenCalledTimes(2)
    expect(completed).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('only submits the selected authorized profile once', async () => {
    const { wrapper, login } = harness()
    await flushPromises()
    await login.start('device_code')
    vi.mocked(accountsApi.pollLittleSkinLogin).mockResolvedValue({
      ...initial,
      status: 'selecting',
      profiles: [
        { id: 'profile-a', name: 'Player A' },
        { id: 'profile-b', name: 'Player B' },
      ],
    })
    await vi.advanceTimersByTimeAsync(1000)
    login.selectedProfileId.value = 'profile-b'
    vi.mocked(accountsApi.selectLittleSkinProfile).mockResolvedValue({ ...initial, status: 'starting' })
    await Promise.all([login.selectProfile(), login.selectProfile()])
    expect(accountsApi.selectLittleSkinProfile).toHaveBeenCalledExactlyOnceWith(initial.session_id, 'profile-b')
    wrapper.unmount()
    await flushPromises()
  })

  it('stops repeated failed polling and lets the user resume explicitly', async () => {
    const { wrapper, login } = harness()
    await flushPromises()
    await login.start('device_code')
    vi.mocked(accountsApi.pollLittleSkinLogin).mockRejectedValue(new Error('offline'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(accountsApi.pollLittleSkinLogin).toHaveBeenCalledTimes(3)
    expect(login.hasError.value).toBe(true)
    vi.mocked(accountsApi.pollLittleSkinLogin).mockResolvedValue({ ...initial })
    await login.retry()
    await vi.advanceTimersByTimeAsync(1000)
    expect(login.hasError.value).toBe(false)
    expect(accountsApi.pollLittleSkinLogin).toHaveBeenCalledTimes(4)
    wrapper.unmount()
    await flushPromises()
  })
})
