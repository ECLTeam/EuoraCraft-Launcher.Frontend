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
        @downloadJava="openJavaRecovery"
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

        <AddAccountModal
          v-model:visible="showAddAccountModal"
          :account="account"
          :parentId="accountModalRef?.modalId"
        />

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
              <div class="account-detail-item">
                <span class="account-detail-label">{{ t('accountLocator.label') }}</span>
                <AccountLocatorColor :uuid="detailAccount.uuid" />
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

    <JavaManagerModal
      v-model:visible="javaManagerVisible"
      initialView="download"
      :requiredMajor="javaTarget?.requiredJava"
      :gamePath="javaTarget?.path"
      :versionId="javaTarget?.versionId"
      :scopeKey="javaTarget?.instanceKey || ''"
      @selected="applyRecoveryJava"
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
import { NButton, NEmpty, NPopselect, NTag } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import { fetchAccountTextures } from '@/composables/useAvatarRenderer'
import { useInstanceManager } from '@/composables/useInstanceManager'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { globalLaunchProgress } from '@/composables/useLaunchProgress'
import { useRecentInstances, type RecentInstance } from '@/composables/useRecentInstances'
import { getLoaderIcon, getLoaderImage, getVersionImage } from '@/config/version'
import AccountLocatorColor from '@/features/accounts/components/AccountLocatorColor.vue'
import AddAccountModal from '@/features/accounts/components/AddAccountModal.vue'
import WardrobeModal from '@/features/accounts/components/WardrobeModal.vue'
import { useGameInfoCard } from '@/features/game-home/composables/useGameInfoCard'
import { useGameHomeStore } from '@/features/game-home/stores/gameHomeStore'
import { instanceRuntimeApi } from '@/features/instances/api/instanceRuntimeApi'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { useJavaForInstance } from '@/features/java/api/javaPreferences'
import JavaManagerModal from '@/features/java/components/JavaManagerModal.vue'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import InstanceTerminalModule from '@/features/terminal/components/InstanceTerminalModule.vue'
import type { AccountTextures, MinecraftAccount } from '@/types/accounts'
import type { ScannedVersion } from '@/types/instances'
import type { JavaRuntime } from '@/types/java'
import { getAccountTypeShortLabelKey } from '@/utils/enums'
import { gamePathIdentity } from '@/utils/path'
import RunningInstancesTab from '@/views/instances/RunningInstancesTab.vue'

const { t } = useI18n()
const router = useRouter()
const account = useAccountManager(t)
const version = useInstanceManager(t)
const javaManagerVisible = ref(false)
const javaTarget = ref<ScannedVersion | null>(null)
const javaMessage = useLauncherMessage()
let javaRecoveryRevision = 0
function openJavaRecovery() {
  const store = useInstanceStore()
  const target = store.scannedVersions.find(
    (item) =>
      item.versionId === version.selectedVersion &&
      gamePathIdentity(item.path) === gamePathIdentity(version.currentGamePath)
  )
  if (!target) return
  javaTarget.value = { ...target }
  javaManagerVisible.value = true
}
async function applyRecoveryJava(runtime: JavaRuntime) {
  const target = javaTarget.value
  if (!target) return
  const revision = javaRecoveryRevision
  try {
    await useJavaForInstance(target, runtime)
    if (revision === javaRecoveryRevision) {
      javaManagerVisible.value = false
      version.javaRecoveryMessage = ''
      javaMessage.success(t('javaManager.applied'))
    }
  } catch (cause) {
    if (revision === javaRecoveryRevision) javaMessage.error(cause instanceof Error ? cause.message : String(cause))
  }
}
watch(
  () => `${version.currentGamePath}\0${version.selectedVersion}`,
  () => {
    javaRecoveryRevision++
    javaManagerVisible.value = false
    javaTarget.value = null
    version.javaRecoveryMessage = ''
  }
)
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

function openAddAccountModal(): void {
  showAddAccountModal.value = true
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
    const textures = await fetchAccountTextures(account.id)
    if (showAccountDetailsModal.value && detailAccount.value?.id === account.id) detailTextures.value = textures
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

function handleLaunchProgressCancel() {
  // 立即释放进度卡与启动按钮，取消信号与后端清理在后台继续。
  version.cancelLaunch()
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
})
</script>

<style scoped src="@/styles/views/Game.css"></style>
