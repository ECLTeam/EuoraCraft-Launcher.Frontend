import { storeToRefs } from 'pinia'
import { reactive, ref, computed } from 'vue'
import { notifyLauncherPopup } from '@/app/runtime/useLauncherPopupQueue'
import { useAccountStore } from '@/features/accounts/stores/accountStore'
import type {
  AuthProvider,
  AuthlibProfile,
  DefaultSkin,
  MicrosoftLoginData,
  MicrosoftLoginStage,
  MicrosoftLoginStatusEvent,
  MinecraftAccount,
} from '@/types/accounts'
import { getAccountTypeLabelKey } from '@/utils/enums'
import { openExternalUrl } from '@/utils/openExternal'
import { useClipboard } from './useClipboard'
import { useLauncherMessage } from './useLauncherMessage'
import type { AutoCompleteOption } from 'naive-ui'

export type Account = MinecraftAccount
const OFFLINE_UUID_PATTERN =
  /^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/

export function useAccountManager(t: (key: string, ...args: unknown[]) => string) {
  const message = useLauncherMessage()
  const { copied: copiedUserCode, copy: copyToClipboard } = useClipboard()
  const accountStore = useAccountStore()
  const {
    accounts,
    currentAccount,
    isLoading: accountsLoading,
    authlibServers,
    authProviders,
    isAuthlibLoading: authlibServersLoading,
    microsoftLoginConfig,
    isMicrosoftLoginConfigLoading,
    authlibLoginConfig,
    isAuthlibLoginConfigLoading,
  } = storeToRefs(accountStore)

  const showAccountModal = ref(false)
  const newOfflineUsername = ref('')
  const newOfflineUuid = ref('')
  const offlineUuidError = computed(() => {
    const value = newOfflineUuid.value.trim()
    return value && !OFFLINE_UUID_PATTERN.test(value) ? t('game.invalidOfflineUuid') : ''
  })
  const addingOffline = ref(false)

  // 离线账户默认皮肤（resources/Skins），新增与更换时共用。
  const offlineSkins = ref<DefaultSkin[]>([])
  const offlineSkinsLoading = ref(false)
  const selectedOfflineSkinId = ref('')

  async function loadOfflineSkins() {
    if (offlineSkins.value.length > 0) return
    offlineSkinsLoading.value = true
    try {
      offlineSkins.value = await accountStore.defaultSkins()
    } catch (reason) {
      // 皮肤列表加载失败不阻断账户新增，仅回退为无皮肤。
      console.warn('[AccountManager] 读取默认皮肤失败:', reason)
    } finally {
      offlineSkinsLoading.value = false
    }
  }

  const offlineSkinOptions = computed(() =>
    offlineSkins.value.map((skin) => ({
      value: skin.id,
      label: skin.name,
    }))
  )

  // Authlib
  const showAuthlibForm = ref(false)
  const authlibServerUrl = ref('')
  const authlibEmail = ref('')
  const authlibPassword = ref('')
  const addingAuthlib = ref(false)
  const pendingAuthlibAccountId = ref('')
  const authlibProfiles = ref<AuthlibProfile[]>([])
  const selectedAuthlibProfileId = ref('')
  const selectingAuthlibProfile = ref(false)
  const authlibProfileOptions = computed(() =>
    authlibProfiles.value.map((profile) => ({
      value: profile.id,
      label: profile.name,
      profileName: profile.name,
      loggedIn: profile.logged_in,
    }))
  )
  const authlibServerOptions = computed(() =>
    authlibServers.value.map((server) => ({
      value: server.url,
      label: server.url,
      email: server.email,
      desc: server.description || server.url,
    }))
  )

  function renderAuthlibServerOption(option: AutoCompleteOption) {
    const label = String(option.label ?? option.value ?? '')
    return option.email ? `${label} · ${option.email}` : label
  }

  // 插件认证提供方
  const addingPluginAccount = ref(false)
  const pluginFieldValues = reactive<Record<string, string>>({})

  function resetPluginForm() {
    for (const key of Object.keys(pluginFieldValues)) delete pluginFieldValues[key]
  }

  async function loadPluginProviders() {
    try {
      await accountStore.loadAuthProviders()
    } catch (reason) {
      console.warn('[AccountManager] 读取插件登录方式失败:', reason)
    }
  }

  function pluginProviderById(providerId: string): AuthProvider | undefined {
    return authProviders.value.find((provider) => provider.id === providerId)
  }

  async function addPluginAccount(provider: AuthProvider) {
    const values: Record<string, string> = {}
    for (const field of provider.fields) {
      const value = (pluginFieldValues[field.key] ?? '').trim()
      if (field.required && !value) {
        message.error(t('auth.fieldRequired', { field: field.label }))
        return
      }
      values[field.key] = value
    }
    addingPluginAccount.value = true
    try {
      await accountStore.addPluginAccount(provider.id, values)
      message.success(t('game.status.accountAdded'))
      resetPluginForm()
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.accountAddFailed'))
    } finally {
      addingPluginAccount.value = false
    }
  }

  const showMicrosoftLoginModal = ref(false)
  const startingMicrosoftLogin = ref(false)
  const completingMicrosoftLogin = ref(false)
  const microsoftLoginStatus = ref<'pending' | 'loading' | 'error'>('pending')
  const microsoftLoginStage = ref<MicrosoftLoginStage>('waiting_authorization')
  const microsoftLoginData = ref<Pick<MicrosoftLoginData, 'userCode' | 'verificationUri'>>({
    userCode: '',
    verificationUri: '',
  })
  const microsoftLoginError = ref('')
  let pendingMicrosoftLoginEvent: MicrosoftLoginStatusEvent | undefined

  const showDeleteConfirmModal = ref(false)
  const deletingAccount = ref(false)
  const accountToDelete = ref<{ id: string; alias: string } | null>(null)
  const deleteConfirmMessage = computed(() => {
    if (!accountToDelete.value) return ''
    return t('game.deleteConfirm', { name: accountToDelete.value.alias })
  })

  let completingFromEvent = false

  const stopMicrosoftLoginStatusListener = accountStore.onMicrosoftLoginStatus((event) => {
    void handleMicrosoftLoginStatus(event)
  })

  const accountTypeLabel = computed(() => t(getAccountTypeLabelKey(currentAccount.value?.type)))

  async function loadAccounts() {
    try {
      await accountStore.load()
    } catch {
      notifyLauncherPopup({
        id: 'account-load-failed',
        title: t('game.status.accountLoadFailed'),
        content: `${t('game.status.accountLoadFailed')}，账户列表可能不完整，请稍后重试或检查网络。`,
        level: 'warning',
        priority: 75,
      })
    }
  }

  async function loadCurrentAccount() {
    try {
      await accountStore.loadCurrent()
    } catch {
      notifyLauncherPopup({
        id: 'account-load-failed',
        title: t('game.status.accountLoadFailed'),
        content: `${t('game.status.accountLoadFailed')}，当前账户信息可能过期，请重新登录。`,
        level: 'warning',
        priority: 75,
      })
    }
  }

  function openAccountModal() {
    showAccountModal.value = true
    showAuthlibForm.value = false
    authlibServerUrl.value = ''
    authlibEmail.value = ''
    authlibPassword.value = ''
    loadAccounts()
    loadAuthlibServers()
    loadMicrosoftLoginConfig()
    loadAuthlibLoginConfig()
    loadOfflineSkins()
    loadPluginProviders()
    resetPluginForm()
  }

  async function addOfflineAccount() {
    const username = newOfflineUsername.value.trim()
    if (!username) {
      message.error(t('game.status.emptyUsername'))
      return
    }
    if (offlineUuidError.value) {
      message.error(offlineUuidError.value)
      return
    }

    addingOffline.value = true
    try {
      const customUuid = newOfflineUuid.value.trim() || undefined
      const skin = selectedOfflineSkinId.value || undefined
      await accountStore.addOffline(username, customUuid, skin)
      message.success(t('game.status.accountAdded'))
      newOfflineUsername.value = ''
      newOfflineUuid.value = ''
      selectedOfflineSkinId.value = ''
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.accountAddFailed'))
    } finally {
      addingOffline.value = false
    }
  }

  async function changeOfflineSkin(accountId: string, skinId: string) {
    try {
      await accountStore.setOfflineSkin(accountId, skinId || undefined)
      message.success(t('game.status.skinChanged'))
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.skinChangeFailed'))
    }
  }

  async function switchAccount(accountId: string) {
    try {
      await accountStore.switchAccount(accountId)
      message.success(t('game.status.accountSwitched'))
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.accountSwitchFailed'))
    }
  }

  function removeAccount(accountId: string, alias: string) {
    accountToDelete.value = { id: accountId, alias }
    showDeleteConfirmModal.value = true
  }

  async function confirmRemoveAccount() {
    if (!accountToDelete.value) return

    deletingAccount.value = true
    try {
      await accountStore.removeAccount(accountToDelete.value.id)
      message.success(t('game.status.accountRemoved'))
      showDeleteConfirmModal.value = false
      accountToDelete.value = null
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.accountRemoveFailed'))
    } finally {
      deletingAccount.value = false
    }
  }

  // ── Authlib ──

  async function loadAuthlibServers() {
    try {
      await accountStore.loadAuthlibServers()
      const recentLogin = authlibServers.value[0]
      if (!authlibServerUrl.value && recentLogin) authlibServerUrl.value = recentLogin.url
      if (!authlibEmail.value && recentLogin?.email) authlibEmail.value = recentLogin.email
    } catch {
      // 可选服务器列表失败时仍允许用户手动填写地址。
    }
  }

  function selectAuthlibServer(serverUrl: string) {
    const server = authlibServers.value.find((item) => item.url === serverUrl)
    if (server) authlibEmail.value = server.email
  }

  async function resolveAuthlibServer() {
    const inputUrl = authlibServerUrl.value.trim()
    const serverUrl = URL.canParse(inputUrl) ? inputUrl : `https://${inputUrl}`
    if (!URL.canParse(serverUrl)) return
    try {
      const resolvedUrl = await accountStore.resolveAuthlibServer(serverUrl)
      if (authlibServerUrl.value.trim() === inputUrl) authlibServerUrl.value = resolvedUrl
    } catch {
      return
    }
  }

  function toggleAuthlibForm() {
    showAuthlibForm.value = !showAuthlibForm.value
    if (showAuthlibForm.value && authlibServers.value.length === 0) {
      loadAuthlibServers()
    }
  }

  async function addAuthlibAccount() {
    const serverUrl = authlibServerUrl.value.trim()
    const email = authlibEmail.value.trim()
    const password = authlibPassword.value

    if (!serverUrl) {
      message.error(t('auth.serverUrlRequired'))
      return
    }
    if (!email) {
      message.error(t('auth.emailRequired'))
      return
    }
    if (!password) {
      message.error(t('auth.passwordRequired'))
      return
    }

    addingAuthlib.value = true
    try {
      const account = await accountStore.addAuthlib(serverUrl, email, password)
      if (account.auth_server) authlibServerUrl.value = account.auth_server
      authlibPassword.value = ''
      if (account.profile_selection_required && account.available_profiles?.length) {
        pendingAuthlibAccountId.value = account.id
        authlibProfiles.value = account.available_profiles
        selectedAuthlibProfileId.value = account.available_profiles[0]?.id ?? ''
        return
      }
      message.success(t('game.status.accountAdded'))
      showAuthlibForm.value = false
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.accountAddFailed'))
    } finally {
      addingAuthlib.value = false
    }
  }

  async function selectAuthlibProfile() {
    if (!pendingAuthlibAccountId.value || !selectedAuthlibProfileId.value) {
      message.error(t('auth.profileRequired'))
      return
    }
    selectingAuthlibProfile.value = true
    try {
      await accountStore.selectAuthlibProfile(pendingAuthlibAccountId.value, selectedAuthlibProfileId.value)
      pendingAuthlibAccountId.value = ''
      authlibProfiles.value = []
      selectedAuthlibProfileId.value = ''
      message.success(t('game.status.accountAdded'))
      showAuthlibForm.value = false
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.accountAddFailed'))
    } finally {
      selectingAuthlibProfile.value = false
    }
  }

  async function startMicrosoftLogin() {
    if (!microsoftLoginConfig.value.available || startingMicrosoftLogin.value) return
    startingMicrosoftLogin.value = true
    pendingMicrosoftLoginEvent = undefined
    microsoftLoginStage.value = 'waiting_authorization'
    let result: MicrosoftLoginData
    try {
      result = await accountStore.startMicrosoftLogin()
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.login.failed'))
      return
    } finally {
      startingMicrosoftLogin.value = false
    }
    if (result.needs_client_id) {
      microsoftLoginConfig.value = { available: false, needs_client_id: true }
      return
    }
    if (result.status === 'completed') {
      message.success(t('game.login.success'))
      return true
    }
    if (result.status === 'progress' || result.status === 'pending' || (result.verificationUri && result.userCode)) {
      microsoftLoginData.value = {
        userCode: result.userCode || '',
        verificationUri: result.verificationUri || '',
      }
      microsoftLoginStatus.value = result.status === 'progress' ? 'loading' : 'pending'
      microsoftLoginStage.value = result.stage || 'waiting_authorization'
      microsoftLoginError.value = ''
      showMicrosoftLoginModal.value = true
      if (pendingMicrosoftLoginEvent) {
        await handleMicrosoftLoginStatus(pendingMicrosoftLoginEvent)
        pendingMicrosoftLoginEvent = undefined
      }
      if (showMicrosoftLoginModal.value && microsoftLoginStatus.value === 'pending') void openMicrosoftLoginPage()
      return true
    }
    message.error(result.message || t('game.login.failed'))
  }

  async function completeMicrosoftLogin() {
    completingMicrosoftLogin.value = true
    microsoftLoginStatus.value = 'loading'
    try {
      const result = await accountStore.completeMicrosoftLogin()
      if (result.status === 'pending') {
        microsoftLoginStatus.value = 'pending'
        message.info(t('game.login.autoDetecting'))
        return
      }
      if (!result.account) throw new Error(result.message || t('game.login.failed'))
      message.success(t('game.login.success'))
      showMicrosoftLoginModal.value = false
    } catch (reason) {
      microsoftLoginStatus.value = 'error'
      microsoftLoginError.value = reason instanceof Error ? reason.message : t('game.login.failed')
      message.error(microsoftLoginError.value)
    } finally {
      completingMicrosoftLogin.value = false
    }
  }

  async function cancelMicrosoftLogin() {
    showMicrosoftLoginModal.value = false
    microsoftLoginStatus.value = 'pending'
    microsoftLoginStage.value = 'waiting_authorization'
    microsoftLoginError.value = ''
    try {
      await accountStore.cancelMicrosoftLogin()
    } catch (reason) {
      console.warn('[MicrosoftLogin] 取消登录失败:', reason)
    }
  }

  async function loadMicrosoftLoginConfig() {
    try {
      await accountStore.loadMicrosoftLoginConfig()
    } catch {
      return
    }
  }

  async function loadAuthlibLoginConfig() {
    try {
      await accountStore.loadAuthlibLoginConfig()
    } catch {
      return
    }
  }

  async function copyUserCode() {
    await copyToClipboard(microsoftLoginData.value.userCode || '')
  }

  async function openMicrosoftLoginPage() {
    const verificationUri = microsoftLoginData.value.verificationUri
    const userCode = microsoftLoginData.value.userCode
    if (!verificationUri) return
    // 先复制授权码，稍作延迟再拉起浏览器，避免弹窗尚未呈现即被切换窗口。
    await copyUserCode()
    await new Promise((resolve) => setTimeout(resolve, 2000))
    if (
      !showMicrosoftLoginModal.value ||
      microsoftLoginStatus.value !== 'pending' ||
      microsoftLoginData.value.userCode !== userCode ||
      microsoftLoginData.value.verificationUri !== verificationUri
    )
      return
    await openExternalUrl(verificationUri)
  }

  async function handleMicrosoftLoginStatus(event: MicrosoftLoginStatusEvent) {
    if (startingMicrosoftLogin.value && !showMicrosoftLoginModal.value) {
      pendingMicrosoftLoginEvent = event
      return
    }
    if (event.status === 'cancelled') {
      showMicrosoftLoginModal.value = false
      microsoftLoginStatus.value = 'pending'
      microsoftLoginError.value = ''
      microsoftLoginStage.value = 'waiting_authorization'
      return
    }
    if (!showMicrosoftLoginModal.value) return
    if (event.status === 'error') {
      microsoftLoginStatus.value = 'error'
      microsoftLoginError.value = event.message || t('game.login.failed')
      message.error(microsoftLoginError.value)
      return
    }
    if (event.status === 'progress' && event.stage) {
      microsoftLoginStage.value = event.stage
      microsoftLoginStatus.value = 'loading'
      return
    }
    if (event.status === 'ready' && !completingFromEvent) {
      microsoftLoginStage.value = 'completed'
      completingFromEvent = true
      try {
        await completeMicrosoftLogin()
      } finally {
        completingFromEvent = false
      }
    }
  }

  async function toggleFavorite(accountId: string) {
    if (!accountId) return
    const account = accounts.value.find((a) => a.id === accountId)
    if (!account) return
    try {
      await accountStore.setFavorite(accountId, !account.favorite)
      message.success(account.favorite ? t('game.status.favoriteRemoved') : t('game.status.favoriteAdded'))
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.favoriteFailed'))
    }
  }

  async function togglePinned(accountId: string) {
    if (!accountId) return
    const account = accounts.value.find((a) => a.id === accountId)
    if (!account) return
    try {
      await accountStore.setPinned(accountId, !account.pinned)
      message.success(account.pinned ? t('game.status.pinRemoved') : t('game.status.pinAdded'))
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : t('game.status.pinFailed'))
    }
  }

  function reset() {
    const shouldCancelMicrosoftLogin =
      showMicrosoftLoginModal.value || startingMicrosoftLogin.value || completingMicrosoftLogin.value
    showAccountModal.value = false
    showMicrosoftLoginModal.value = false
    showDeleteConfirmModal.value = false
    resetPluginForm()
    stopMicrosoftLoginStatusListener()
    if (shouldCancelMicrosoftLogin) {
      void accountStore.cancelMicrosoftLogin().catch((reason) => {
        console.warn('[MicrosoftLogin] 页面卸载时取消登录失败:', reason)
      })
    }
  }

  return reactive({
    accounts,
    currentAccount,
    accountsLoading,
    accountTypeLabel,
    showAccountModal,
    newOfflineUsername,
    newOfflineUuid,
    offlineUuidError,
    addingOffline,
    offlineSkins,
    offlineSkinsLoading,
    offlineSkinOptions,
    selectedOfflineSkinId,
    loadOfflineSkins,
    // Authlib
    showAuthlibForm,
    authlibServerUrl,
    authlibEmail,
    authlibPassword,
    addingAuthlib,
    pendingAuthlibAccountId,
    authlibProfiles,
    authlibProfileOptions,
    selectedAuthlibProfileId,
    selectingAuthlibProfile,
    authlibServers,
    authlibServerOptions,
    renderAuthlibServerOption,
    authlibServersLoading,
    loadAuthlibServers,
    selectAuthlibServer,
    resolveAuthlibServer,
    toggleAuthlibForm,
    addAuthlibAccount,
    selectAuthlibProfile,
    // 插件认证提供方
    authProviders,
    pluginFieldValues,
    addingPluginAccount,
    pluginProviderById,
    loadPluginProviders,
    addPluginAccount,
    resetPluginForm,
    // Microsoft
    showMicrosoftLoginModal,
    startingMicrosoftLogin,
    completingMicrosoftLogin,
    microsoftLoginStatus,
    microsoftLoginStage,
    microsoftLoginData,
    microsoftLoginError,
    microsoftLoginConfig,
    isMicrosoftLoginConfigLoading,
    authlibLoginConfig,
    isAuthlibLoginConfigLoading,
    copiedUserCode,
    showDeleteConfirmModal,
    deletingAccount,
    accountToDelete,
    deleteConfirmMessage,
    loadAccounts,
    loadCurrentAccount,
    loadMicrosoftLoginConfig,
    loadAuthlibLoginConfig,
    openAccountModal,
    addOfflineAccount,
    changeOfflineSkin,
    switchAccount,
    removeAccount,
    confirmRemoveAccount,
    startMicrosoftLogin,
    cancelMicrosoftLogin,
    completeMicrosoftLogin,
    copyUserCode,
    openMicrosoftLoginPage,
    toggleFavorite,
    togglePinned,
    reset,
  })
}
