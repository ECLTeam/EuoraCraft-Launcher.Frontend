<template>
  <div ref="contentRef" class="littleskin-login-content">
    <UiLoading v-if="configLoading" mode="inline" :label="t('common.loading')" />
    <NAlert v-if="hasError" type="error" role="alert">
      {{ t(errorKey) }}
      <NButton text :disabled="busy" @click="retry">{{ t('common.retry') }}</NButton>
      <NButton v-if="session?.error_code === 'LITTLESKIN_NO_PROFILES'" text @click="openProfilePage">
        {{ t('littleskin.createProfile') }}
      </NButton>
    </NAlert>
    <template v-if="!session && !configLoading && !hasError">
      <p>{{ t('littleskin.intro') }}</p>
      <NButton
        block
        type="primary"
        :loading="busy"
        :disabled="busy || !config.device_code"
        @click="start('device_code')"
      >
        {{ t('littleskin.deviceCode') }}
      </NButton>
      <NButton block :disabled="busy || !config.authorization_code" @click="start('authorization_code')">
        {{ t('littleskin.authorizationCode') }}
      </NButton>
      <NAlert v-if="!config.device_code || !config.authorization_code" type="warning">
        {{ t(config.needs_client_id ? 'littleskin.missingClientId' : 'littleskin.missingSecret') }}
      </NAlert>
    </template>
    <template v-else-if="session?.status === 'pending'">
      <p role="status" aria-live="polite">{{ t('littleskin.authorize') }}</p>
      <div v-if="session.user_code" class="littleskin-code">
        <code>{{ session.user_code }}</code>
        <NButton :aria-label="t('game.login.copyCode')" @click="copy(session.user_code)">
          {{ t(copied ? 'game.login.copied' : 'game.login.copyCode') }}
        </NButton>
      </div>
      <p>{{ t('littleskin.expiresAt', { time: expiryTime }) }}</p>
      <NButton type="primary" :disabled="busy" @click="openAuthorizationPage">
        {{ t('game.login.openBrowser') }}
      </NButton>
      <UiLoading mode="inline" size="sm" :label="t('game.login.autoDetecting')" />
    </template>
    <template v-else-if="session?.status === 'selecting'">
      <label :for="profileInputId">{{ t('littleskin.chooseProfile') }}</label>
      <NSelect
        :id="profileInputId"
        v-model:value="selectedProfileId"
        :options="session.profiles.map((profile) => ({ label: profile.name, value: profile.id }))"
        :disabled="busy"
      />
      <NButton type="primary" :disabled="busy || !selectedProfileId" :loading="busy" @click="selectProfile">
        {{ t('auth.loginSelectedProfile') }}
      </NButton>
    </template>
    <UiLoading
      v-else-if="session && !hasError"
      mode="inline"
      :label="
        t(session.status === 'saving' || session.status === 'ready' ? 'littleskin.saving' : 'littleskin.preparing')
      "
    />
    <NButton :disabled="busy" @click="cancelAndReturn">{{ t(session ? 'common.cancel' : 'common.back') }}</NButton>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NSelect } from 'naive-ui'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiLoading from '@/components/ui/Loading.vue'
import { useClipboard } from '@/composables/useClipboard'
import { useLittleSkinLogin } from '@/features/accounts/composables/useLittleSkinLogin'
import { openExternalUrl } from '@/utils/openExternal'

const emit = defineEmits<{ completed: []; cancel: []; busyChange: [busy: boolean] }>()
const { t, locale } = useI18n()
const {
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
} = useLittleSkinLogin(() => emit('completed'))
const { copy, copied } = useClipboard()
const profileInputId = `littleskin-profile-${useId()}`
const contentRef = ref<HTMLElement | null>(null)
const expiryTime = computed(() =>
  session.value ? new Date(session.value.expires_at * 1000).toLocaleTimeString(locale.value) : ''
)

async function openAuthorizationPage(): Promise<void> {
  if (!session.value || session.value.status !== 'pending') return
  await openExternalUrl(session.value.verification_uri)
}

async function openProfilePage(): Promise<void> {
  await openExternalUrl('https://littleskin.cn/user/player')
}

async function cancelAndReturn(): Promise<void> {
  if (await cancel()) emit('cancel')
}

watch(busy, (value) => emit('busyChange', value), { immediate: true })
watch([configLoading, () => session.value?.status], async () => {
  await nextTick()
  contentRef.value?.querySelector<HTMLElement>('input:not(:disabled), [tabindex="0"], button:not(:disabled)')?.focus()
})
</script>

<style scoped>
.littleskin-login-content {
  display: flex;
  flex-direction: column;
  gap: var(--s-md);
  min-width: 0;
}

.littleskin-login-content p {
  margin: 0;
}

.littleskin-code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-sm);
  flex-wrap: wrap;
}

.littleskin-code code {
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
  font-size: var(--font-size-lg);
}
</style>
