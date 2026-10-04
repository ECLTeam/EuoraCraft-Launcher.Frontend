import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import type {
  AuthProvider,
  AuthlibLoginConfigData,
  AuthlibServer,
  DefaultSkin,
  MicrosoftCompleteData,
  MicrosoftLoginConfigData,
  MicrosoftLoginData,
  MicrosoftLoginStatusEvent,
  MicrosoftPollData,
  MinecraftAccount,
} from '@/types/accounts'

export const useAccountStore = defineStore('accounts', () => {
  const accounts = ref<MinecraftAccount[]>([])
  const currentAccount = ref<MinecraftAccount | null>(null)
  const authlibServers = ref<AuthlibServer[]>([])
  const authProviders = ref<AuthProvider[]>([])
  const microsoftLoginConfig = ref<MicrosoftLoginConfigData>({
    available: false,
    needs_client_id: false,
  })
  const authlibLoginConfig = ref<AuthlibLoginConfigData>({
    available: false,
  })
  const { status, isLoading } = useAsyncState()
  const { status: authlibStatus, isLoading: isAuthlibLoading } = useAsyncState()
  const { status: microsoftLoginConfigStatus, isLoading: isMicrosoftLoginConfigLoading } = useAsyncState()
  const { status: authlibLoginConfigStatus, isLoading: isAuthlibLoginConfigLoading } = useAsyncState()
  const error = ref('')
  let loadPromise: Promise<void> | null = null
  let reloadRequested = false

  function accountIdentity(account: MinecraftAccount): string {
    const accountUuid = account.uuid?.replaceAll('-', '').trim().toLowerCase()
    if (accountUuid) {
      const server = account.type === 'authlib' ? account.auth_server || '' : ''
      return `${account.type}:uuid:${server}:${accountUuid}`
    }

    const email = account.email?.trim().toLowerCase()
    if (email) {
      const server = account.type === 'authlib' ? account.auth_server || '' : ''
      return `${account.type}:email:${server}:${email}`
    }
    if (account.type === 'offline') return `offline:alias:${account.alias.trim().toLowerCase()}`
    return `${account.type}:id:${account.id}`
  }

  function deduplicateAccounts(items: MinecraftAccount[], currentId?: string): MinecraftAccount[] {
    const uniqueAccounts = new Map<string, MinecraftAccount>()
    for (const account of items) {
      const identity = accountIdentity(account)
      const existing = uniqueAccounts.get(identity)
      if (!existing || account.id === currentId) uniqueAccounts.set(identity, account)
    }
    return [...uniqueAccounts.values()]
  }

  async function load(force = false): Promise<void> {
    if (loadPromise) {
      if (force) reloadRequested = true
      return loadPromise
    }
    if (!force && status.value === 'ready') return

    status.value = 'loading'
    error.value = ''
    const request = (async () => {
      try {
        do {
          reloadRequested = false
          try {
            const result = await accountsApi.list()
            // 账户变更发生在旧请求途中时，丢弃旧快照并合并执行一次后续刷新。
            if (reloadRequested) continue
            const loadedAccounts = deduplicateAccounts(result.accounts ?? [], result.current?.id)
            accounts.value = loadedAccounts
            currentAccount.value = result.current
              ? (loadedAccounts.find((account) => account.id === result.current?.id) ?? result.current)
              : null
          } catch (reason) {
            if (!reloadRequested) throw reason
          }
        } while (reloadRequested)
        status.value = 'ready'
      } catch (reason) {
        status.value = 'error'
        error.value = reason instanceof Error ? reason.message : '读取账户失败'
        throw reason
      } finally {
        loadPromise = null
      }
    })()
    loadPromise = request
    return request
  }

  async function loadCurrent(): Promise<void> {
    currentAccount.value = await accountsApi.current()
  }

  /**
   * 执行变更操作后刷新账户列表。
   * 多个「先调用后端 API、再 load()」的动作共用此模式，避免重复样板代码。
   */
  async function runAndReload<T>(action: () => Promise<T>, reload: () => Promise<void> = () => load(true)): Promise<T> {
    const result = await action()
    await reload()
    return result
  }

  async function addOffline(username: string, uuid?: string, skin?: string): Promise<void> {
    await runAndReload(() => accountsApi.addOffline(username, uuid, skin))
  }

  async function defaultSkins(): Promise<DefaultSkin[]> {
    return accountsApi.defaultSkins()
  }

  async function setOfflineSkin(accountId: string, skin?: string): Promise<void> {
    await runAndReload(() => accountsApi.setOfflineSkin(accountId, skin))
  }

  async function addAuthlib(serverUrl: string, email: string, password: string): Promise<MinecraftAccount> {
    return runAndReload(
      () => accountsApi.addAuthlib(serverUrl, email, password),
      async () => {
        await Promise.all([load(true), loadAuthlibServers(true)])
      }
    )
  }

  async function selectAuthlibProfile(accountId: string, profileId: string): Promise<MinecraftAccount> {
    return runAndReload(() => accountsApi.selectAuthlibProfile(accountId, profileId))
  }

  function resolveAuthlibServer(serverUrl: string): Promise<string> {
    return accountsApi.resolveAuthlibServer(serverUrl)
  }

  async function switchAccount(accountId: string): Promise<void> {
    await runAndReload(() => accountsApi.switch(accountId))
  }

  async function removeAccount(accountId: string): Promise<void> {
    await runAndReload(() => accountsApi.remove(accountId))
  }

  async function refreshAccount(accountId: string): Promise<void> {
    await runAndReload(() => accountsApi.refresh(accountId))
  }

  async function loadAuthlibServers(force = false): Promise<void> {
    if (!force && (authlibStatus.value === 'loading' || authlibStatus.value === 'ready')) return
    authlibStatus.value = 'loading'
    try {
      authlibServers.value = await accountsApi.listAuthlibServers()
      authlibStatus.value = 'ready'
    } catch (reason) {
      authlibServers.value = []
      authlibStatus.value = 'error'
      throw reason
    }
  }

  async function loadAuthProviders(force = false): Promise<void> {
    if (!force && authProviders.value.length > 0) return
    authProviders.value = await accountsApi.listAuthProviders()
  }

  async function addPluginAccount(providerId: string, values: Record<string, string>): Promise<MinecraftAccount> {
    return runAndReload(() => accountsApi.addPluginAccount(providerId, values))
  }

  async function startMicrosoftLogin(): Promise<MicrosoftLoginData> {
    const result = await accountsApi.startMicrosoftLogin()
    if (result.status === 'completed') await load(true)
    return result
  }

  async function loadMicrosoftLoginConfig(): Promise<void> {
    microsoftLoginConfigStatus.value = 'loading'
    try {
      microsoftLoginConfig.value = await accountsApi.getMicrosoftLoginConfig()
      microsoftLoginConfigStatus.value = 'ready'
    } catch (reason) {
      microsoftLoginConfig.value = { available: false, needs_client_id: true }
      microsoftLoginConfigStatus.value = 'error'
      throw reason
    }
  }

  async function loadAuthlibLoginConfig(): Promise<void> {
    authlibLoginConfigStatus.value = 'loading'
    try {
      authlibLoginConfig.value = await accountsApi.getAuthlibLoginConfig()
      authlibLoginConfigStatus.value = 'ready'
    } catch (reason) {
      authlibLoginConfig.value = { available: false }
      authlibLoginConfigStatus.value = 'error'
      throw reason
    }
  }

  function pollMicrosoftLogin(): Promise<MicrosoftPollData> {
    return accountsApi.pollMicrosoftLogin()
  }

  function cancelMicrosoftLogin(): Promise<void> {
    return accountsApi.cancelMicrosoftLogin()
  }

  async function completeMicrosoftLogin(): Promise<MicrosoftCompleteData> {
    const result = await accountsApi.completeMicrosoftLogin()
    if (result.account) await load(true)
    return result
  }

  async function setFavorite(accountId: string, favorite: boolean): Promise<void> {
    await runAndReload(() => accountsApi.setFavorite(accountId, favorite))
  }

  async function setPinned(accountId: string, pinned: boolean): Promise<void> {
    await runAndReload(() => accountsApi.setPinned(accountId, pinned))
  }

  function onMicrosoftLoginStatus(handler: (event: MicrosoftLoginStatusEvent) => void): () => void {
    return accountsApi.onMicrosoftLoginStatus(handler)
  }

  return {
    accounts,
    currentAccount,
    authlibServers,
    authProviders,
    microsoftLoginConfig,
    authlibLoginConfig,
    status,
    authlibStatus,
    microsoftLoginConfigStatus,
    authlibLoginConfigStatus,
    error,
    isLoading,
    isAuthlibLoading,
    isMicrosoftLoginConfigLoading,
    isAuthlibLoginConfigLoading,
    load,
    loadCurrent,
    addOffline,
    defaultSkins,
    setOfflineSkin,
    addAuthlib,
    selectAuthlibProfile,
    resolveAuthlibServer,
    switchAccount,
    removeAccount,
    refreshAccount,
    loadAuthlibServers,
    loadAuthProviders,
    addPluginAccount,
    loadMicrosoftLoginConfig,
    loadAuthlibLoginConfig,
    startMicrosoftLogin,
    pollMicrosoftLogin,
    cancelMicrosoftLogin,
    completeMicrosoftLogin,
    setFavorite,
    setPinned,
    onMicrosoftLoginStatus,
  }
})
