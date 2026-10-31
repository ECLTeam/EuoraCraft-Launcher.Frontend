<template>
  <Modal v-model:visible="visible" :title="t('connect.nat.title')" width="460px" maskClosable>
    <div class="nat-detect" role="status" aria-live="polite" :aria-busy="isDetecting">
      <div v-if="isDetecting" class="nat-detect__state">
        <UiLoading mode="inline" size="sm" decorative />
        <span>{{ t('connect.nat.detecting') }}</span>
      </div>
      <div v-else-if="state === 'error'" class="nat-detect__error">
        <strong><UiIcon name="alert-circle" :size="15" />{{ t('connect.nat.failed') }}</strong>
        <p>{{ failureText }}</p>
      </div>
      <div v-else-if="result" class="nat-detect__result">
        <UiTag :tone="resultTone" size="medium">{{ resultLabel }}</UiTag>
        <dl class="nat-detect__fields">
          <div>
            <dt>{{ t('connect.nat.publicAddress') }}</dt>
            <dd>
              <code>{{ publicAddress || t('connect.nat.notObtained') }}</code>
            </dd>
          </div>
          <div>
            <dt>{{ t('connect.nat.ipv6') }}</dt>
            <dd>{{ t(result.supportsIpv6 ? 'connect.nat.ipv6Detected' : 'connect.nat.ipv6NotDetected') }}</dd>
          </div>
        </dl>
        <p v-if="detectedLabel" class="nat-detect__cached">{{ detectedLabel }}</p>
      </div>
      <div v-else class="nat-detect__state">
        <span>{{ t('connect.nat.idle') }}</span>
      </div>
    </div>
    <template #footer>
      <NButton @click="visible = false">{{ t('common.close') }}</NButton>
      <NButton type="primary" :loading="isDetecting" :disabled="isDetecting" @click="detect(true)">
        {{ t('connect.nat.redetect') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiTag from '@/components/ui/Tag.vue'
import { useNatType } from '@/features/connect/composables/useNatType'

defineOptions({ name: 'NatDetectModal' })

const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const { state, result, detectedAt, failureKind, failureMessage, isCacheFresh, detect } = useNatType()
const isDetecting = computed(() => state.value === 'detecting')

watch(
  visible,
  (isOpen) => {
    if (!isOpen) return
    // 有有效缓存时直接展示，避免每次打开都重新等待探测
    if (isCacheFresh()) return
    void detect()
  },
  { immediate: true }
)

const resultLabel = computed(() => {
  const kind = result.value?.detailType ?? result.value?.type ?? 'unknown'
  return t(kind === 'unknown' ? 'connect.nat.unknownType' : `connect.nat.${kind}`)
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

const failureText = computed(() => {
  switch (failureKind.value) {
    case 'timeout':
      return t('connect.nat.timeout')
    case 'busy':
      return t('connect.nat.busy')
    case 'probeFailed':
      return t('connect.nat.probeFailed')
    default:
      return failureMessage.value || t('connect.nat.probeFailed')
  }
})

const detectedLabel = computed(() => {
  const timestamp = detectedAt.value
  if (!timestamp) return ''
  const time = new Date(timestamp).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  return t('connect.nat.cachedAt', { time })
})
</script>

<style scoped>
.nat-detect {
  display: grid;
  gap: 12px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.nat-detect__state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ecl-text-secondary);
  font-size: 12px;
}

.nat-detect__result {
  display: grid;
  justify-items: start;
  gap: 10px;
}

.nat-detect__result :deep(.ui-tag) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

.nat-detect__fields {
  display: grid;
  gap: 6px;
  margin: 0;
}

.nat-detect__fields > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
}

.nat-detect__fields dt {
  color: var(--ecl-text-secondary);
  font-size: 11px;
  line-height: 1.6;
}

.nat-detect__fields dd {
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.nat-detect__fields code {
  color: var(--ecl-text);
  font-size: 12px;
}

.nat-detect__cached {
  margin: 0;
  color: var(--ecl-text-tertiary);
  font-size: 11px;
}

.nat-detect__error strong {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--error);
  font-size: 12px;
}

.nat-detect__error p {
  margin: 6px 0 0;
  color: var(--ecl-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
