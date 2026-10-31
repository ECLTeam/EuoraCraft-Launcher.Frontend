<template>
  <section class="local-resources" :aria-label="title">
    <strong>{{ title }}</strong>
    <p>{{ note }}</p>
    <div class="local-resource-toolbar">
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
    <NAlert v-if="error" type="error" :showIcon="false">
      {{ t('plugins.resourcesLoadFailed') }}
      <NButton text :disabled="disabled" @click="load(false)">{{ t('common.retry') }}</NButton>
    </NAlert>
    <UiLoading v-if="loading && !items.length" mode="inline" />
    <template v-else-if="!items.length && !error">
      <NEmpty
        :description="
          t(capability === 'accounts.read' ? 'plugins.accountResourcesEmpty' : 'plugins.javaResourcesEmpty')
        "
      />
      <NButton v-if="capability !== 'accounts.read'" size="small" :disabled="disabled" @click="emit('manage')">{{
        t('plugins.javaManage')
      }}</NButton>
    </template>
    <ul v-else>
      <li v-for="item in items" :key="item.resource_id">
        <NCheckbox
          :checked="selected.includes(item.resource_id)"
          :disabled="disabled || !item.available || loading"
          @update:checked="select(item.resource_id, $event)"
        >
          <span :title="item.label">{{ item.label }}</span>
        </NCheckbox>
        <small v-if="!item.available">{{ t('plugins.resourcesUnavailable') }}</small>
      </li>
    </ul>
    <NAlert v-if="full" type="warning" :showIcon="false">{{ t('plugins.resourcesLimitReached') }}</NAlert>
    <div class="local-resource-footer">
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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiLoading from '@/components/ui/Loading.vue'
import { useRequestScope } from '@/composables/useRequestScope'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import type { PluginPermissions, PluginResourceCandidate } from '@/types/plugins'

const props = defineProps<{
  view: PluginPermissions
  capability: 'java.read' | 'java.use' | 'accounts.read'
  selected: string[]
  disabled: boolean
}>()
const emit = defineEmits<{
  'update:selected': [value: string[]]
  revision: [value: number | undefined]
  busy: [value: boolean]
  manage: []
}>()
const { t } = useI18n()
const title = computed(() => {
  if (props.capability === 'accounts.read') return t('plugins.accountReadTitle')
  return t(props.capability === 'java.use' ? 'plugins.javaUseTitle' : 'plugins.javaReadTitle')
})
const note = computed(() => {
  if (props.capability === 'accounts.read') return t('plugins.accountReadNote')
  return t(props.capability === 'java.use' ? 'plugins.javaUseNote' : 'plugins.javaReadNote')
})
const search = ref('')
const items = ref<PluginResourceCandidate[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const error = ref(false)
const full = ref(false)
const scope = useRequestScope(() => `${props.view.installation_id}:${props.view.content_digest}:${props.capability}`)

function select(id: string, checked: boolean): void {
  if (props.disabled || loading.value || !items.value.some((item) => item.resource_id === id && item.available)) return
  const next = checked ? [...new Set([...props.selected, id])] : props.selected.filter((value) => value !== id)
  full.value = next.length > 128
  if (!full.value) emit('update:selected', next)
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
      search: search.value,
      cursor: more ? cursor.value : null,
      limit: 25,
    })
    if (!current()) return
    items.value = more
      ? [
          ...items.value,
          ...page.items.filter((item) => !items.value.some((old) => old.resource_id === item.resource_id)),
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
    search.value = ''
    void load(false)
  },
  { immediate: true }
)
</script>

<style scoped>
.local-resources {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.local-resources p {
  margin: 0;
  color: var(--ecl-text-secondary);
  line-height: 1.6;
}
.local-resource-toolbar,
.local-resource-footer {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.local-resource-toolbar .n-input {
  flex: 1;
  min-width: 120px;
}
.local-resources ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}
.local-resources li {
  min-width: 0;
  overflow-wrap: anywhere;
}
.local-resources small {
  display: block;
  color: var(--ecl-text-secondary);
}
.local-resource-footer span {
  margin-right: auto;
}
</style>
