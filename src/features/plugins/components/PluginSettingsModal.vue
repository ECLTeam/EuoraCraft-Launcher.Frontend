<template>
  <FullscreenModal
    :visible="visible"
    :title="t('plugins.settingsCenter')"
    :showFooter="false"
    :closable="pendingNames.length === 0"
    @close="emit('close')"
  >
    <div class="plugin-settings-center">
      <aside class="plugin-settings-navigation ecl-surface" :aria-label="t('plugins.pluginList')">
        <div class="plugin-settings-nav-title">
          <UiIcon name="plugin" :size="18" />
          <span>{{ t('plugins.pluginList') }}</span>
        </div>
        <div class="plugin-settings-search">
          <NInput
            v-model:value="search"
            size="small"
            clearable
            :placeholder="t('plugins.searchPlugins')"
            :inputProps="{ 'aria-label': t('plugins.searchPlugins') }"
          >
            <template #prefix><UiIcon name="search" :size="14" /></template>
          </NInput>
        </div>
        <nav class="plugin-settings-list" :aria-label="t('plugins.pluginList')">
          <button
            v-for="item in filteredPlugins"
            :key="identity(item)"
            type="button"
            class="plugin-settings-choice"
            :class="{ selected: identity(item) === selectedId }"
            :aria-current="identity(item) === selectedId ? 'true' : undefined"
            :title="`${item.title || item.name}\n${item.name}`"
            @click="select(item)"
          >
            <UiIcon class="plugin-settings-choice-icon" :name="item.icon || 'plugin'" :size="22" />
            <span class="plugin-settings-choice-name">{{ item.title || item.name }}</span>
          </button>
          <NEmpty v-if="!filteredPlugins.length" :description="t('plugins.noPlugins')" size="small" />
        </nav>
      </aside>
      <section class="plugin-settings-detail ecl-surface" :aria-label="t('plugins.configuration')">
        <template v-if="selected">
          <header class="plugin-settings-heading">
            <div class="plugin-settings-title">
              <h2 :title="`${selected.title || selected.name}\n${selected.name}`">
                {{ selected.title || selected.name }}
              </h2>
              <NTag class="plugin-settings-version" size="small" :bordered="false">v{{ selected.version }}</NTag>
            </div>
            <NButton
              v-if="selected.source === 'directory' && selected.installation_id"
              size="small"
              @click="emit('openDirectory', selected)"
              >{{ t('plugins.openDirectory') }}</NButton
            >
          </header>
          <div
            class="plugin-settings-content"
            :class="{
              'plugin-settings-content--state':
                loading || loadError || !data?.schema.length || data?.editable === false,
            }"
          >
            <UiLoading v-if="loading" mode="inline" />
            <NAlert v-else-if="loadError" type="error" :showIcon="false">
              {{ loadError }} <NButton text @click="load">{{ t('common.retry') }}</NButton>
            </NAlert>
            <NAlert v-else-if="data?.editable === false" type="info" :showIcon="false">
              {{ t('plugins.settingsUnavailable') }}
              <NButton v-if="selected.status !== 'enabled'" text @click="emit('activate', selected)">
                {{ t('plugins.enable') }}</NButton
              >
            </NAlert>
            <NEmpty v-else-if="!data?.schema.length" :description="t('plugins.noSettings')" />
            <ul v-else class="plugin-setting-list">
              <li v-for="item in data.schema" :key="item.key" class="plugin-setting-row">
                <div class="plugin-setting-label">
                  <strong>{{ item.description || item.key }}</strong> <span>{{ item.key }}</span>
                </div>
                <div class="plugin-setting-value">
                  <NSwitch
                    v-if="item.type === 'bool'"
                    size="small"
                    :aria-label="item.description || item.key"
                    :disabled="isSaving"
                    :value="values[item.key] === true"
                    @update:value="save(item.key, $event)"
                  />
                  <NInputNumber
                    v-else-if="item.type === 'number'"
                    size="small"
                    class="setting-control"
                    :disabled="isSaving"
                    :inputProps="{ 'aria-label': item.description || item.key }"
                    :value="numberValue(values[item.key])"
                    @update:value="saveNumber(item.key, $event)"
                  />
                  <NSelect
                    v-else-if="item.type === 'select'"
                    size="small"
                    class="setting-control"
                    :disabled="isSaving"
                    :aria-label="item.description || item.key"
                    :value="stringValue(values[item.key])"
                    :options="(item.options ?? []).map((value) => ({ label: value, value }))"
                    @update:value="save(item.key, $event)"
                  />
                  <NInput
                    v-else
                    size="small"
                    class="setting-control"
                    :disabled="isSaving"
                    :inputProps="{ 'aria-label': item.description || item.key }"
                    :value="stringValue(values[item.key])"
                    @update:value="values[item.key] = $event"
                    @change="save(item.key, $event)"
                  />
                </div>
              </li>
            </ul>
            <NAlert v-if="saveError" class="plugin-settings-feedback" type="error" :showIcon="false">
              {{ saveError }}
              <NButton v-if="failedWrite" text @click="retrySave">{{ t('common.retry') }}</NButton>
              <NButton text @click="load">{{ t('plugins.reloadSettings') }}</NButton>
            </NAlert>
            <p v-if="isSaving" role="status" class="plugin-settings-feedback">{{ t('plugins.settingSaving') }}</p>
            <p v-else-if="saved" role="status" class="plugin-settings-feedback">{{ t('plugins.settingSaved') }}</p>
          </div>
        </template>
        <NEmpty v-else :description="t('plugins.selectPlugin')" />
      </section>
    </div>
  </FullscreenModal>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NInput, NInputNumber, NSelect, NSwitch, NTag } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useRequestScope } from '@/composables/useRequestScope'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginInfo, PluginSettingsData } from '@/types/plugins'
import { configValuesEqual } from '@/utils/configValue'
import { getErrorMessage } from '@/utils/error'

const props = defineProps<{ visible: boolean; plugins: PluginInfo[]; plugin: PluginInfo | null }>()
const emit = defineEmits<{
  close: []
  activate: [plugin: PluginInfo]
  openDirectory: [plugin: PluginInfo]
}>()
const { t } = useI18n()
const store = usePluginStore()
const search = ref('')
const selectedId = ref('')
const candidates = computed(() => props.plugins.filter((item) => !item.is_system))
const filteredPlugins = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return candidates.value.filter((item) => `${item.title} ${item.name}`.toLocaleLowerCase().includes(query))
})
function identity(plugin: PluginInfo): string {
  return plugin.installation_id ?? plugin.name
}
const selected = computed(() => candidates.value.find((item) => identity(item) === selectedId.value))
const target = computed(
  () =>
    `${props.visible}:${selectedId.value}:${selected.value?.content_digest}:${selected.value?.status}:${selected.value?.development?.reload_count}`
)
const scope = useRequestScope(() => target.value)
const data = ref<PluginSettingsData | null>(null)
const values = ref<Record<string, unknown>>({})
const loading = ref(false)
const loadError = ref('')
const saveError = ref('')
const failedWrite = ref<{ key: string; value: unknown } | null>(null)
const pendingNames = ref<string[]>([])
const isSaving = computed(() => !!selected.value && pendingNames.value.includes(selected.value.name))
const saved = ref(false)
let unlisten: (() => void) | null = null

function select(plugin: PluginInfo): void {
  selectedId.value = identity(plugin)
}
function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
function saveNumber(key: string, value: number | null): void {
  if (value !== null && Number.isFinite(value)) void save(key, value)
}

async function load(): Promise<void> {
  const plugin = selected.value
  if (!props.visible || !plugin) return
  const current = scope.begin()
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  failedWrite.value = null
  saved.value = false
  data.value = null
  values.value = {}
  try {
    const settings = await store.getSettings(plugin.name)
    if (!current()) return
    data.value = settings
    values.value = { ...settings.values }
  } catch {
    if (current()) loadError.value = t('plugins.settingLoadFailed')
  } finally {
    if (current()) loading.value = false
  }
}

async function save(key: string, value: unknown): Promise<void> {
  const plugin = selected.value
  const settings = data.value
  if (!plugin || !settings || isSaving.value || loading.value) return
  if (configValuesEqual(settings.values[key], value)) return
  const current = scope.begin()
  pendingNames.value = [...pendingNames.value, plugin.name]
  saveError.value = ''
  saved.value = false
  failedWrite.value = null
  try {
    await store.updateSetting(plugin.name, key, value, settings)
    if (!current()) return
    const updated = await store.getSettings(plugin.name)
    if (!current()) return
    data.value = updated
    values.value = { ...updated.values }
    saved.value = true
  } catch (cause) {
    if (!current()) return
    const conflict = /PLUGIN_(REVISION_CONFLICT|SETTING_SCHEMA_CHANGED)/.test(getErrorMessage(cause))
    saveError.value = t(conflict ? 'plugins.settingsConflict' : 'plugins.settingSaveFailed')
    if (!conflict) failedWrite.value = { key, value }
  } finally {
    pendingNames.value = pendingNames.value.filter((name) => name !== plugin.name)
  }
}

function retrySave(): void {
  if (failedWrite.value) void save(failedWrite.value.key, failedWrite.value.value)
}

watch(
  () => props.visible,
  (visible) => {
    unlisten?.()
    unlisten = null
    if (visible) {
      const initial = props.plugin ?? candidates.value[0]
      selectedId.value = initial ? identity(initial) : ''
      unlisten = store.subscribeSettingsChanges(() => {
        if (!isSaving.value && props.visible) void load()
      })
    }
  },
  { immediate: true }
)
watch(
  () => props.plugin,
  (plugin) => {
    if (props.visible && plugin) select(plugin)
  }
)
watch(candidates, (items) => {
  if (!items.some((item) => identity(item) === selectedId.value)) selectedId.value = items[0] ? identity(items[0]) : ''
})
watch(
  target,
  () => {
    scope.invalidate()
    data.value = null
    loadError.value = ''
    saveError.value = ''
    saved.value = false
    failedWrite.value = null
    if (props.visible && selected.value) void load()
  },
  { immediate: true }
)
onUnmounted(() => unlisten?.())
</script>

<style scoped>
.plugin-settings-center {
  display: grid;
  grid-template-columns: clamp(180px, 22vw, 240px) minmax(0, 1fr);
  gap: var(--s-md);
  height: 100%;
  min-height: 0;
  padding: var(--ecl-page-padding);
  box-sizing: border-box;
}
.plugin-settings-navigation,
.plugin-settings-detail {
  min-width: 0;
  min-height: 0;
}
.plugin-settings-navigation {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.plugin-settings-nav-title {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--s-sm);
  height: 44px;
  padding: 0 var(--s-md);
  border-bottom: 1px solid var(--ecl-border);
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 650;
}
.plugin-settings-nav-title :deep(svg) {
  color: var(--primary);
}
.plugin-settings-search {
  flex-shrink: 0;
  padding: var(--s-sm);
}
.plugin-settings-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: var(--s-xs);
  overflow: auto;
  padding: 0 var(--s-sm) var(--s-sm);
}
.plugin-settings-choice {
  display: flex;
  align-items: center;
  gap: var(--s-sm);
  min-height: var(--ecl-control-height);
  width: 100%;
  min-width: 0;
  flex-shrink: 0;
  padding: var(--s-sm) var(--s-md);
  text-align: start;
  border: 0;
  border-radius: var(--ecl-radius-control);
  color: var(--ecl-text);
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.plugin-settings-choice:hover {
  background: var(--ecl-hover);
}
.plugin-settings-choice.selected {
  color: var(--primary);
  background: var(--ecl-primary-alpha);
}
.plugin-settings-choice:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
.plugin-settings-choice-icon {
  flex-shrink: 0;
}
.plugin-settings-choice-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plugin-setting-label span {
  font-size: 12px;
  color: var(--ecl-text-secondary);
}
.plugin-settings-detail {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.plugin-settings-heading {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-md);
  min-height: 44px;
  padding: var(--s-sm) var(--s-lg);
  border-bottom: 1px solid var(--ecl-border);
}
.plugin-settings-title {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: var(--s-sm);
}
.plugin-settings-version,
.plugin-settings-heading > .n-button {
  flex-shrink: 0;
}
.plugin-settings-heading h2 {
  margin: 0;
  min-width: 0;
  font-size: 13px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plugin-settings-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 var(--s-lg) var(--s-lg);
}
.plugin-settings-content--state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--s-lg);
}
.plugin-setting-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.plugin-setting-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-md);
  padding: var(--s-lg) 0;
  border-bottom: 1px solid var(--ecl-border);
}
.plugin-setting-row:last-child {
  border-bottom: 0;
}
.plugin-setting-label {
  display: grid;
  gap: var(--s-xs);
  min-width: 0;
  flex: 1 1 160px;
  overflow-wrap: anywhere;
}
.plugin-setting-label strong {
  font-size: 13px;
  font-weight: 500;
}
.plugin-setting-value {
  min-width: 0;
  max-width: 100%;
}
.setting-control {
  width: 200px;
  max-width: 100%;
}
.plugin-settings-feedback {
  margin: var(--s-md) 0 0;
  overflow-wrap: anywhere;
}
</style>
