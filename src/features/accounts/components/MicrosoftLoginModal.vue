<template>
  <Modal
    :visible="visible"
    :parentId="parentId"
    :title="t('game.login.title')"
    icon="microsoft"
    :closable="false"
    wrapperClass="microsoft-login-modal"
    width="min(460px, calc(100vw - 32px))"
  >
    <div class="microsoft-login-content">
      <div class="microsoft-login-intro" role="status" aria-live="polite">
        <div class="microsoft-login-brand"><UiIcon name="microsoft" :size="28" /></div>
        <div>
          <h4>{{ heading }}</h4>
          <p v-if="status !== 'error'">{{ hint }}</p>
        </div>
      </div>

      <template v-if="status === 'pending'">
        <div class="microsoft-login-code-field">
          <span class="microsoft-login-code-label">{{ t('game.login.enterCode') }}</span>
          <div class="microsoft-login-code">
            <code>{{ userCode }}</code>
            <NButton
              quaternary
              :title="copied ? t('game.login.copied') : t('game.login.copyCode')"
              :aria-label="copied ? t('game.login.copied') : t('game.login.copyCode')"
              @click="emit('copyCode')"
            >
              <template #icon><UiIcon :name="copied ? 'check' : 'copy'" :size="18" /></template>
            </NButton>
          </div>
          <span class="microsoft-login-url">{{ verificationUri }}</span>
        </div>
        <UiLoading mode="inline" size="sm" :label="t('game.login.autoDetecting')" />
      </template>

      <ol v-else-if="status === 'loading'" class="microsoft-login-steps">
        <li
          v-for="(step, index) in steps"
          :key="step"
          :class="{ 'is-complete': index < completedSteps, 'is-active': index === completedSteps }"
          :aria-current="index === completedSteps ? 'step' : undefined"
        >
          <span class="microsoft-login-step-icon">
            <UiIcon v-if="index < completedSteps" name="check" :size="16" />
            <UiLoading v-else-if="index === completedSteps" mode="inline" size="sm" decorative />
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span>{{ t(`game.login.steps.${step}`) }}</span>
        </li>
      </ol>

      <NAlert v-else type="error">{{ error || t('game.login.failed') }}</NAlert>
    </div>

    <template #footer>
      <NButton @click="emit('cancel')">{{ t('common.cancel') }}</NButton>
      <NButton v-if="status === 'pending'" type="primary" @click="emit('openBrowser')">
        <template #icon><UiIcon name="external-link" :size="16" /></template>
        {{ t('game.login.openBrowser') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NAlert, NButton } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import type { MicrosoftLoginStage } from '@/types/accounts'

defineOptions({ name: 'MicrosoftLoginModal' })

const props = defineProps<{
  visible: boolean
  parentId?: string
  status: 'pending' | 'loading' | 'error'
  stage: MicrosoftLoginStage
  userCode: string
  verificationUri: string
  copied: boolean
  error: string
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'copyCode'): void
  (e: 'openBrowser'): void
}>()

const { t } = useI18n()
const steps = ['authorization', 'profile', 'saving'] as const
const heading = computed(() => {
  if (props.status === 'pending') return t('game.login.authorize')
  if (props.status === 'error') return t('game.login.failed')
  return t(`game.login.stage.${props.stage}`)
})
const hint = computed(() =>
  t(
    props.status === 'pending'
      ? 'game.login.authorizationHint'
      : props.stage === 'waiting_authorization'
        ? 'game.login.preparingHint'
        : 'game.login.processingHint'
  )
)
const completedSteps = computed(() => {
  if (props.stage === 'completed') return 3
  if (props.stage === 'saving') return 2
  if (props.stage === 'waiting_authorization') return 0
  return 1
})
</script>

<style src="@/styles/views/MicrosoftLoginModal.css"></style>
