<template>
  <section class="resource-selector" :aria-label="t('plugins.gameDirectories')">
    <strong>{{ t('plugins.gameDirectories') }}</strong>
    <p>{{ t(capability === 'instances.manage' ? 'plugins.manageScopeNote' : 'plugins.readScopeNote') }}</p>
    <div class="resource-toolbar">
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
    <NAlert v-if="error" type="error" :showIcon="false"
      >{{ t('plugins.resourcesLoadFailed') }}
      <NButton text :disabled="disabled" @click="load(false)">{{ t('common.retry') }}</NButton>
    </NAlert>
    <UiLoading v-if="loading && !items.length" mode="inline" />
    <NEmpty v-else-if="!items.length && !error" :description="t('plugins.gameDirectoriesEmpty')" />
    <ul v-else class="resource-list">
      <li v-for="item in items" :key="item.resource_id" class="resource-row">
        <NCheckbox
          :checked="selected.includes(item.resource_id)"
          :disabled="disabled || !item.available"
          @update:checked="select(item, $event)"
        >
          <span :title="item.label">{{ item.label }}</span>
          <small v-if="!item.available">{{ t('plugins.resourcesUnavailable') }}</small>
          <small v-else-if="item.is_default">{{ t('plugins.currentGameDirectory') }}</small>
        </NCheckbox>
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
import { onUnmounted, ref, watch } from 'vue'
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
const search = ref('')
const items = ref<PluginResourceCandidate[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const error = ref(false)
let initializedSelection = false
const scope = useRequestScope(
  () => props.view.installation_id + ':' + props.view.content_digest + ':' + props.capability
)
function select(item: PluginResourceCandidate, checked: boolean): void {
  if (props.disabled || !item.available) return
  const selected = checked
    ? [...new Set([...props.selected, item.resource_id])]
    : props.selected.filter((id) => id !== item.resource_id)
  if (selected.length <= 128) emit('update:selected', selected)
}
async function load(more: boolean): Promise<void> {
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
    if (!initializedSelection && !search.value) {
      initializedSelection = true
      const recommended = page.items.find((item) => item.available && item.is_default)
      if (props.view.revision === 0 && !props.selected.length && recommended)
        emit('update:selected', [recommended.resource_id])
    }
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
  () => [props.view.installation_id, props.view.content_digest] as const,
  () => {
    initializedSelection = false
    search.value = ''
  }
)
watch(
  () => [props.view.installation_id, props.view.content_digest, props.capability] as const,
  () => void load(false),
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
  min-width: 0;
  padding: 8px 0;
  border-bottom: 1px solid var(--ecl-border);
  overflow-wrap: anywhere;
}
.resource-row small {
  display: block;
  color: var(--ecl-text-secondary);
}
.resource-footer > span {
  flex: 1;
}
</style>
