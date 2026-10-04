import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import type { MicrosoftLoginStatusEvent } from '@/types/accounts'
import { openExternalUrl } from '@/utils/openExternal'
import { useAccountManager } from './useAccountManager'

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

let microsoftLoginStatusHandler: ((event: MicrosoftLoginStatusEvent) => void) | undefined

vi.mock('@/features/accounts/api/accountsApi', () => ({
  accountsApi: {
    list: vi.fn(),
    current: vi.fn(),
    addOffline: vi.fn(),
    addAuthlib: vi.fn(),
    selectAuthlibProfile: vi.fn(),
    resolveAuthlibServer: vi.fn(),
    switch: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    listAuthlibServers: vi.fn(),
    getMicrosoftLoginConfig: vi.fn(),
    getAuthlibLoginConfig: vi.fn(),
    startMicrosoftLogin: vi.fn(),
    pollMicrosoftLogin: vi.fn(),
    cancelMicrosoftLogin: vi.fn(),
    completeMicrosoftLogin: vi.fn(),
    onMicrosoftLoginStatus: vi.fn(),
  },
}))

vi.mock('@/utils/openExternal', () => ({
  openExternalUrl: vi.fn(),
}))

vi.mock('./useClipboard', () => ({
  useClipboard: () => ({
    copied: { value: false },
    copy: mocks.copy,
  }),
}))

vi.mock('./useLauncherMessage', () => ({
  useLauncherMessage: () => ({
    success: mocks.success,
    error: mocks.error,
    info: mocks.info,
  }),
}))

describe('useAccountManager Microsoft login', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [], current: null })
    vi.mocked(accountsApi.listAuthlibServers).mockResolvedValue([])
    vi.mocked(accountsApi.getMicrosoftLoginConfig).mockResolvedValue({
      available: true,
      needs_client_id: false,
    })
    vi.mocked(accountsApi.onMicrosoftLoginStatus).mockImplementation((handler) => {
      microsoftLoginStatusHandler = handler
      return vi.fn()
    })
  })

  it('opens the browser and copies the device code after login starts', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(accountsApi.startMicrosoftLogin).mockResolvedValue({
        status: 'pending',
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://microsoft.com/link',
        interval: 5,
      })
      const account = useAccountManager((key) => key)

      await account.loadMicrosoftLoginConfig()
      await account.startMicrosoftLogin()
      await vi.advanceTimersByTimeAsync(2000)

      expect(openExternalUrl).toHaveBeenCalledWith('https://microsoft.com/link')
      expect(mocks.copy).toHaveBeenCalledWith('ABCD-EFGH')
      expect(account.showMicrosoftLoginModal).toBe(true)
      expect(accountsApi.pollMicrosoftLogin).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not start login when MICROSOFT_CLIENT_ID is missing', async () => {
    vi.mocked(accountsApi.getMicrosoftLoginConfig).mockResolvedValue({
      available: false,
      needs_client_id: true,
    })
    const account = useAccountManager((key) => key)

    await account.loadMicrosoftLoginConfig()
    await account.startMicrosoftLogin()

    expect(account.microsoftLoginConfig.needs_client_id).toBe(true)
    expect(accountsApi.startMicrosoftLogin).not.toHaveBeenCalled()
  })

  it('shows a login already processing without reopening the authorization page', async () => {
    vi.mocked(accountsApi.startMicrosoftLogin).mockResolvedValue({ status: 'progress', stage: 'profile' })
    const account = useAccountManager((key) => key)
    await account.loadMicrosoftLoginConfig()
    await account.startMicrosoftLogin()
    expect(account.showMicrosoftLoginModal).toBe(true)
    expect(account.microsoftLoginStatus).toBe('loading')
    expect(account.microsoftLoginStage).toBe('profile')
    expect(openExternalUrl).not.toHaveBeenCalled()
  })

  it.each(['progress', 'ready', 'cancelled'] as const)(
    'handles an early %s event before the start response',
    async (status) => {
      const player = { id: 'microsoft-account', alias: 'Player', type: 'microsoft' as const, isCurrent: true }
      vi.mocked(accountsApi.startMicrosoftLogin).mockImplementation(async () => {
        microsoftLoginStatusHandler?.({ status, stage: 'profile' })
        return { status: 'pending', userCode: 'ABCD', verificationUri: 'https://microsoft.com/link' }
      })
      vi.mocked(accountsApi.completeMicrosoftLogin).mockResolvedValue({ status: 'completed', account: player })
      vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [player], current: player })
      const account = useAccountManager((key) => key)
      await account.loadMicrosoftLoginConfig()
      await account.startMicrosoftLogin()
      expect(account.showMicrosoftLoginModal).toBe(status === 'progress')
      if (status === 'progress') expect(account.microsoftLoginStage).toBe('profile')
      if (status === 'ready') expect(account.currentAccount?.alias).toBe('Player')
      expect(openExternalUrl).not.toHaveBeenCalled()
    }
  )

  it.each(['cancelled', 'progress'] as const)('does not open a delayed browser after %s', async (status) => {
    vi.useFakeTimers()
    try {
      vi.mocked(accountsApi.startMicrosoftLogin).mockResolvedValue({
        status: 'pending',
        userCode: 'ABCD',
        verificationUri: 'https://microsoft.com/link',
      })
      const account = useAccountManager((key) => key)
      await account.loadMicrosoftLoginConfig()
      await account.startMicrosoftLogin()
      microsoftLoginStatusHandler?.({ status, stage: 'profile' })
      await vi.advanceTimersByTimeAsync(2000)
      expect(openExternalUrl).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('添加离线账户时向后端传递有效的自定义 UUID', async () => {
    vi.mocked(accountsApi.addOffline).mockResolvedValue({
      id: 'offline:custom',
      alias: 'CustomPlayer',
      type: 'offline',
      uuid: '01234567-89ab-cdef-0123-456789abcdef',
      isCurrent: true,
    })
    const account = useAccountManager((key) => key)
    account.newOfflineUsername = 'CustomPlayer'
    account.newOfflineUuid = '0123456789abcdef0123456789abcdef'

    await account.addOfflineAccount()

    expect(accountsApi.addOffline).toHaveBeenCalledWith('CustomPlayer', '0123456789abcdef0123456789abcdef', undefined)
    expect(account.newOfflineUuid).toBe('')
  })

  it('自定义 UUID 格式无效时不发送添加请求', async () => {
    const account = useAccountManager((key) => key)
    account.newOfflineUsername = 'CustomPlayer'
    account.newOfflineUuid = 'invalid-uuid'

    await account.addOfflineAccount()

    expect(account.offlineUuidError).toBe('game.invalidOfflineUuid')
    expect(accountsApi.addOffline).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('game.invalidOfflineUuid')
  })

  it('completes login when the backend pushes a ready event', async () => {
    vi.mocked(accountsApi.completeMicrosoftLogin).mockResolvedValue({
      status: 'completed',
      account: {
        id: 'microsoft-account',
        alias: 'Player',
        type: 'microsoft',
        isCurrent: true,
      },
    })
    const account = useAccountManager((key) => key)
    account.showMicrosoftLoginModal = true

    microsoftLoginStatusHandler?.({ status: 'ready' })
    await vi.waitFor(() => expect(accountsApi.completeMicrosoftLogin).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(account.showMicrosoftLoginModal).toBe(false))

    expect(accountsApi.pollMicrosoftLogin).not.toHaveBeenCalled()
  })

  it('shows the Microsoft login stage pushed by the backend', async () => {
    const account = useAccountManager((key) => key)
    account.showMicrosoftLoginModal = true

    microsoftLoginStatusHandler?.({
      status: 'progress',
      stage: 'minecraft_token',
      focus: false,
    })
    await Promise.resolve()

    expect(account.microsoftLoginStatus).toBe('loading')
    expect(account.microsoftLoginStage).toBe('minecraft_token')
    expect(accountsApi.completeMicrosoftLogin).not.toHaveBeenCalled()
  })

  it('submits the Authlib form through the account store', async () => {
    vi.mocked(accountsApi.addAuthlib).mockResolvedValue({
      id: 'authlib-account',
      alias: 'AuthlibPlayer',
      type: 'authlib',
      auth_server: 'https://skin.example.com/api/yggdrasil',
    })
    const account = useAccountManager((key) => key)
    account.authlibServerUrl = 'https://skin.example.com/api/yggdrasil'
    account.authlibEmail = 'player@example.com'
    account.authlibPassword = 'secret-password'

    await account.addAuthlibAccount()

    expect(accountsApi.addAuthlib).toHaveBeenCalledWith(
      'https://skin.example.com/api/yggdrasil',
      'player@example.com',
      'secret-password'
    )
    expect(account.authlibPassword).toBe('')
    expect(account.authlibServerUrl).toBe('https://skin.example.com/api/yggdrasil')
    expect(account.authlibEmail).toBe('player@example.com')
  })

  it('asks for one profile and completes a multi-profile Authlib login', async () => {
    vi.mocked(accountsApi.addAuthlib).mockResolvedValue({
      id: 'pending-authlib-account',
      alias: '请选择角色',
      type: 'authlib',
      profile_selection_required: true,
      available_profiles: [
        { id: 'profile-one', name: 'PlayerOne', logged_in: true },
        { id: 'profile-two', name: 'PlayerTwo' },
      ],
    })
    vi.mocked(accountsApi.selectAuthlibProfile).mockResolvedValue({
      id: 'pending-authlib-account',
      alias: 'PlayerTwo',
      type: 'authlib',
      uuid: 'profile-two',
      isCurrent: true,
    })
    const account = useAccountManager((key) => key)
    account.authlibServerUrl = 'https://skin.example.com/api/yggdrasil'
    account.authlibEmail = 'player@example.com'
    account.authlibPassword = 'secret-password'

    await account.addAuthlibAccount()

    expect(account.pendingAuthlibAccountId).toBe('pending-authlib-account')
    expect(account.selectedAuthlibProfileId).toBe('profile-one')
    expect(account.authlibProfileOptions[0]).toMatchObject({
      label: 'PlayerOne',
      loggedIn: true,
    })
    expect(mocks.success).not.toHaveBeenCalled()

    account.selectedAuthlibProfileId = 'profile-two'
    await account.selectAuthlibProfile()

    expect(accountsApi.selectAuthlibProfile).toHaveBeenCalledWith('pending-authlib-account', 'profile-two')
    expect(account.pendingAuthlibAccountId).toBe('')
    expect(mocks.success).toHaveBeenCalledWith('game.status.accountAdded')
  })

  it('fills the Authlib form with the most recent saved login', async () => {
    vi.mocked(accountsApi.listAuthlibServers).mockResolvedValue([
      {
        name: 'skin.example.com',
        url: 'https://skin.example.com/api/yggdrasil/',
        email: 'player@example.com',
        description: 'https://skin.example.com/api/yggdrasil/',
      },
      {
        name: 'another.example.com',
        url: 'https://another.example.com/yggdrasil',
        email: 'another@example.com',
        description: 'https://another.example.com/yggdrasil',
      },
    ])
    const account = useAccountManager((key) => key)

    await account.loadAuthlibServers()

    expect(account.authlibServerUrl).toBe('https://skin.example.com/api/yggdrasil/')
    expect(account.authlibEmail).toBe('player@example.com')
    expect(account.authlibServerOptions[0]).toMatchObject({
      value: 'https://skin.example.com/api/yggdrasil/',
      label: 'https://skin.example.com/api/yggdrasil/',
      email: 'player@example.com',
    })
    expect(account.renderAuthlibServerOption(account.authlibServerOptions[0]!)).toBe(
      'https://skin.example.com/api/yggdrasil/ · player@example.com'
    )

    account.selectAuthlibServer('https://another.example.com/yggdrasil')
    expect(account.authlibEmail).toBe('another@example.com')
  })

  it('replaces a website URL with the ALI endpoint', async () => {
    vi.mocked(accountsApi.resolveAuthlibServer).mockResolvedValue('https://skin.example.com/api/yggdrasil')
    const account = useAccountManager((key) => key)
    account.authlibServerUrl = 'https://skin.example.com/user/player'

    await account.resolveAuthlibServer()

    expect(accountsApi.resolveAuthlibServer).toHaveBeenCalledWith('https://skin.example.com/user/player')
    expect(account.authlibServerUrl).toBe('https://skin.example.com/api/yggdrasil')
  })

  it('cancels the backend login flow when the login window closes', async () => {
    vi.mocked(accountsApi.cancelMicrosoftLogin).mockResolvedValue()
    const account = useAccountManager((key) => key)
    account.showMicrosoftLoginModal = true

    await account.cancelMicrosoftLogin()

    expect(account.showMicrosoftLoginModal).toBe(false)
    expect(accountsApi.cancelMicrosoftLogin).toHaveBeenCalledOnce()
  })
})
