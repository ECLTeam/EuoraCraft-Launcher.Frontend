<template>
  <div class="node-settings-form" :aria-busy="loading || saving">
    <SettingRow :label="t('advanced.nodesPolicy')" :description="t(`advanced.nodesModeHint.${mode}`)">
      <NSelect
        :value="mode"
        class="node-settings-select"
        :options="modes"
        :disabled="!loaded || loading"
        :aria-label="t('advanced.nodesPolicy')"
        @update:value="updateMode"
      />
    </SettingRow>
    <div v-if="loaded && mode !== 'automatic'" class="node-settings-addresses">
      <label :for="addressId">{{ t('advanced.nodesAddresses') }}</label>
      <p :id="addressHintId">{{ t('advanced.nodesAddressHint') }}</p>
      <NInput
        :value="text"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 8 }"
        placeholder="tcp://relay.example.com:11010"
        :disabled="loading"
        :inputProps="{ id: addressId, 'aria-label': t('advanced.nodesAddresses'), 'aria-describedby': addressHintId }"
        @update:value="updateText"
        @blur="save"
      />
    </div>
    <div class="node-settings-footer">
      <p>{{ t('advanced.nodesHint') }}</p>
      <p v-if="error" class="node-settings-error" role="alert">
        <template v-if="loaded">{{ t('advanced.nodesNotSaved') }} </template>{{ error }}
      </p>
      <p class="node-settings-status" role="status">{{ statusText }}</p>
      <div v-if="(!loaded && !loading) || error" class="node-settings-actions">
        <UiButton v-if="!loaded && !loading" size="sm" variant="outline" data-action="retry" @click="load">{{
          t('advanced.nodesRetry')
        }}</UiButton>
        <UiButton
          v-if="loaded && error"
          size="sm"
          variant="outline"
          data-action="retry-save"
          :disabled="saving"
          @click="save"
          >{{ t('advanced.nodesRetrySave') }}</UiButton
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NSelect } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import type { CommandPayloadMap } from '@/types/api'
import { getErrorMessage } from '@/utils/error'

type NodeSettings = CommandPayloadMap['connector_nodes_set']
interface SaveSnapshot {
  payload: NodeSettings
  revision: number
}
const { t } = useI18n()
const message = useLauncherMessage()
const mode = ref<NodeSettings['mode']>('automatic')
const text = ref('')
const loaded = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const hasSaved = ref(false)
let confirmed: NodeSettings | null = null
let revision = 0
let requestedRevision = 0
let active: SaveSnapshot | null = null
let pending: SaveSnapshot | null = null
let disposed = false
const addressId = `connector-addresses-${useId()}`
const addressHintId = `${addressId}-hint`
const modes = computed(() =>
  ['automatic', 'append', 'custom'].map((value) => ({ value, label: t(`advanced.nodesMode.${value}`) }))
)

const statusText = computed(() => {
  if (loading.value) return t('common.loading')
  if (saving.value) return t('advanced.nodesSaving')
  return hasSaved.value ? t('advanced.nodesSaved') : ''
})
onMounted(load)
onBeforeUnmount(() => {
  // 路由切换不一定触发原生 blur；仅收尾尚未提交的编辑，不重试失败请求。
  if (revision !== requestedRevision) save()
  disposed = true
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const settings = unwrapResponse(await backend.command('connector_nodes_get'), t('advanced.nodesTitle'))
    if (disposed) return
    confirmed = settings
    mode.value = settings.mode
    text.value = settings.nodes.join('\n')
    loaded.value = true
  } catch (cause) {
    if (!disposed) error.value = getErrorMessage(cause)
  } finally {
    if (!disposed) loading.value = false
  }
}

function updateMode(value: NodeSettings['mode']) {
  if (!loaded.value || loading.value || value === mode.value) return
  mode.value = value
  revision++
  hasSaved.value = false
  save()
}

function updateText(value: string) {
  if (!loaded.value || loading.value || value === text.value) return
  text.value = value
  revision++
  hasSaved.value = false
}

function sameSettings(left: NodeSettings, right: NodeSettings) {
  return (
    left.mode === right.mode &&
    left.nodes.length === right.nodes.length &&
    left.nodes.every((node, index) => node === right.nodes[index])
  )
}

function acceptSaved(snapshot: SaveSnapshot) {
  if (disposed || revision !== snapshot.revision || !confirmed) return
  // 自动模式隐藏的地址仍是页面草稿，不能被旧的有效节点列表替换。
  if (mode.value !== 'automatic') text.value = confirmed.nodes.join('\n')
  error.value = ''
  hasSaved.value = true
}

function save() {
  if (!loaded.value || loading.value) return
  const payload: NodeSettings = {
    mode: mode.value,
    nodes:
      mode.value === 'automatic'
        ? [...(confirmed?.nodes ?? [])]
        : text.value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
  }
  requestedRevision = revision
  const snapshot: SaveSnapshot = { payload, revision }
  if (active && sameSettings(active.payload, payload)) {
    active.revision = revision
    pending = null
    return
  }
  pending = snapshot
  if (!active) void drainSaves()
}

async function drainSaves() {
  if (!disposed) saving.value = true
  while (pending) {
    const snapshot: SaveSnapshot = pending
    pending = null
    if (confirmed && sameSettings(confirmed, snapshot.payload)) {
      acceptSaved(snapshot)
      continue
    }
    active = snapshot
    if (!disposed) {
      error.value = ''
      hasSaved.value = false
    }
    try {
      confirmed = unwrapResponse(
        await backend.command('connector_nodes_set', snapshot.payload),
        t('advanced.nodesTitle')
      )
      acceptSaved(snapshot)
    } catch (cause) {
      const failureMessage = getErrorMessage(cause)
      if (!disposed && revision === snapshot.revision) error.value = failureMessage
      // 统一通知器会抑制 unwrapResponse 已展示的错误，传输异常和离页失败仍可见。
      message.error(failureMessage)
    } finally {
      active = null
    }
  }
  if (!disposed) saving.value = false
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
