<template>
  <div class="game-page">
    <div class="game-left">
      <PluginSlotHost slotId="plugin-slot-game-left" class="plugin-slot-container" />
      <button
        class="running-instances-trigger"
        :class="{ inactive: runningInstanceCount === 0 }"
        type="button"
        :title="t('versions.runningManagement')"
        @click="openRunningInstances"
      >
        <UiIcon name="power" :size="20" />
        <span class="trigger-label">{{ t('versions.runningManagement') }}</span>
      </button>
    </div>

    <div class="game-right">
      <PluginSlotHost slotId="plugin-slot-game-right-top" class="plugin-slot-container" />
      <Transition name="slide-out" mode="out-in">
        <div v-if="!launchProgress.visible" key="cards" class="game-right-cards">
          <GameAccountCard
            :account="account.currentAccount"
            :accounts="account.accounts"
            :accountTypeLabel="account.accountTypeLabel"
            :loading="account.accountsLoading"
            @manage="account.openAccountModal"
            @switch="account.switchAccount"
          />
          <GameInfoCard
            :data="infoCardData"
            :view="infoCardMode"
            :isWelcome="isWelcome"
            :currentTip="currentTip"
            :currentAnnouncement="currentAnnouncement"
            :hasAnnouncements="hasAnnouncements"
            :canToggle="canToggleInfoCard"
            @toggle="toggleInfoCard"
            @mouseenter="pauseInfoCardRotation"
            @mouseleave="resumeInfoCardRotation"
          />
        </div>
        <LaunchProgressCard
          v-else
          key="progress"
          :title="lpState.title"
          :versionName="lpState.versionName"
          :displayPercent="lpState.displayPercent"
          :stage="launchProgress.stage"
          :message="launchProgress.message"
          :cancelable="launchProgress.cancelable"
          :visual="launchVersionVisual"
          @cancel="handleLaunchProgressCancel"
        />
      </Transition>

      <GameLaunchBar
        v-if="!launchProgress.visible && hasGamePath"
        :versionsCount="version.versions.length"
        :launching="version.launching"
        :selectedVersion="version.selectedVersion"
        :currentGamePath="version.currentGamePath"
        :hasAccount="Boolean(account.currentAccount)"
        :recentInstances="recentList"
        :javaRecoveryMessage="version.javaRecoveryMessage"
        :isRescanningJava="version.isRescanningJava"
        @rescanJava="version.rescanJava"
        @selectJava="openVersionSettings"
        @launch="handleLaunch"
        @manageVersions="goToInstallVersion"
        @versionSettings="openVersionSettings"
        @selectVersion="handleSelectVersion"
        @togglePin="handleTogglePinRecent"
        @removeRecent="handleRemoveRecentItem"
      />
    </div>

    <FullscreenModal
      v-model:visible="showRunningInstances"
      :title="runningModalTitle"
      :showFooter="false"
      bodyClass="running-instances-modal-body"
    >
      <Transition name="page" mode="out-in">
        <RunningInstancesTab
          v-if="showRunningInstances && runningView === 'management'"
          key="management"
          @openTerminal="openInstanceTerminal"
        />
        <InstanceTerminalModule v-else-if="showRunningInstances" key="terminal" @back="closeInstanceTerminal" />
      </Transition>
    </FullscreenModal>

    <FullscreenModal
      ref="accountModalRef"
      v-model:visible="account.showAccountModal"
      :title="t('game.accountManagement')"
      :showFooter="false"
      bodyClass="account-modal-body"
    >
      <div class="account-container">
        <section class="account-list-panel ecl-surface">
          <div class="account-panel-header">
            <div class="account-panel-heading">
              <UiIcon name="users" :size="16" />
              <span>{{ t('game.savedAccounts') }}</span>
              <NTag v-if="account.accounts.length" size="small" :bordered="false">
                {{ account.accounts.length }}
              </NTag>
            </div>
            <div class="account-panel-actions">
              <NButton size="small" @click="openWardrobeModal">
                <template #icon><UiIcon name="shirt" :size="14" /></template>
                {{ t('wardrobe.title') }}
              </NButton>
              <NButton type="primary" size="small" @click="openAddAccountModal">
                <template #icon><UiIcon name="add" :size="14" /></template>
                {{ t('game.addAccount') }}
              </NButton>
            </div>
          </div>

          <div class="account-table-header">
            <span>{{ t('game.username') }}</span>
            <span>{{ t('game.accountType') }}</span>
            <span>{{ t('plugins.status') }}</span>
            <span></span>
          </div>

          <UiLoading :show="account.accountsLoading" mode="overlay" class="account-list-spin">
            <div v-if="account.accounts.length" class="account-list">
              <div v-for="savedAccount in account.accounts" :key="savedAccount.id" class="account-row">
                <div class="account-identity">
                  <AvatarRenderer
                    :uuid="savedAccount.uuid"
                    :username="savedAccount.alias"
                    :typeName="savedAccount.type"
                    :skinUrl="savedAccount.skinUrl"
                    :accountId="savedAccount.id"
                    :size="32"
                  />
                  <div class="account-primary">
                    <span class="account-name">{{ savedAccount.alias }}</span>
                    <span v-if="savedAccount.email" class="account-secondary">{{ savedAccount.email }}</span>
                    <span v-if="savedAccount.auth_server" class="account-server" :title="savedAccount.auth_server">
                      {{ savedAccount.auth_server }}
                    </span>
                  </div>
                </div>

                <div class="account-type-cell">
                  <NTag size="small" :bordered="false">
                    {{ accountTypeName(savedAccount.type) }}
                  </NTag>
                </div>

                <div class="account-status-cell">
                  <NTag v-if="savedAccount.isCurrent" size="small" type="success">
                    {{ t('game.current') }}
                  </NTag>
                  <NButton v-else quaternary size="tiny" @click="account.switchAccount(savedAccount.id)">
                    {{ t('game.switch') }}
                  </NButton>
                </div>

                <div class="account-actions">
                  <button
                    class="account-action-btn"
                    :title="t('game.accountDetails')"
                    @click="openAccountDetails(savedAccount)"
                  >
                    <UiIcon name="info" :size="14" />
                  </button>

                  <button
                    class="account-action-btn"
                    :class="{ active: savedAccount.favorite }"
                    :title="savedAccount.favorite ? t('game.status.favoriteRemoved') : t('game.status.favoriteAdded')"
                    @click="account.toggleFavorite(savedAccount.id)"
                  >
                    <UiIcon :name="savedAccount.favorite ? 'star-filled' : 'star'" :size="14" />
                  </button>

                  <button
                    class="account-action-btn"
                    :class="{ active: savedAccount.pinned }"
                    :title="savedAccount.pinned ? t('game.status.pinRemoved') : t('game.status.pinAdded')"
                    @click="account.togglePinned(savedAccount.id)"
                  >
                    <UiIcon name="pin" :size="14" />
                  </button>

                  <NPopselect
                    v-if="savedAccount.type === 'offline'"
                    :value="savedAccount.skinId || null"
                    :options="account.offlineSkinOptions"
                    trigger="click"
                    :onUpdateValue="(value) => account.changeOfflineSkin(savedAccount.id, String(value ?? ''))"
                  >
                    <button
                      class="account-action-btn"
                      :class="{ active: !!savedAccount.skinId }"
                      :title="t('game.changeSkin')"
                    >
                      <UiIcon name="shirt" :size="14" />
                    </button>
                  </NPopselect>

                  <NButton
                    class="account-delete"
                    quaternary
                    size="tiny"
                    type="error"
                    :title="t('app.delete')"
                    @click="account.removeAccount(savedAccount.id, savedAccount.alias)"
                  >
                    <template #icon><UiIcon name="delete" :size="13" /></template>
                  </NButton>
                </div>
              </div>
            </div>
            <NEmpty v-else class="account-empty" :description="t('game.noAccounts')" />
          </UiLoading>
        </section>

        <Modal
          v-model:visible="showAddAccountModal"
          :title="t('game.addAccount')"
          :showFooter="false"
          bodyClass="account-add-modal-body"
          width="480px"
        >
          <div class="account-add-body">
            <NAlert
              v-if="isShowcaseMode"
              class="showcase-account-warning"
              type="warning"
              :title="t('game.showcase.title')"
            >
              {{ t('game.showcase.description') }}
            </NAlert>
            <NTabs
              v-if="isFolia"
              v-model:value="selectedAccountType"
              type="segment"
              size="small"
              class="account-type-switch"
            >
              <NTab v-for="option in accountTypeOptions" :key="option.value" :name="option.value">
                {{ option.label }}
              </NTab>
            </NTabs>
            <NRadioGroup v-else v-model:value="selectedAccountType" class="account-type-switch" size="small">
              <NRadioButton v-for="option in accountTypeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </NRadioButton>
            </NRadioGroup>

            <!--<div class="account-type-intro">
              <div class="account-type-icon">
                <UiIcon :name="selectedAccountMeta.icon" :size="18" />
              </div>
              <div>
                <strong>{{ selectedAccountMeta.label }}</strong>
                <p>{{ selectedAccountMeta.description }}</p>
              </div>
            </div>-->

            <div v-if="selectedAccountType === 'microsoft'" class="account-form">
              <NAlert
                v-if="account.microsoftLoginConfig.needs_client_id"
                class="microsoft-client-id-alert"
                type="warning"
                :title="t('game.clientId.title')"
              >
                <p>{{ t('game.clientId.description') }}</p>
                <p>{{ t('game.clientId.fileHint') }}</p>
                <code class="microsoft-client-id-value">MICROSOFT_CLIENT_ID=your_client_id_here</code>
              </NAlert>
              <NButton
                type="primary"
                block
                :loading="account.startingMicrosoftLogin || account.isMicrosoftLoginConfigLoading"
                :disabled="!account.microsoftLoginConfig.available"
                @click="startMicrosoftFromAddModal"
              >
                <template #icon><UiIcon name="microsoft" :size="15" /></template>
                {{ t('game.continueMicrosoftLogin') }}
              </NButton>
            </div>

            <div v-else-if="selectedAccountType === 'offline'" class="account-form">
              <NInput
                v-model:value="account.newOfflineUsername"
                :placeholder="t('game.enterUsername')"
                @keyup.enter="addOfflineFromModal"
              />
              <div v-if="account.offlineSkinOptions.length" class="offline-skin-field">
                <label for="offline-skin-select">{{ t('game.offlineSkinLabel') }}</label>
                <NSelect
                  id="offline-skin-select"
                  v-model:value="account.selectedOfflineSkinId"
                  :options="account.offlineSkinOptions"
                  :placeholder="t('game.offlineSkinPlaceholder')"
                  size="small"
                  clearable
                  :loading="account.offlineSkinsLoading"
                />
              </div>
              <button
                type="button"
                class="offline-advanced-toggle"
                :class="{ expanded: showOfflineAdvanced }"
                :aria-expanded="showOfflineAdvanced"
                @click="showOfflineAdvanced = !showOfflineAdvanced"
              >
                <span>{{ t('game.advancedOptions') }}</span>
                <UiIcon name="chevron-down" :size="16" />
              </button>
              <Transition name="offline-advanced">
                <div v-if="showOfflineAdvanced" class="offline-advanced-panel">
                  <label for="offline-custom-uuid">{{ t('game.customUuid') }}</label>
                  <NInput
                    id="offline-custom-uuid"
                    v-model:value="account.newOfflineUuid"
                    :placeholder="t('game.customUuidPlaceholder')"
                    :status="account.offlineUuidError ? 'error' : undefined"
                    @keyup.enter="addOfflineFromModal"
                  />
                  <small :class="{ error: account.offlineUuidError }">
                    {{ account.offlineUuidError || t('game.customUuidHint') }}
                  </small>
                </div>
              </Transition>
              <!--<NAlert type="default" :showIcon="false">{{ t('game.offlineNoPassword') }}</NAlert>-->
              <NButton
                type="primary"
                block
                :loading="account.addingOffline"
                :disabled="!account.newOfflineUsername.trim() || !!account.offlineUuidError"
                @click="addOfflineFromModal"
              >
                {{ t('game.addOfflineAccount') }}
              </NButton>
            </div>

            <div v-else-if="account.pendingAuthlibAccountId" class="account-form">
              <NAlert type="info" :showIcon="false">{{ t('auth.selectProfileHint') }}</NAlert>
              <NSelect
                v-model:value="account.selectedAuthlibProfileId"
                :options="account.authlibProfileOptions"
                :renderLabel="renderAuthlibProfileLabel"
                :placeholder="t('auth.profilePlaceholder')"
              />
              <NButton
                type="primary"
                block
                :loading="account.selectingAuthlibProfile"
                :disabled="!account.selectedAuthlibProfileId"
                @click="selectAuthlibProfileFromModal"
              >
                {{ t('auth.loginSelectedProfile') }}
              </NButton>
            </div>

            <div v-else-if="selectedPluginProvider" class="account-form">
              <NAlert v-if="selectedPluginProvider.description" type="default" :showIcon="false">
                {{ selectedPluginProvider.description }}
              </NAlert>
              <div v-for="field in selectedPluginProvider.fields" :key="field.key" class="plugin-auth-field">
                <label :for="`plugin-field-${field.key}`">{{ field.label }}</label>
                <NInput
                  :id="`plugin-field-${field.key}`"
                  v-model:value="account.pluginFieldValues[field.key]"
                  :type="field.type === 'password' ? 'password' : 'text'"
                  :placeholder="field.placeholder"
                  :showPasswordOn="field.type === 'password' ? 'mousedown' : undefined"
                  @keyup.enter="addPluginAccountFromModal"
                />
              </div>
              <NButton
                type="primary"
                block
                :loading="account.addingPluginAccount"
                :disabled="
                  !selectedPluginProvider.fields.every(
                    (field) => !field.required || (account.pluginFieldValues[field.key] ?? '').trim()
                  )
                "
                @click="addPluginAccountFromModal"
              >
                {{ t('game.addAccount') }}
              </NButton>
            </div>

            <div v-else class="account-form">
              <NAutoComplete
                v-model:value="account.authlibServerUrl"
                :options="account.authlibServerOptions"
                :renderLabel="account.renderAuthlibServerOption"
                :placeholder="t('auth.serverUrlPlaceholder')"
                clearable
                @select="account.selectAuthlibServer"
                @blur="account.resolveAuthlibServer"
              />
              <NInput
                v-model:value="account.authlibEmail"
                :placeholder="t('auth.emailPlaceholder')"
                @keyup.enter="addAuthlibFromModal"
              />
              <NInput
                v-model:value="account.authlibPassword"
                type="password"
                showPasswordOn="mousedown"
                :placeholder="t('auth.passwordPlaceholder')"
                @keyup.enter="addAuthlibFromModal"
              />
              <small class="authlib-server-hint">{{ t('auth.serverUrlHint') }}</small>
              <NAlert
                v-if="!account.authlibLoginConfig.available"
                class="authlib-unavailable-alert"
                type="warning"
                :showIcon="true"
              >
                {{ t('auth.authlibUnavailable') }}
              </NAlert>
              <NButton
                type="primary"
                block
                :loading="account.addingAuthlib"
                :disabled="
                  !account.authlibLoginConfig.available ||
                  !account.authlibServerUrl.trim() ||
                  !account.authlibEmail.trim() ||
                  !account.authlibPassword
                "
                @click="addAuthlibFromModal"
              >
                {{ t('auth.addAuthlibAccount') }}
              </NButton>
            </div>
          </div>
        </Modal>

        <Modal
          v-model:visible="showAccountDetailsModal"
          :title="t('game.accountDetails')"
          :showFooter="false"
          bodyClass="account-details-modal-body"
          width="420px"
        >
          <div v-if="detailAccount" class="account-details-body">
            <div class="account-details-header">
              <AvatarRenderer
                :uuid="detailAccount.uuid"
                :username="detailAccount.alias"
                :typeName="detailAccount.type"
                :skinUrl="detailAccount.skinUrl"
                :accountId="detailAccount.id"
                :size="56"
              />
              <div class="account-details-heading">
                <strong class="account-details-name">{{ detailAccount.alias }}</strong>
                <span v-if="detailAccount.email" class="account-details-email">{{ detailAccount.email }}</span>
              </div>
            </div>
            <div class="account-details-grid">
              <div class="account-detail-item">
                <span class="account-detail-label">{{ t('game.accountType') }}</span>
                <span class="account-detail-value">{{ accountTypeName(detailAccount.type) }}</span>
              </div>
              <div v-if="detailTextures?.skinModel" class="account-detail-item">
                <span class="account-detail-label">{{ t('game.skinType') }}</span>
                <span class="account-detail-value">{{ t(`wardrobe.${detailTextures.skinModel}`) }}</span>
              </div>
              <div v-if="activeCapeName" class="account-detail-item">
                <span class="account-detail-label">{{ t('game.capeName') }}</span>
                <span class="account-detail-value">{{ activeCapeName }}</span>
              </div>
              <div v-if="detailAccount.uuid" class="account-detail-item">
                <span class="account-detail-label">UUID</span>
                <span class="account-detail-value account-detail-mono">{{ detailAccount.uuid }}</span>
              </div>
              <div v-if="detailAccount.auth_server" class="account-detail-item">
                <span class="account-detail-label">{{ t('game.authServer') }}</span>
                <span class="account-detail-value">{{ detailAccount.auth_server }}</span>
              </div>
              <div class="account-detail-item">
                <span class="account-detail-label">{{ t('game.accountStatus') }}</span>
                <span class="account-detail-value account-detail-tags">
                  <NTag v-if="detailAccount.isCurrent" size="small" type="success" :bordered="false">
                    {{ t('game.current') }}
                  </NTag>
                  <NTag v-if="detailAccount.favorite" size="small" type="warning" :bordered="false">
                    {{ t('game.favorite') }}
                  </NTag>
                  <NTag v-if="detailAccount.pinned" size="small" :bordered="false">
                    {{ t('game.pinned') }}
                  </NTag>
                </span>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </FullscreenModal>

    <WardrobeModal
      v-model:visible="showWardrobeModal"
      :accounts="account.accounts"
      :currentAccount="account.currentAccount"
      @back="returnToAccountManagement"
      @accountsChanged="account.loadAccounts(true)"
    />

    <MicrosoftLoginModal
      :visible="account.showMicrosoftLoginModal"
      :parentId="accountModalRef?.modalId"
      :status="account.microsoftLoginStatus"
      :stage="account.microsoftLoginStage"
      :userCode="account.microsoftLoginData.userCode || ''"
      :verificationUri="account.microsoftLoginData.verificationUri || ''"
      :copied="account.copiedUserCode"
      :error="account.microsoftLoginError"
      @cancel="account.cancelMicrosoftLogin"
      @copyCode="account.copyUserCode"
      @openBrowser="account.openMicrosoftLoginPage"
    />

    <ConfirmDialog
      v-model:visible="account.showDeleteConfirmModal"
      :parentId="accountModalRef?.modalId"
      :title="t('common.confirm')"
      :content="account.deleteConfirmMessage"
      :confirmText="t('common.delete')"
      :loading="account.deletingAccount"
      :closeOnConfirm="false"
      danger
      @confirm="account.confirmRemoveAccount"
    />
  </div>
</template>

<script setup lang="ts">
import {
  NAlert,
  NAutoComplete,
  NButton,
  NEmpty,
  NInput,
  NPopselect,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NTab,
  NTabs,
  NTag,
  type SelectOption,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import backend from '@/api/client'
import AvatarRenderer from '@/components/game/AvatarRenderer.vue'
import GameAccountCard from '@/components/game/GameAccountCard.vue'
import GameInfoCard from '@/components/game/GameInfoCard.vue'
import GameLaunchBar from '@/components/game/GameLaunchBar.vue'
import LaunchProgressCard from '@/components/game/LaunchProgressCard.vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useAccountManager } from '@/composables/useAccountManager'
import { useInstanceManager } from '@/composables/useInstanceManager'
import { globalLaunchProgress } from '@/composables/useLaunchProgress'
import { useRecentInstances, type RecentInstance } from '@/composables/useRecentInstances'
import { useUiSkin } from '@/composables/useUiSkin'
import { getLoaderIcon, getLoaderImage, getVersionImage } from '@/config/version'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import MicrosoftLoginModal from '@/features/accounts/components/MicrosoftLoginModal.vue'
import WardrobeModal from '@/features/accounts/components/WardrobeModal.vue'
import { useGameInfoCard } from '@/features/game-home/composables/useGameInfoCard'
import { useGameHomeStore } from '@/features/game-home/stores/gameHomeStore'
import { instanceRuntimeApi } from '@/features/instances/api/instanceRuntimeApi'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import InstanceTerminalModule from '@/features/terminal/components/InstanceTerminalModule.vue'
import type { AccountTextures, MinecraftAccount } from '@/types/accounts'
import { getAccountTypeLabelKey, getAccountTypeShortLabelKey } from '@/utils/enums'
import RunningInstancesTab from '@/views/instances/RunningInstancesTab.vue'

const { t } = useI18n()
const router = useRouter()
const account = useAccountManager(t)
const { isFolia } = useUiSkin()
const version = useInstanceManager(t)
const { recentList, togglePin, removeRecent } = useRecentInstances()
const { progress: launchProgress, smoothPercent } = globalLaunchProgress
const gameHomeStore = useGameHomeStore()
const { hasGamePath } = storeToRefs(gameHomeStore)
const {
  infoCardData,
  infoCardMode,
  isWelcome,
  hasAnnouncements,
  currentTip,
  currentAnnouncement,
  canToggleInfoCard,
  start: startInfoCard,
  stop: stopInfoCard,
  toggle: toggleInfoCard,
  pauseRotation: pauseInfoCardRotation,
  resumeRotation: resumeInfoCardRotation,
} = useGameInfoCard()

const showAddAccountModal = ref(false)
const accountModalRef = ref<InstanceType<typeof FullscreenModal> | null>(null)
const showWardrobeModal = ref(false)
const showRunningInstances = ref(false)
const showAccountDetailsModal = ref(false)
const detailAccount = ref<MinecraftAccount | null>(null)
const detailTextures = ref<AccountTextures | null>(null)
const runningView = ref<'management' | 'terminal'>('management')
const runningInstanceCount = ref(0)
let stopListeningForRunningInstances: (() => void) | null = null
let returningFromWardrobe = false

const runningModalTitle = computed(() =>
  runningView.value === 'terminal'
    ? `${t('versions.running.terminal')} · ${t('versions.runningTab')}`
    : t('versions.runningTab')
)

function openRunningInstances(): void {
  runningView.value = 'management'
  showRunningInstances.value = true
}

function openInstanceTerminal(): void {
  runningView.value = 'terminal'
}

function closeInstanceTerminal(): void {
  runningView.value = 'management'
}

const selectedAccountType = ref<string>('microsoft')
const showOfflineAdvanced = ref(false)
const isShowcaseMode = backend.runtime.isShowcase
const accountTypeOptions = computed(() => [
  { value: 'microsoft', label: t(getAccountTypeLabelKey('microsoft')) },
  { value: 'offline', label: t(getAccountTypeLabelKey('offline')) },
  { value: 'authlib', label: t(getAccountTypeLabelKey('authlib')) },
  ...account.authProviders.map((provider) => ({ value: `plugin:${provider.id}`, label: provider.title })),
])
const selectedPluginProvider = computed(() => {
  if (!selectedAccountType.value.startsWith('plugin:')) return null
  return account.pluginProviderById(selectedAccountType.value.slice('plugin:'.length))
})
function renderAuthlibProfileLabel(option: SelectOption) {
  return h('div', { class: 'authlib-profile-option-label' }, [
    h('span', String(option.profileName ?? option.label ?? '')),
    option.loggedIn
      ? h(NTag, { size: 'small', type: 'success', bordered: false }, { default: () => t('auth.loggedIn') })
      : null,
  ])
}

function openAddAccountModal() {
  selectedAccountType.value = account.pendingAuthlibAccountId ? 'authlib' : 'microsoft'
  showOfflineAdvanced.value = false
  account.newOfflineUuid = ''
  account.selectedOfflineSkinId = ''
  showAddAccountModal.value = true
  void account.loadMicrosoftLoginConfig()
  void account.loadAuthlibServers()
  account.loadOfflineSkins()
}

function openWardrobeModal() {
  returningFromWardrobe = false
  showWardrobeModal.value = true
}

const activeCapeName = computed(() => {
  const cape = detailAccount.value?.capes?.find((candidate) => candidate.state.toUpperCase() === 'ACTIVE')
  return cape?.name || cape?.id || ''
})

async function openAccountDetails(account: MinecraftAccount): Promise<void> {
  detailAccount.value = account
  detailTextures.value = null
  showAccountDetailsModal.value = true
  try {
    detailTextures.value = await accountsApi.textureUrls(account.id)
  } catch {
    // 材质读取失败时仍可查看基础账户信息
  }
}

async function returnToAccountManagement() {
  if (returningFromWardrobe) return
  returningFromWardrobe = true
  showWardrobeModal.value = false
  await nextTick()
  account.openAccountModal()
  returningFromWardrobe = false
}

async function startMicrosoftFromAddModal() {
  const started = await account.startMicrosoftLogin()
  if (started) showAddAccountModal.value = false
}

async function addOfflineFromModal() {
  const accountCount = account.accounts.length
  await account.addOfflineAccount()
  if (account.accounts.length > accountCount) showAddAccountModal.value = false
}

async function addAuthlibFromModal() {
  const accountCount = account.accounts.length
  await account.addAuthlibAccount()
  if (account.accounts.length > accountCount) showAddAccountModal.value = false
}

async function selectAuthlibProfileFromModal() {
  await account.selectAuthlibProfile()
  if (!account.pendingAuthlibAccountId) showAddAccountModal.value = false
}

async function addPluginAccountFromModal() {
  if (!selectedPluginProvider.value) return
  const accountCount = account.accounts.length
  await account.addPluginAccount(selectedPluginProvider.value)
  if (account.accounts.length > accountCount) showAddAccountModal.value = false
}

function accountTypeName(type: string): string {
  if (type === 'plugin') return detailAccount.value?.providerTitle || t('game.pluginAccount')
  return t(getAccountTypeShortLabelKey(type))
}

// 启动成功的阶段 key 集合（'launched' 是 useInstanceManager 成功路径写入的 stage）。
const LAUNCH_SUCCESS_STAGES = new Set(['completed', 'launched', 'success'])

const lpState = computed(() => {
  const stage = launchProgress.value.stage
  const completed = LAUNCH_SUCCESS_STAGES.has(stage)
  return {
    title: completed ? '已启动' : '正在启动',
    versionName: version.selectedVersion || '',
    displayPercent: smoothPercent.value,
  }
})

const launchVersionVisual = computed(() => {
  const selected = version.versions.find((item) => item.id === version.selectedVersion)
  const loaderImage = getLoaderImage(selected?.type)
  if (loaderImage) return { image: loaderImage, icon: '' }
  const versionTypeImage = getVersionImage(selected?.versionType)
  if (versionTypeImage) return { image: versionTypeImage, icon: '' }
  return { image: '', icon: getLoaderIcon(selected?.type) }
})

const launchCancelTimer = ref<ReturnType<typeof setTimeout> | null>(null)

async function handleLaunchProgressCancel() {
  globalLaunchProgress.cancel()
  try {
    await gameHomeStore.cancelLaunch()
  } catch (error) {
    console.warn('[LaunchCancel] 取消请求异常:', error)
  }
  launchCancelTimer.value = setTimeout(() => {
    if (version.launching) version.launching = false
    launchCancelTimer.value = null
  }, 5000)
}

function openVersionSettings() {
  if (!version.selectedVersion) return
  const query: Record<string, string> = {
    version: version.selectedVersion,
    tab: 'settings',
  }
  if (version.currentGamePath) query.gamePath = version.currentGamePath
  void router.push({ name: 'versions-manage', query })
}

function handleLaunch() {
  // "最近启动"由启动成功事件写入（useInstanceManager），启动失败/取消不再留下记录
  version.launchGame(account.currentAccount)
}

function handleSelectVersion(versionId: string, gamePath?: string) {
  version.selectVersion(versionId, gamePath)
}

function handleTogglePinRecent(item: RecentInstance) {
  togglePin(item.versionId, item.gamePath)
}

function handleRemoveRecentItem(item: RecentInstance) {
  removeRecent(item.versionId, item.gamePath)
}

function goToInstallVersion() {
  void router.push({ name: 'versions-manage' })
}

async function refreshRunningInstanceCount() {
  try {
    const instances = await instanceRuntimeApi.list()
    runningInstanceCount.value = instances.filter((instance) => instance.isRunning).length
  } catch (error) {
    console.warn('[GameHome] 读取运行实例数量失败:', error)
  }
}

// 启动流程结束后主动刷新一次数量，避免事件延迟导致按钮状态不及时
watch(
  () => launchProgress.value.visible,
  (visible, prev) => {
    if (prev && !visible) void refreshRunningInstanceCount()
  }
)

onMounted(() => {
  version.loadVersions()
  account.loadAccounts()
  stopListeningForRunningInstances = instanceRuntimeApi.onChanged(() => {
    void refreshRunningInstanceCount()
  })
  void refreshRunningInstanceCount()
  startInfoCard().catch((error) => {
    console.warn('[GameHome] 加载首页数据失败:', error)
  })
})

onBeforeUnmount(() => {
  account.reset()
  stopInfoCard()
  stopListeningForRunningInstances?.()
  stopListeningForRunningInstances = null
  if (launchCancelTimer.value) clearTimeout(launchCancelTimer.value)
})
</script>

<style scoped src="@/styles/views/Game.css"></style>
