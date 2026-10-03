<template>
  <div class="node-settings-form">
    <SettingRow :label="t('advanced.nodesPolicy')">
      <NSelect
        :value="settings.connector.mode"
        class="node-settings-select"
        :options="modes"
        :disabled="settings.status !== 'ready'"
        :aria-label="t('advanced.nodesPolicy')"
        @update:value="updateMode"
      />
    </SettingRow>
    <div v-if="settings.connector.mode !== 'automatic'" class="node-settings-addresses">
      <label :for="addressId">{{ t('advanced.nodesAddresses') }}</label>
      <NInput
        :value="text"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 8 }"
        placeholder="tcp://relay.example.com:11010"
        :disabled="settings.status !== 'ready'"
        :inputProps="{ id: addressId, 'aria-label': t('advanced.nodesAddresses') }"
        @update:value="updateText"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NSelect } from 'naive-ui'
import { computed, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAsyncAction } from '@/composables/useAsyncAction'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { ConnectorConfig } from '@/types/config'

const { t } = useI18n()
const settings = useSettingsStore()
const { run } = useAsyncAction({ showSuccess: false })
const text = ref('')
const addressId = `connector-addresses-${useId()}`
const modes = computed(() =>
  ['automatic', 'append', 'custom'].map((value) => ({ value, label: t(`advanced.nodesMode.${value}`) }))
)
onMounted(() =>
  run(async () => {
    await settings.load()
    text.value = settings.connector.nodes.join('\n')
  })
)

function updateMode(mode: ConnectorConfig['mode']) {
  void run(() => settings.patchConnector({ mode }))
}

function updateText(value: string) {
  text.value = value
  void run(() => settings.patchConnector({ nodes: value ? value.split('\n') : [] }))
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
  display: block;
  margin-bottom: 8px;
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
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
