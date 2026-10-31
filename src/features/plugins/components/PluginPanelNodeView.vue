<template>
  <p v-if="node.type === 'text'" class="panel-text" :class="`is-${node.tone ?? 'default'}`">{{ node.text }}</p>

  <section v-else-if="node.type === 'group'" class="panel-group">
    <h4 v-if="node.title" class="panel-group-title">{{ node.title }}</h4>
    <PluginPanelNodeView
      v-for="(child, index) in node.children"
      :key="index"
      :node="child"
      :data="data"
      :settings="settings"
      :busy="busy"
      @action="(command, args) => emit('action', command, args)"
      @setting="(key, value) => emit('setting', key, value)"
    />
  </section>

  <div v-else-if="node.type === 'button'" class="panel-action">
    <NPopconfirm v-if="node.confirm" @positiveClick="emit('action', node.command, node.args ?? {})">
      <template #trigger>
        <NButton :type="buttonType(node.tone)" size="small" :disabled="busy">{{ node.label }}</NButton>
      </template>
      {{ node.confirm }}
    </NPopconfirm>
    <NButton
      v-else
      :type="buttonType(node.tone)"
      size="small"
      :disabled="busy"
      @click="emit('action', node.command, node.args ?? {})"
    >
      {{ node.label }}
    </NButton>
  </div>

  <div v-else-if="node.type === 'setting'" class="panel-setting">
    <label class="panel-setting-label" :for="`panel-setting-${node.key}`">{{ settingLabel }}</label>
    <NSwitch
      v-if="settingSchema?.type === 'bool'"
      :id="`panel-setting-${node.key}`"
      :value="Boolean(settingValue)"
      :disabled="busy"
      @update:value="emit('setting', node.key, $event)"
    />
    <NInputNumber
      v-else-if="settingSchema?.type === 'number'"
      :inputProps="{ id: `panel-setting-${node.key}` }"
      class="panel-control"
      :value="numberValue"
      :disabled="busy"
      @update:value="emit('setting', node.key, $event)"
    />
    <NSelect
      v-else-if="settingSchema?.type === 'select'"
      :inputProps="{ id: `panel-setting-${node.key}` }"
      class="panel-control"
      :value="stringValue"
      :options="selectOptions"
      :disabled="busy"
      @update:value="emit('setting', node.key, $event)"
    />
    <NInput
      v-else
      :inputProps="{ id: `panel-setting-${node.key}` }"
      class="panel-control"
      :value="stringValue"
      :disabled="busy"
      @update:value="emit('setting', node.key, $event)"
    />
  </div>

  <div v-else-if="node.type === 'list'" class="panel-list">
    <table v-if="rows.length" class="panel-table">
      <thead>
        <tr>
          <th v-for="column in node.columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <td v-for="column in node.columns" :key="column.key">{{ row[column.key] ?? '' }}</td>
        </tr>
      </tbody>
    </table>
    <NEmpty v-else :description="node.empty_text || t('plugins.panelListEmpty')" />
  </div>

  <div v-else-if="node.type === 'task'" class="panel-task">
    <NProgress
      type="line"
      :percentage="task?.percent ?? 0"
      :status="progressStatus"
      :showIndicator="false"
      :aria-label="t('plugins.panelTaskProgress')"
    />
    <span class="panel-task-detail">{{ taskDetail }}</span>
  </div>

  <NAlert v-else type="warning" :showIcon="false">{{ t('plugins.panelUnsupportedNode') }}</NAlert>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NInput, NInputNumber, NPopconfirm, NProgress, NSelect, NSwitch } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  PluginPanelData,
  PluginPanelListNode,
  PluginPanelNode,
  PluginPanelSettingNode,
  PluginPanelTaskNode,
  PluginSettingsData,
} from '@/types/plugins'

defineOptions({ name: 'PluginPanelNodeView' })

const props = defineProps<{
  node: PluginPanelNode
  data: PluginPanelData
  settings: PluginSettingsData | null
  busy: boolean
}>()

const emit = defineEmits<{
  action: [command: string, args: Record<string, unknown>]
  setting: [key: string, value: unknown]
}>()

const { t } = useI18n()

function buttonType(tone: 'default' | 'primary' | 'danger' | undefined) {
  if (tone === 'primary') return 'primary'
  if (tone === 'danger') return 'error'
  return 'default'
}

const settingNode = computed<PluginPanelSettingNode | null>(() => (props.node.type === 'setting' ? props.node : null))

const settingSchema = computed(() => {
  const key = settingNode.value?.key
  return key ? props.settings?.schema.find((item) => item.key === key) : undefined
})

const settingLabel = computed(() => settingSchema.value?.description || settingNode.value?.key || '')

const settingValue = computed(() => {
  const key = settingNode.value?.key
  return key ? props.settings?.values[key] : undefined
})

const stringValue = computed(() => (typeof settingValue.value === 'string' ? settingValue.value : ''))

const numberValue = computed(() => (typeof settingValue.value === 'number' ? settingValue.value : 0))

const selectOptions = computed(() =>
  (settingSchema.value?.options ?? []).map((option) => ({ label: option, value: option }))
)

const rows = computed(() => {
  const node = props.node.type === 'list' ? (props.node as PluginPanelListNode) : null
  return node ? (props.data.lists[node.source] ?? []) : []
})

const task = computed(() => {
  const node = props.node.type === 'task' ? (props.node as PluginPanelTaskNode) : null
  return node ? props.data.tasks[node.source] : undefined
})

const progressStatus = computed(() => {
  if (task.value?.state === 'succeeded') return 'success'
  if (task.value?.state === 'failed') return 'error'
  return 'default'
})

const taskDetail = computed(() => {
  if (task.value?.detail) return task.value.detail
  const state = task.value?.state ?? 'pending'
  return t(`plugins.panelTaskState_${state}`)
})
</script>

<style scoped>
.panel-text {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.panel-text.is-muted {
  color: var(--text-secondary);
}

.panel-text.is-warning {
  color: var(--warning);
}

.panel-group {
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-tertiary);
  border-radius: var(--r-md);
  background: var(--bg-secondary);
}

.panel-group-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.panel-action {
  margin-bottom: 10px;
}

.panel-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.panel-setting-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.panel-control {
  width: 220px;
  max-width: 60%;
}

.panel-list {
  margin-bottom: 12px;
}

.panel-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.panel-table th,
.panel-table td {
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-tertiary);
  color: var(--text-primary);
}

.panel-table th {
  font-weight: 500;
  color: var(--text-secondary);
}

.panel-task {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.panel-task-detail {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
