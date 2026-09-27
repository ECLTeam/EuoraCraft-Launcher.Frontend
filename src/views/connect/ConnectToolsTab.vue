<template>
  <div class="connect-page connect-tools-page">
    <section class="connect-workspace">
      <div class="connect-workspace__body">
        <div class="connect-scroll-area">
          <div class="connect-tools-layout">
            <UiCard class="connect-main-card">
              <template #header>
                <div class="connect-card-heading">
                  <UiIcon name="activity" :size="18" />
                  <div>
                    <strong>{{ t('connect.tools.natCardTitle') }}</strong>
                    <span>{{ t('connect.tools.natCardDesc') }}</span>
                  </div>
                  <UiButton
                    class="connect-tools-action"
                    variant="outline"
                    size="sm"
                    icon="wifi"
                    :loading="busy"
                    :disabled="busy"
                    @click="detect"
                  >
                    {{ t('connect.nat.detect') }}
                  </UiButton>
                </div>
              </template>

              <div v-if="result" class="connect-nat-result">
                <div class="connect-nat-result__headline">
                  <UiTag :tone="resultTone" size="medium">{{ resultLabel }}</UiTag>
                  <span v-if="result.supportsIpv6" class="connect-nat-result__ipv6">
                    <UiIcon name="info" :size="13" />
                    {{ t('connect.nat.ipv6Available') }}
                  </span>
                </div>
                <div class="connect-nat-address">
                  <span>{{ t('connect.tools.publicAddress') }}</span>
                  <code>{{ publicAddress || '—' }}</code>
                </div>
              </div>

              <div v-else-if="busy" class="connect-tools-state">
                <UiLoading mode="inline" size="lg" decorative class="connect-tools-state__icon" />
                <strong>{{ t('connect.tools.detecting') }}</strong>
              </div>

              <div v-else-if="error" class="connect-tools-state connect-tools-state--error">
                <UiIcon name="alert-circle" :size="32" />
                <strong>{{ t('connect.tools.detectFailed') }}</strong>
                <p>{{ error }}</p>
              </div>

              <div v-else class="connect-tools-state">
                <UiIcon name="activity" :size="32" />
                <strong>{{ t('connect.tools.idleTitle') }}</strong>
                <p>{{ t('connect.tools.idleDesc') }}</p>
              </div>
            </UiCard>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiTag from '@/components/ui/Tag.vue'
import { connectorApi } from '@/features/connect/api/connectorApi'
import type { NatTypeResult } from '@/types/connect'
import { getErrorMessage } from '@/utils/error'

const { t } = useI18n()

const result = ref<NatTypeResult | null>(null)
const busy = ref(false)
const error = ref('')

// detailType 比 type 更精确，优先用它展示具体穿透形态
const resultLabel = computed(() => t(`connect.nat.${result.value?.detailType ?? result.value?.type ?? 'unknown'}`))

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
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    result.value = await connectorApi.natType()
  } catch (cause) {
    result.value = null
    error.value = getErrorMessage(cause)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped src="@/styles/views/Connect.css"></style>
