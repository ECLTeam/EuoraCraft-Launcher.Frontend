<template>
  <UiCard class="connect-nat-card" :title="t('connect.tools.natCardTitle')" icon="activity">
    <template #actions>
      <UiButton
        class="connect-nat-action"
        variant="secondary"
        size="md"
        icon="wifi"
        :loading="isDetecting"
        :disabled="isDetecting"
        @click="detect"
        >{{ t('connect.nat.detect') }}</UiButton
      >
    </template>
    <div class="connect-nat-body" role="status" aria-live="polite" :aria-busy="isDetecting">
      <div v-if="isDetecting" class="connect-nat-state">
        <UiLoading mode="inline" size="sm" decorative />
        <span>{{ t('connect.tools.detecting') }}</span>
      </div>
      <div v-else-if="state === 'success' && result" class="connect-nat-result">
        <UiTag :tone="resultTone" size="medium">{{ resultLabel }}</UiTag>
        <dl class="connect-nat-fields">
          <div>
            <dt>{{ t('connect.tools.publicAddress') }}</dt>
            <dd>
              <code>{{ publicAddress || t('connect.tools.notObtained') }}</code>
            </dd>
          </div>
        </dl>
        <span class="connect-nat-ipv6">
          {{ t(result.supportsIpv6 ? 'connect.tools.ipv6Detected' : 'connect.tools.ipv6NotDetected') }}
        </span>
      </div>
      <div v-else-if="state === 'error'" class="connect-nat-error">
        <strong><UiIcon name="alert-circle" :size="15" />{{ t('connect.tools.detectFailed') }}</strong>
        <p>{{ error }}</p>
      </div>
      <div v-else class="connect-nat-state">
        <span>{{ t('connect.tools.idleTitle') }}</span>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiTag from '@/components/ui/Tag.vue'
import { connectorApi } from '@/features/connect/api/connectorApi'
import type { NatTypeResult } from '@/types/connect'
import { getErrorMessage } from '@/utils/error'
const { t } = useI18n()
const state = ref<'idle' | 'detecting' | 'success' | 'error'>('idle')
const result = ref<NatTypeResult | null>(null)
const error = ref('')
let isActive = true
const isDetecting = computed(() => state.value === 'detecting')

onBeforeUnmount(() => {
  isActive = false
})

const resultLabel = computed(() => {
  const kind = result.value?.detailType ?? result.value?.type ?? 'unknown'
  return t(kind === 'unknown' ? 'connect.tools.unknownType' : `connect.nat.${kind}`)
})

const resultTone = computed<'default' | 'success' | 'warning' | 'error'>(() => {
  switch (result.value?.type) {
    case 'cone':
      return 'success'
    case 'symmetric':
      return 'warning'
    case 'blocked':
      return 'error'
    default:
      return 'default'
  }
})

const publicAddress = computed(() => {
  const current = result.value
  if (!current?.publicIp) return ''
  const host = current.publicIp.includes(':') ? `[${current.publicIp}]` : current.publicIp
  if (!current.publicPort) return host
  const portRange =
    current.publicPortEnd && current.publicPortEnd !== current.publicPort
      ? `${current.publicPort}-${current.publicPortEnd}`
      : `${current.publicPort}`
  return `${host}:${portRange}`
})

async function detect(): Promise<void> {
  if (!isActive || isDetecting.value) return
  state.value = 'detecting'
  result.value = null
  error.value = ''
  try {
    const detected = await connectorApi.natType()
    if (!isActive) return
    result.value = detected
    state.value = 'success'
  } catch (cause) {
    if (!isActive) return
    if (cause instanceof BackendCommandError && cause.errorCode === 'CONNECTOR_NAT_TYPE_TIMEOUT') {
      error.value = t('connect.tools.timeout')
    } else if (cause instanceof BackendCommandError && cause.errorCode === 'CONNECTOR_NAT_TYPE_BUSY') {
      error.value = t('connect.tools.busy')
    } else if (cause instanceof BackendCommandError && cause.errorCode === 'CONNECTOR_NAT_TYPE_FAILED') {
      error.value = t('connect.tools.probeFailed')
    } else {
      error.value = getErrorMessage(cause)
    }
    state.value = 'error'
  }
}
</script>

<style scoped src="@/styles/components/connect/NatToolCard.css"></style>
