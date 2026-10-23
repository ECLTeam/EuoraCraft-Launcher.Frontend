<template>
  <Modal
    ref="selectorModalRef"
    v-model:visible="visible"
    :parentId="parentId"
    :title="t('game.addAccount')"
    :showFooter="false"
    :closable="!account.startingMicrosoftLogin"
    width="480px"
  >
    <div class="account-add-body">
      <NAlert v-if="isShowcaseMode" type="warning" :title="t('game.showcase.title')">
        {{ t('game.showcase.description') }}
      </NAlert>
      <div class="account-type-options">
        <NButton
          v-for="option in accountTypeOptions"
          :key="option.value"
          class="account-type-option"
          block
          :loading="option.value === 'microsoft' && account.startingMicrosoftLogin"
          :disabled="
            account.startingMicrosoftLogin ||
            (option.value === 'microsoft' &&
              (account.isMicrosoftLoginConfigLoading || !account.microsoftLoginConfig.available))
          "
          @click="chooseAccountType(option.value)"
        >
          <template #icon><UiIcon :name="option.icon" :size="18" /></template>
          <span class="account-type-option-label">{{ option.label }}</span>
          <UiIcon name="chevron-right" :size="16" />
        </NButton>
      </div>
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
    </div>
    <Modal
      v-model:visible="showAccountFormModal"
      :title="selectedAccountLabel"
      :showFooter="false"
      :closable="!isSubmitting"
      width="480px"
    >
      <div v-if="selectedAccountType === 'offline'" class="account-form">
        <NInput
          v-model:value="account.newOfflineUsername"
          :placeholder="t('game.enterUsername')"
          @keyup.enter="addOfflineFromModal"
        />
        <p v-if="account.offlineUuidPreview" class="offline-uuid-preview">
          <span>{{ t('game.offlineUuidPreview') }}</span>
          <code>{{ account.offlineUuidPreview }}</code>
        </p>
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

      <div v-else-if="selectedAccountType === 'authlib' && account.pendingAuthlibAccountId" class="account-form">
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
    </Modal>
  </Modal>
  <MicrosoftLoginModal
    :visible="account.showMicrosoftLoginModal"
    :parentId="selectorModalRef?.modalId"
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
</template>

<script setup lang="ts">
import { NAlert, NAutoComplete, NButton, NInput, NSelect, NTag, type SelectOption } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import type { useAccountManager } from '@/composables/useAccountManager'
import { getAccountTypeLabelKey } from '@/utils/enums'
import MicrosoftLoginModal from './MicrosoftLoginModal.vue'

defineProps<{ parentId?: string }>()
const account = defineModel<ReturnType<typeof useAccountManager>>('account', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const selectorModalRef = ref<InstanceType<typeof Modal> | null>(null)
const showAccountFormModal = ref(false)
const selectedAccountType = ref('offline')
const showOfflineAdvanced = ref(false)
const isShowcaseMode = backend.runtime.isShowcase
const isSubmitting = ref(false)
const accountTypeOptions = computed(() => [
  { value: 'microsoft', label: t(getAccountTypeLabelKey('microsoft')), icon: 'microsoft' },
  { value: 'offline', label: t(getAccountTypeLabelKey('offline')), icon: 'user' },
  { value: 'authlib', label: t(getAccountTypeLabelKey('authlib')), icon: 'globe' },
  ...account.value.authProviders.map((provider) => ({
    value: `plugin:${provider.id}`,
    label: provider.title,
    icon: 'puzzle',
  })),
])
const selectedAccountLabel = computed(
  () => accountTypeOptions.value.find((option) => option.value === selectedAccountType.value)?.label || ''
)
const selectedPluginProvider = computed(() => {
  if (!selectedAccountType.value.startsWith('plugin:')) return null
  return account.value.pluginProviderById(selectedAccountType.value.slice('plugin:'.length))
})

watch(visible, (isVisible) => {
  if (!isVisible) {
    showAccountFormModal.value = false
    return
  }
  showOfflineAdvanced.value = false
  account.value.newOfflineUuid = ''
  account.value.selectedOfflineSkinId = ''
  void account.value.loadMicrosoftLoginConfig()
  void account.value.loadAuthlibServers()
  account.value.loadOfflineSkins()
})

// 微软登录由现有授权弹窗异步完成；新增账户后收起选择页，取消或失败时保留入口。
watch(
  () => [account.value.showMicrosoftLoginModal, account.value.completingMicrosoftLogin],
  () => {
    if (
      visible.value &&
      !account.value.showMicrosoftLoginModal &&
      !account.value.completingMicrosoftLogin &&
      account.value.microsoftLoginStatus === 'loading' &&
      account.value.microsoftLoginStage === 'completed'
    )
      closeAddAccount()
  }
)

function closeAddAccount(): void {
  showAccountFormModal.value = false
  visible.value = false
}

async function chooseAccountType(type: string): Promise<void> {
  if (account.value.startingMicrosoftLogin || isSubmitting.value) return
  selectedAccountType.value = type
  if (type === 'microsoft') {
    if (account.value.isMicrosoftLoginConfigLoading || !account.value.microsoftLoginConfig.available) return
    const started = await account.value.startMicrosoftLogin()
    if (started && !account.value.showMicrosoftLoginModal) closeAddAccount()
    return
  }
  showAccountFormModal.value = true
}

function renderAuthlibProfileLabel(option: SelectOption) {
  return h('div', { class: 'authlib-profile-option-label' }, [
    h('span', String(option.profileName ?? option.label ?? '')),
    option.loggedIn
      ? h(NTag, { size: 'small', type: 'success', bordered: false }, { default: () => t('auth.loggedIn') })
      : null,
  ])
}

async function addOfflineFromModal(): Promise<void> {
  if (isSubmitting.value) return
  const accountCount = account.value.accounts.length
  isSubmitting.value = true
  try {
    await account.value.addOfflineAccount()
    if (account.value.accounts.length > accountCount) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}

async function addAuthlibFromModal(): Promise<void> {
  if (isSubmitting.value) return
  const accountCount = account.value.accounts.length
  isSubmitting.value = true
  try {
    await account.value.addAuthlibAccount()
    if (!account.value.pendingAuthlibAccountId && account.value.accounts.length > accountCount) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}

async function selectAuthlibProfileFromModal(): Promise<void> {
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    await account.value.selectAuthlibProfile()
    if (!account.value.pendingAuthlibAccountId) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}

async function addPluginAccountFromModal(): Promise<void> {
  if (isSubmitting.value || !selectedPluginProvider.value) return
  const accountCount = account.value.accounts.length
  isSubmitting.value = true
  try {
    await account.value.addPluginAccount(selectedPluginProvider.value)
    if (account.value.accounts.length > accountCount) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped src="@/styles/views/AddAccountModal.css"></style>
