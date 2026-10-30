<template>
  <section class="resource-selector" :aria-label="t('plugins.resourcesTitle')">
    <strong>{{ t(scopeText[capability].title) }}</strong>
    <p>{{ t(scopeText[capability].note) }}</p>
    <div class="resource-toolbar">
      <NButton v-if="parent" size="small" :disabled="disabled" @click="open(null)">{{
        t('plugins.resourcesBack')
      }}</NButton>
      <NInput
        v-model:value="search"
        :disabled="disabled"
        :placeholder="t('plugins.resourcesSearch')"
        :inputProps="{ 'aria-label': t('plugins.resourcesSearch') }"
        @keyup.enter="load(false)"
      />
      <NButton size="small" :disabled="disabled" :loading="loading" @click="load(false)">{{
        t('common.refresh')
      }}</NButton>
    </div>
    <NCheckbox
      v-if="parent && capability === 'instances.read'"
      :checked="selected.includes(parent.resource_id)"
      :disabled="disabled || !parent.available"
      @update:checked="parent && select(parent, $event)"
      >{{ t('plugins.resourcesEntireRoot', { name: parent.label }) }}</NCheckbox
    >
    <NAlert v-if="selectionFull" type="warning" :showIcon="false">{{ t('plugins.resourcesLimitReached') }}</NAlert>
    <NAlert v-if="error" type="error" :showIcon="false">
      {{ t('plugins.resourcesLoadFailed') }}
      <NButton text :disabled="disabled" @click="load(false)">{{ t('common.retry') }}</NButton>
    </NAlert>
    <UiLoading v-if="loading && !items.length" mode="inline" />
    <NEmpty v-else-if="!items.length && !error" :description="t('plugins.resourcesEmpty')" />
    <ul v-else class="resource-list">
      <li v-for="item in items" :key="item.resource_id" class="resource-row">
        <div class="resource-choice">
          <span v-if="selectsInstances && item.kind === 'instance_root'" :title="item.label">{{ item.label }}</span>
          <NCheckbox
            v-else
            :checked="selected.includes(item.resource_id)"
            :disabled="disabled || !item.available || covered(item)"
            @update:checked="select(item, $event)"
          >
            <span :title="item.label">{{ item.kind === 'instance_root' ? rootLabel(item) : item.label }}</span>
          </NCheckbox>
          <small>{{ resourceHint(item) }}</small>
        </div>
        <NButton
          v-if="item.kind === 'instance_root' && item.available && capability !== 'instances.install'"
          size="small"
          :disabled="disabled || loading"
          @click="open(item)"
          >{{ t('plugins.resourcesBrowse') }}</NButton
        >
      </li>
    </ul>
    <div class="resource-footer">
      <span role="status">{{ t('plugins.resourcesSelected', { count: selected.length }) }}</span>
      <NButton text :disabled="disabled || !selected.length" @click="emit('update:selected', [])">{{
        t('plugins.resourcesClear')
      }}</NButton>
      <NButton v-if="cursor" size="small" :disabled="disabled" :loading="loading" @click="load(true)">{{
        t('plugins.resourcesMore')
      }}</NButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCheckbox, NEmpty, NInput } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiLoading from '@/components/ui/Loading.vue'
import { useRequestScope } from '@/composables/useRequestScope'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import type { PluginPermissions, PluginResourceCandidate, PluginInstanceCapability } from '@/types/plugins'

const props = defineProps<{
  view: PluginPermissions
  selected: string[]
  disabled: boolean
  capability: PluginInstanceCapability
}>()
const emit = defineEmits<{
  'update:selected': [value: string[]]
  revision: [value: number | undefined]
  busy: [value: boolean]
}>()
const { t } = useI18n()
const scopeText: Record<PluginInstanceCapability, { title: string; note: string }> = {
  'instances.read': { title: 'plugins.readResourcesTitle', note: 'plugins.resourcesNote' },
  'instances.write': { title: 'plugins.writeResourcesTitle', note: 'plugins.writeResourcesNote' },
  'instances.install': { title: 'plugins.installResourcesTitle', note: 'plugins.installResourcesNote' },
  'instances.launch': { title: 'plugins.launchResourcesTitle', note: 'plugins.launchResourcesNote' },
  'instances.stop': { title: 'plugins.stopResourcesTitle', note: 'plugins.stopResourcesNote' },
}
const selectsInstances = computed(() =>
  ['instances.write', 'instances.launch', 'instances.stop'].includes(props.capability)
)
const parent = ref<PluginResourceCandidate | null>(null)
const search = ref('')
const items = ref<PluginResourceCandidate[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const error = ref(false)
const selectionFull = ref(false)
const scope = useRequestScope(
  () =>
    `${props.view.installation_id}:${props.view.content_digest}:${props.capability}:${parent.value?.resource_id ?? ''}`
)

function covered(item: PluginResourceCandidate): boolean {
  return (
    props.capability === 'instances.read' &&
    item.kind === 'instance' &&
    !!parent.value &&
    props.selected.includes(parent.value.resource_id)
  )
}

function resourceHint(item: PluginResourceCandidate): string {
  if (!item.available) return t('plugins.resourcesUnavailable')
  if (covered(item)) return t('plugins.resourcesCovered')
  if (item.kind === 'instance') {
    if (props.capability === 'instances.write') return t('plugins.writeResourcesInstanceHint')
    if (props.capability === 'instances.launch') return t('plugins.launchResourcesInstanceHint')
    if (props.capability === 'instances.stop') return t('plugins.stopResourcesInstanceHint')
    return t('plugins.resourcesInstanceHint')
  }
  if (props.capability === 'instances.install') return t('plugins.installResourcesRootHint')
  return t(selectsInstances.value ? 'plugins.writeResourcesRootHint' : 'plugins.resourcesRootHint')
}

function rootLabel(item: PluginResourceCandidate): string {
  return t(
    props.capability === 'instances.install' ? 'plugins.installResourcesRootLabel' : 'plugins.resourcesEntireRoot',
    { name: item.label }
  )
}

function select(item: PluginResourceCandidate, checked: boolean): void {
  if (props.disabled || !item.available || (selectsInstances.value && item.kind === 'instance_root')) return
  const selected = checked
    ? [...new Set([...props.selected, item.resource_id])]
    : props.selected.filter((id) => id !== item.resource_id)
  selectionFull.value = selected.length > 128
  if (selected.length <= 128) emit('update:selected', selected)
}

function open(item: PluginResourceCandidate | null): void {
  parent.value = item
  search.value = ''
  void load(false)
}

async function load(more: boolean): Promise<void> {
  if (props.disabled) return
  const current = scope.begin()
  loading.value = true
  error.value = false
  emit('busy', true)
  emit('revision', undefined)
  if (!more) {
    items.value = []
    cursor.value = null
  }
  try {
    const page = await pluginManagementApi.permissionResources({
      installation_id: props.view.installation_id,
      content_digest: props.view.content_digest,
      capability: props.capability,
      parent_ref: parent.value?.resource_id ?? null,
      search: search.value,
      cursor: more ? cursor.value : null,
      limit: 25,
    })
    if (!current()) return
    items.value = more
      ? [
          ...items.value,
          ...page.items.filter((item) => !items.value.some((previous) => previous.resource_id === item.resource_id)),
        ]
      : page.items
    cursor.value = page.next_cursor
    emit('revision', page.catalog_revision)
  } catch {
    if (current()) error.value = true
  } finally {
    if (current()) {
      loading.value = false
      emit('busy', false)
    }
  }
}

watch(
  () => [props.view.installation_id, props.view.content_digest, props.capability] as const,
  () => {
    parent.value = null
    search.value = ''
    void load(false)
  },
  { immediate: true }
)
onUnmounted(() => {
  scope.invalidate()
  emit('busy', false)
})
</script>

<style scoped>
.resource-selector {
  display: grid;
  gap: 12px;
  border-top: 1px solid var(--ecl-border);
  padding-top: 12px;
}
.resource-selector p {
  margin: 0;
  color: var(--ecl-text-secondary);
}
.resource-toolbar,
.resource-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.resource-toolbar :deep(.n-input) {
  flex: 1;
  min-width: 140px;
}
.resource-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.resource-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ecl-border);
}
.resource-choice {
  min-width: 0;
  display: grid;
  gap: 4px;
  overflow-wrap: anywhere;
}
.resource-choice small {
  color: var(--ecl-text-secondary);
}
.resource-choice :deep(.n-checkbox__label) {
  overflow-wrap: anywhere;
}
.resource-footer > span {
  flex: 1;
}
</style>
