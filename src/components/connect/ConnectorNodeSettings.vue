<template>
  <details class="node-settings">
    <summary>{{ t('advanced.nodesTitle') }}</summary>
    <p>{{ t('advanced.nodesHint') }}</p>
    <NSelect v-model:value="mode" :options="modes" :disabled="loading || saving" />
    <NInput
      v-model:value="text"
      type="textarea"
      :autosize="{ minRows: 3, maxRows: 8 }"
      placeholder="tcp://relay.example.com:11010"
      :disabled="loading || saving || mode === 'automatic'"
      :aria-label="t('advanced.nodesAddresses')"
    />
    <p class="node-settings-error" role="alert">{{ error }}</p>
    <div class="node-settings-actions">
      <UiButton size="sm" :loading="saving" :disabled="loading || saving" @click="save">{{
        t('common.save')
      }}</UiButton>
      <UiButton size="sm" variant="outline" :disabled="loading || saving" @click="reset">{{
        t('advanced.nodesReset')
      }}</UiButton>
    </div>
  </details>
</template>

<script setup lang="ts">
import { NInput, NSelect } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import { getErrorMessage } from '@/utils/error'
const { t } = useI18n()
const mode = ref<'automatic' | 'append' | 'custom'>('automatic')
const text = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const modes = computed(() =>
  ['automatic', 'append', 'custom'].map((value) => ({ value, label: t(`advanced.nodesMode.${value}`) }))
)

onMounted(async () => {
  try {
    const settings = unwrapResponse(await backend.command('connector_nodes_get'), t('advanced.nodesTitle'))
    mode.value = settings.mode
    text.value = settings.nodes.join('\n')
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    const settings = unwrapResponse(
      await backend.command('connector_nodes_set', {
        mode: mode.value,
        nodes: text.value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      }),
      t('advanced.nodesTitle')
    )
    mode.value = settings.mode
    text.value = settings.nodes.join('\n')
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    saving.value = false
  }
}

async function reset() {
  mode.value = 'automatic'
  text.value = ''
  await save()
}
</script>

<style scoped>
.node-settings {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
}
summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
p {
  font-size: 12px;
  color: var(--ecl-text-secondary);
  line-height: 1.6;
}
.node-settings :deep(.n-input) {
  margin-top: 10px;
}
.node-settings-actions {
  display: flex;
  gap: 8px;
}
.node-settings-error {
  color: var(--error);
  min-height: 18px;
}
</style>
