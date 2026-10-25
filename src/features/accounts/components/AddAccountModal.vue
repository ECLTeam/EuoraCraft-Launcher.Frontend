<template>
  <Modal
    ref="modalRef"
    :visible="visible"
    :parentId="parentId"
    :title="modalTitle"
    :icon="modalIcon"
    :showFooter="step !== 'select'"
    :closable="!isBusy"
    width="480px"
    @update:visible="handleVisibilityChange"
  >
    <div ref="stepContentRef" class="account-step-content" tabindex="-1">
      <div v-if="step === 'select'" class="account-add-body">
        <NAlert v-if="isShowcaseMode" type="warning" :title="t('game.showcase.title')">
          {{ t('game.showcase.description') }}
        </NAlert>
        <div class="account-type-options">
          <NButton
            v-for="option in accountTypeOptions"
            :key="option.value"
            :data-account-type="option.value"
            class="account-type-option"
            block
            :loading="option.value === 'microsoft' && account.startingMicrosoftLogin"
            :disabled="
              isBusy ||
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
      <div v-else-if="step === 'form'">
        <div v-if="selectedAccountType === 'offline'" class="account-form">
          <NInput
            v-model:value="account.newOfflineUsername"
            :placeholder="t('game.enterUsername')"
            :inputProps="{ 'aria-label': t('game.enterUsername') }"
            @keyup.enter="addOfflineFromModal"
          />
          <div class="offline-uuid-field">
            <label :for="uuidInputId">{{ t('game.customUuid') }}</label>
            <NInput
              v-model:value="offlineUuidInput"
              :inputProps="{ id: uuidInputId, 'aria-describedby': `${uuidInputId}-hint` }"
              :placeholder="t('game.customUuidPlaceholder')"
              :status="account.offlineUuidError ? 'error' : undefined"
              clearable
              @keyup.enter="addOfflineFromModal"
            />
            <small :id="`${uuidInputId}-hint`" :class="{ error: account.offlineUuidError }" aria-live="polite">
              {{ account.offlineUuidError || t('game.customUuidHint') }}
            </small>
          </div>
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
          <!--<small class="authlib-server-hint">{{ t('auth.serverUrlHint') }}</small>-->
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
      <MicrosoftLoginPanel
        v-else
        :status="account.microsoftLoginStatus"
        :stage="account.microsoftLoginStage"
        :userCode="account.microsoftLoginData.userCode || ''"
        :verificationUri="account.microsoftLoginData.verificationUri || ''"
        :copied="account.copiedUserCode"
        :error="account.microsoftLoginError"
        @copyCode="account.copyUserCode"
      />
    </div>
    <template #footer>
      <NButton v-if="step === 'form'" class="account-back-button" :disabled="isBusy" @click="returnToSelection">
        <template #icon><UiIcon name="chevron-left" :size="16" /></template>
        {{ t('common.back') }}
      </NButton>
      <template v-else-if="step === 'microsoft'">
        <NButton :loading="isCancellingMicrosoft" :disabled="isBusy" @click="cancelMicrosoftFromModal">
          {{ t('common.cancel') }}
        </NButton>
        <NButton
          v-if="account.microsoftLoginStatus === 'pending'"
          type="primary"
          :disabled="isBusy"
          @click="account.openMicrosoftLoginPage"
        >
          <template #icon><UiIcon name="external-link" :size="16" /></template>
          {{ t('game.login.openBrowser') }}
        </NButton>
      </template>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NAlert, NAutoComplete, NButton, NInput, NSelect, NTag, type SelectOption } from 'naive-ui'
import { computed, h, nextTick, onUnmounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import type { useAccountManager } from '@/composables/useAccountManager'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { getAccountTypeLabelKey } from '@/utils/enums'
import MicrosoftLoginPanel from './MicrosoftLoginPanel.vue'

defineProps<{ parentId?: string }>()
const account = defineModel<ReturnType<typeof useAccountManager>>('account', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const modalRef = ref<InstanceType<typeof Modal> | null>(null)
const stepContentRef = ref<HTMLElement | null>(null)
const step = ref<'select' | 'form' | 'microsoft'>('select')
const modalStack = useGlobalModalStack()
const isCancellingMicrosoft = ref(false)
let cancellation: Promise<boolean> | null = null
let flowGeneration = 0
let isDisposed = false
const selectedAccountType = ref('offline')
const uuidInputId = `offline-uuid-${useId()}`
const offlineUuidInput = computed({
  get: () => account.value.newOfflineUuid || account.value.offlineUuidPreview,
  set: (value: string) => {
    account.value.newOfflineUuid = value
  },
})
const isShowcaseMode = backend.runtime.isShowcase
const isSubmitting = ref(false)
const isBusy = computed(
  () =>
    isSubmitting.value ||
    account.value.startingMicrosoftLogin ||
    account.value.completingMicrosoftLogin ||
    isCancellingMicrosoft.value
)
const accountTypeOptions = computed(() => [
  { value: 'microsoft', label: t(getAccountTypeLabelKey('microsoft')), icon: 'microsoft' },
  { value: 'offline', label: t(getAccountTypeLabelKey('offline')), icon: 'user-circle' },
  { value: 'authlib', label: t(getAccountTypeLabelKey('authlib')), icon: 'server' },
  ...account.value.authProviders.map((provider) => ({
    value: `plugin:${provider.id}`,
    label: provider.title,
    icon: 'puzzle',
  })),
])
const selectedAccountOption = computed(() =>
  accountTypeOptions.value.find((option) => option.value === selectedAccountType.value)
)
const modalTitle = computed(() => {
  if (step.value === 'select') return t('game.addAccount')
  if (step.value === 'microsoft') return t('game.login.title')
  return selectedAccountOption.value?.label ?? t('game.addAccount')
})
const modalIcon = computed(() => (step.value === 'select' ? 'info' : (selectedAccountOption.value?.icon ?? 'info')))
const selectedPluginProvider = computed(() => {
  if (!selectedAccountType.value.startsWith('plugin:')) return null
  return account.value.pluginProviderById(selectedAccountType.value.slice('plugin:'.length))
})

function isCurrentFlow(generation: number): boolean {
  return !isDisposed && visible.value && generation === flowGeneration
}

async function focusStep(): Promise<void> {
  const generation = flowGeneration
  await nextTick()
  if (!isCurrentFlow(generation) || modalStack.interactiveModalId.value !== modalRef.value?.modalId) return
  const root = stepContentRef.value
  if (!root) return
  if (step.value === 'select') {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-account-type]')]
    const target = buttons.find(
      (button) => button.dataset.accountType === selectedAccountType.value && !button.disabled
    )
    ;(target ?? buttons.find((button) => !button.disabled))?.focus()
  } else {
    const input = root.querySelector<HTMLElement>('input:not(:disabled), [tabindex="0"]')
    ;(input ?? root).focus()
  }
}

function returnToSelection(): void {
  if (isBusy.value) return
  step.value = 'select'
}

async function cancelMicrosoftSession(): Promise<boolean> {
  if (cancellation) return cancellation
  isCancellingMicrosoft.value = true
  const request = account.value.cancelMicrosoftLogin()
  cancellation = request
  try {
    return await request
  } finally {
    cancellation = null
    isCancellingMicrosoft.value = false
  }
}

async function cancelMicrosoftFromModal(): Promise<void> {
  if (isBusy.value) return
  const generation = flowGeneration
  const cancelled = await cancelMicrosoftSession()
  if (cancelled && isCurrentFlow(generation)) returnToSelection()
}

function closeAddAccount(): void {
  visible.value = false
}

function handleVisibilityChange(next: boolean): void {
  if (!next && isBusy.value) return
  visible.value = next
}

watch(
  visible,
  (isVisible) => {
    flowGeneration += 1
    const hasMicrosoftSession = account.value.showMicrosoftLoginModal
    step.value = 'select'
    if (!isVisible) {
      if (hasMicrosoftSession && !account.value.startingMicrosoftLogin) void cancelMicrosoftSession()
      return
    }
    // 关闭时若取消失败，重新打开后继续展示仍活动的授权，避免误当成已结束。
    if (hasMicrosoftSession) {
      selectedAccountType.value = 'microsoft'
      step.value = 'microsoft'
    }
    account.value.newOfflineUuid = ''
    account.value.selectedOfflineSkinId = ''
    void account.value.loadMicrosoftLoginConfig()
    void account.value.loadAuthlibServers()
    account.value.loadOfflineSkins()
  },
  { immediate: true, flush: 'sync' }
)

watch(
  () => [account.value.showMicrosoftLoginModal, account.value.completingMicrosoftLogin, isCancellingMicrosoft.value],
  () => {
    if (
      !visible.value ||
      step.value !== 'microsoft' ||
      account.value.showMicrosoftLoginModal ||
      account.value.completingMicrosoftLogin ||
      isCancellingMicrosoft.value
    )
      return
    if (account.value.microsoftLoginStatus === 'loading' && account.value.microsoftLoginStage === 'completed')
      closeAddAccount()
    else returnToSelection()
  }
)

watch(step, () => {
  void focusStep()
})
onUnmounted(() => {
  isDisposed = true
  flowGeneration += 1
  if (account.value.showMicrosoftLoginModal && !account.value.startingMicrosoftLogin) void cancelMicrosoftSession()
})

async function chooseAccountType(type: string): Promise<void> {
  if (!visible.value || step.value !== 'select' || isBusy.value) return
  if (type !== 'microsoft') {
    selectedAccountType.value = type
    step.value = 'form'
    return
  }
  if (account.value.isMicrosoftLoginConfigLoading || !account.value.microsoftLoginConfig.available) return
  selectedAccountType.value = type
  const generation = flowGeneration
  const started = await account.value.startMicrosoftLogin()
  if (!isCurrentFlow(generation)) {
    // 准备期间若所属流程被外层关闭，在准备完成后取消实际创建的会话。
    if (started && account.value.showMicrosoftLoginModal) await cancelMicrosoftSession()
    return
  }
  if (!started) return
  if (account.value.showMicrosoftLoginModal) step.value = 'microsoft'
  else closeAddAccount()
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
  const generation = flowGeneration
  const accountCount = account.value.accounts.length
  isSubmitting.value = true
  try {
    await account.value.addOfflineAccount()
    if (isCurrentFlow(generation) && account.value.accounts.length > accountCount) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}

async function addAuthlibFromModal(): Promise<void> {
  if (isSubmitting.value) return
  const generation = flowGeneration
  const accountCount = account.value.accounts.length
  isSubmitting.value = true
  try {
    await account.value.addAuthlibAccount()
    if (!isCurrentFlow(generation)) return
    if (!account.value.pendingAuthlibAccountId && account.value.accounts.length > accountCount) closeAddAccount()
    else if (account.value.pendingAuthlibAccountId) void focusStep()
  } finally {
    isSubmitting.value = false
  }
}

async function selectAuthlibProfileFromModal(): Promise<void> {
  if (isSubmitting.value) return
  const generation = flowGeneration
  isSubmitting.value = true
  try {
    await account.value.selectAuthlibProfile()
    if (isCurrentFlow(generation) && !account.value.pendingAuthlibAccountId) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}

async function addPluginAccountFromModal(): Promise<void> {
  if (isSubmitting.value || !selectedPluginProvider.value) return
  const generation = flowGeneration
  const accountCount = account.value.accounts.length
  isSubmitting.value = true
  try {
    await account.value.addPluginAccount(selectedPluginProvider.value)
    if (isCurrentFlow(generation) && account.value.accounts.length > accountCount) closeAddAccount()
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped src="@/styles/views/AddAccountModal.css"></style>
