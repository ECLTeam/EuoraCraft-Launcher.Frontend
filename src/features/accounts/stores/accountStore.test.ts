import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { useAccountStore } from './accountStore'

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
    startMicrosoftLogin: vi.fn(),
    pollMicrosoftLogin: vi.fn(),
    cancelMicrosoftLogin: vi.fn(),
    completeMicrosoftLogin: vi.fn(),
    onMicrosoftLoginStatus: vi.fn(),
    setFavorite: vi.fn(),
    setPinned: vi.fn(),
    defaultSkins: vi.fn(),
    setOfflineSkin: vi.fn(),
  },
}))

const account = {
  id: 'alex',
  alias: 'Alex',
  type: 'offline' as const,
  isCurrent: true,
}

describe('accountStore', () => {
  it('后台账户通知同步列表，并防止旧的当前账户查询覆盖通知', async () => {
    const store = useAccountStore()
    let finish!: (value: null) => void
    vi.mocked(accountsApi.current).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const loading = store.loadCurrent()
    store.applySnapshot({ accounts: [account], current: account })
    finish(null)
    await loading
    expect(store.accounts).toEqual([account])
    expect(store.currentAccount).toEqual(account)
  })
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [account], current: account })
  })

  it('统一加载账户列表与当前账户', async () => {
    const store = useAccountStore()
    await store.load()

    expect(store.accounts).toEqual([account])
    expect(store.currentAccount).toEqual(account)
    expect(store.status).toBe('ready')
  })

  it('路由重新进入时复用已加载账户，并合并并发首次加载', async () => {
    const store = useAccountStore()
    let resolveAccounts: ((value: { accounts: Array<typeof account>; current: typeof account }) => void) | undefined
    vi.mocked(accountsApi.list).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAccounts = resolve
        })
    )

    const first = store.load()
    const second = store.load()
    expect(accountsApi.list).toHaveBeenCalledOnce()
    resolveAccounts?.({ accounts: [account], current: account })
    await Promise.all([first, second])

    await store.load()
    expect(accountsApi.list).toHaveBeenCalledOnce()
  })

  it('账户变更完成后强制重新同步账户列表', async () => {
    const store = useAccountStore()
    await store.load()
    await store.switchAccount('alex')

    expect(accountsApi.list).toHaveBeenCalledTimes(2)
  })

  it.each(['start', 'complete'])('微软登录 %s 完成后替换已有缓存并同步当前账户', async (step) => {
    const store = useAccountStore()
    await store.load()
    const microsoft = { id: 'microsoft-player', alias: '正版玩家', type: 'microsoft' as const, isCurrent: true }
    vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [account, microsoft], current: microsoft })
    if (step === 'start') {
      vi.mocked(accountsApi.startMicrosoftLogin).mockResolvedValue({ status: 'completed' })
      await store.startMicrosoftLogin()
    } else {
      vi.mocked(accountsApi.completeMicrosoftLogin).mockResolvedValue({ status: 'completed', account: microsoft })
      await store.completeMicrosoftLogin()
    }
    expect(store.accounts).toEqual([account, microsoft])
    expect(store.currentAccount).toEqual(microsoft)
  })

  it('登录完成时旧列表请求未结束，等待后续刷新并丢弃旧快照', async () => {
    const store = useAccountStore()
    let finishOld!: (value: { accounts: Array<typeof account>; current: typeof account }) => void
    vi.mocked(accountsApi.list).mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)))
    const initialLoad = store.load()
    const microsoft = { id: 'microsoft-player', alias: '正版玩家', type: 'microsoft' as const, isCurrent: true }
    vi.mocked(accountsApi.completeMicrosoftLogin).mockResolvedValue({ status: 'completed', account: microsoft })
    vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [account, microsoft], current: microsoft })
    const login = store.completeMicrosoftLogin()
    await Promise.resolve()
    finishOld({ accounts: [account], current: account })
    await Promise.all([initialLoad, login])
    expect(store.accounts).toEqual([account, microsoft])
    expect(store.currentAccount).toEqual(microsoft)
    expect(accountsApi.list).toHaveBeenCalledTimes(2)
  })

  it('外置登录完成后刷新已加载账户，未完成的微软登录不刷新', async () => {
    const store = useAccountStore()
    await store.load()
    const authlib = { id: 'authlib-player', alias: '外置玩家', type: 'authlib' as const }
    vi.mocked(accountsApi.addAuthlib).mockResolvedValue(authlib)
    vi.mocked(accountsApi.listAuthlibServers).mockResolvedValue([])
    vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [account, authlib], current: account })
    await store.addAuthlib('https://example.com', 'player', 'password')
    expect(store.accounts).toEqual([account, authlib])
    vi.mocked(accountsApi.completeMicrosoftLogin).mockResolvedValue({ status: 'pending' })
    await store.completeMicrosoftLogin()
    expect(accountsApi.list).toHaveBeenCalledTimes(2)
  })

  it('按账户 UUID 合并重复账户并保留当前账户', async () => {
    const previousAccount = {
      id: 'microsoft-old',
      alias: 'Player',
      type: 'microsoft' as const,
      uuid: '01234567-89ab-cdef-0123-456789abcdef',
      isCurrent: false,
    }
    const currentAccount = {
      ...previousAccount,
      id: 'microsoft-new',
      uuid: '0123456789abcdef0123456789abcdef',
      isCurrent: true,
    }
    vi.mocked(accountsApi.list).mockResolvedValue({
      accounts: [previousAccount, currentAccount],
      current: currentAccount,
    })
    const store = useAccountStore()

    await store.load()

    expect(store.accounts).toEqual([currentAccount])
    expect(store.currentAccount).toEqual(currentAccount)
  })

  it('切换账户后重新同步领域状态', async () => {
    const store = useAccountStore()
    await store.switchAccount('alex')

    expect(accountsApi.switch).toHaveBeenCalledWith('alex')
    expect(accountsApi.list).toHaveBeenCalledOnce()
    expect(store.currentAccount?.id).toBe('alex')
  })

  it('添加离线账户时转发可选 UUID', async () => {
    const store = useAccountStore()
    vi.mocked(accountsApi.addOffline).mockResolvedValue(account)

    await store.addOffline('Alex', '01234567-89ab-cdef-0123-456789abcdef')

    expect(accountsApi.addOffline).toHaveBeenCalledWith('Alex', '01234567-89ab-cdef-0123-456789abcdef', undefined)
  })

  it('添加离线账户时转发可选皮肤', async () => {
    const store = useAccountStore()
    vi.mocked(accountsApi.addOffline).mockResolvedValue(account)

    await store.addOffline('Steve', undefined, 'alice')

    expect(accountsApi.addOffline).toHaveBeenCalledWith('Steve', undefined, 'alice')
    expect(accountsApi.defaultSkins).not.toHaveBeenCalled()
  })

  it('读取默认皮肤列表时转发到后端', async () => {
    const store = useAccountStore()
    vi.mocked(accountsApi.defaultSkins).mockResolvedValue([
      { id: 'alice', name: 'Alice', skinUrl: 'data:image/png;base64,AAAA' },
    ])

    const skins = await store.defaultSkins()

    expect(skins).toHaveLength(1)
    expect(accountsApi.defaultSkins).toHaveBeenCalledOnce()
  })

  it('设置离线皮肤后刷新账户列表', async () => {
    const store = useAccountStore()
    vi.mocked(accountsApi.setOfflineSkin).mockResolvedValue({ accounts: [account], current: account })

    await store.setOfflineSkin('alex', 'alice')

    expect(accountsApi.setOfflineSkin).toHaveBeenCalledWith('alex', 'alice')
    expect(accountsApi.list).toHaveBeenCalledOnce()
  })

  it('将微软登录取消请求转发到后端', async () => {
    vi.mocked(accountsApi.cancelMicrosoftLogin).mockResolvedValue()
    const store = useAccountStore()

    await store.cancelMicrosoftLogin()

    expect(accountsApi.cancelMicrosoftLogin).toHaveBeenCalledOnce()
  })

  it('订阅后端推送的微软登录状态', () => {
    const handler = vi.fn()
    const unlisten = vi.fn()
    vi.mocked(accountsApi.onMicrosoftLoginStatus).mockReturnValue(unlisten)
    const store = useAccountStore()

    expect(store.onMicrosoftLoginStatus(handler)).toBe(unlisten)
    expect(accountsApi.onMicrosoftLoginStatus).toHaveBeenCalledWith(handler)
  })

  it('loads Microsoft login availability from the backend', async () => {
    vi.mocked(accountsApi.getMicrosoftLoginConfig).mockResolvedValue({
      available: false,
      needs_client_id: true,
    })
    const store = useAccountStore()

    await store.loadMicrosoftLoginConfig()

    expect(store.microsoftLoginConfig).toEqual({
      available: false,
      needs_client_id: true,
    })
    expect(store.microsoftLoginConfigStatus).toBe('ready')
  })
})
