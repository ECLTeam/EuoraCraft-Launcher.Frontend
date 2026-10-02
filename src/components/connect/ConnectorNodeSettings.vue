<template>
  <div class="node-settings-form" :aria-busy="loading || saving">
    <SettingRow :label="t('advanced.nodesPolicy')" :description="t(`advanced.nodesModeHint.${mode}`)">
      <NSelect
        v-model:value="mode"
        class="node-settings-select"
        :options="modes"
        :disabled="!loaded || loading || saving"
        :aria-label="t('advanced.nodesPolicy')"
      />
    </SettingRow>
    <div v-if="loaded && mode !== 'automatic'" class="node-settings-addresses">
      <label :for="addressId">{{ t('advanced.nodesAddresses') }}</label>
      <p :id="addressHintId">{{ t('advanced.nodesAddressHint') }}</p>
      <NInput
        v-model:value="text"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 8 }"
        placeholder="tcp://relay.example.com:11010"
        :disabled="loading || saving"
        :inputProps="{ id: addressId, 'aria-label': t('advanced.nodesAddresses'), 'aria-describedby': addressHintId }"
      />
    </div>
    <div class="node-settings-footer">
      <p>{{ t('advanced.nodesHint') }}</p>
      <p>{{ t('advanced.nodesResetHint') }}</p>
      <p v-if="error" class="node-settings-error" role="alert">{{ error }}</p>
      <p class="node-settings-status" role="status">{{ loading ? t('common.loading') : feedback }}</p>
      <div class="node-settings-actions">
        <UiButton v-if="!loaded && !loading" size="sm" variant="outline" data-action="retry" @click="load">{{
          t('advanced.nodesRetry')
        }}</UiButton>
        <UiButton size="sm" variant="outline" :disabled="!loaded || loading || saving" @click="reset">{{
          t('advanced.nodesReset')
        }}</UiButton>
        <UiButton
          size="sm"
          data-action="save"
          :loading="saving"
          :disabled="!loaded || loading || saving"
          @click="save"
          >{{ t('common.save') }}</UiButton
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NSelect } from 'naive-ui'
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import type { CommandPayloadMap } from '@/types/api'
import { getErrorMessage } from '@/utils/error'

type NodeSettings = CommandPayloadMap['connector_nodes_set']
const { t } = useI18n()
const mode = ref<NodeSettings['mode']>('automatic')
const text = ref('')
const loaded = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const feedback = ref('')
const addressId = `connector-addresses-${useId()}`
const addressHintId = `${addressId}-hint`
const modes = computed(() =>
  ['automatic', 'append', 'custom'].map((value) => ({ value, label: t(`advanced.nodesMode.${value}`) }))
)

watch([mode, text], () => {
  feedback.value = ''
})
onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const settings = unwrapResponse(await backend.command('connector_nodes_get'), t('advanced.nodesTitle'))
    mode.value = settings.mode
    text.value = settings.nodes.join('\n')
    loaded.value = true
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function persist(payload: NodeSettings) {
  if (!loaded.value || loading.value || saving.value) return
  saving.value = true
  error.value = ''
  feedback.value = ''
  try {
    const settings = unwrapResponse(await backend.command('connector_nodes_set', payload), t('advanced.nodesTitle'))
    mode.value = settings.mode
    text.value = settings.nodes.join('\n')
    // 等待草稿变化的 watch 清除旧反馈，再显示本次保存结果。
    await nextTick()
    feedback.value = t('advanced.nodesSaved')
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    saving.value = false
  }
}

async function save() {
  await persist({
    mode: mode.value,
    nodes: text.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  })
}

async function reset() {
  await persist({ mode: 'automatic', nodes: [] })
}
</script>

<style scoped>
.node-settings-select {
  width: 220px;
}
.node-settings-addresses {
  padding: 12px 16px;
}
.node-settings-addresses label {
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
}
.node-settings-form p {
  margin: 0 0 8px;
  color: var(--ecl-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.node-settings-addresses p {
  margin-top: 6px;
}
.node-settings-footer {
  padding: 12px 16px;
}
.node-settings-form .node-settings-error {
  color: var(--error);
}
.node-settings-status {
  min-height: 19px;
}
.node-settings-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 840px) {
  .node-settings-form :deep(.setting-item) {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }
  .node-settings-form :deep(.setting-control) {
    justify-content: flex-start;
  }
  .node-settings-select {
    width: 100%;
  }
}
</style>
