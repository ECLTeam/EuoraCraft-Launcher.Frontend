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
        <NInput
          v-model:value="search"
          clearable
          :placeholder="t('plugins.searchPlugins')"
          :inputProps="{ 'aria-label': t('plugins.searchPlugins') }"
        />
        <nav class="plugin-settings-list" :aria-label="t('plugins.pluginList')">
          <button
            v-for="item in filteredPlugins"
            :key="identity(item)"
            type="button"
            class="plugin-settings-choice"
            :class="{ selected: identity(item) === selectedId }"
            :aria-current="identity(item) === selectedId ? 'true' : undefined"
            :title="item.title || item.name"
            @click="select(item)"
          >
            <strong>{{ item.title || item.name }}</strong>
            <span>{{ item.name }}</span>
          </button>
          <NEmpty v-if="!filteredPlugins.length" :description="t('plugins.noPlugins')" size="small" />
        </nav>
      </aside>
      <section class="plugin-settings-detail ecl-surface" :aria-label="t('plugins.configuration')">
        <template v-if="selected">
          <header class="plugin-settings-heading">
            <div>
              <h2 :title="selected.title || selected.name">{{ selected.title || selected.name }}</h2>
              <p>{{ selected.name }} · {{ selected.version }}</p>
            </div>
            <NButton
              v-if="selected.source === 'directory' && selected.installation_id"
              size="small"
              @click="emit('openDirectory', selected)"
              >{{ t('plugins.openDirectory') }}</NButton
            >
          </header>
          <div class="plugin-settings-content">
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
                    :aria-label="item.description || item.key"
                    :disabled="isSaving"
                    :value="values[item.key] === true"
                    @update:value="save(item.key, $event)"
                  />
                  <NInputNumber
                    v-else-if="item.type === 'number'"
                    class="setting-control"
                    :disabled="isSaving"
                    :inputProps="{ 'aria-label': item.description || item.key }"
                    :value="numberValue(values[item.key])"
                    @update:value="saveNumber(item.key, $event)"
                  />
                  <NSelect
                    v-else-if="item.type === 'select'"
                    class="setting-control"
                    :disabled="isSaving"
                    :aria-label="item.description || item.key"
                    :value="stringValue(values[item.key])"
                    :options="(item.options ?? []).map((value) => ({ label: value, value }))"
                    @update:value="save(item.key, $event)"
                  />
                  <NInput
                    v-else
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
import { NAlert, NButton, NEmpty, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useRequestScope } from '@/composables/useRequestScope'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginInfo, PluginSettingsData } from '@/types/plugins'
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
  grid-template-columns: minmax(180px, 26%) minmax(0, 1fr);
  gap: var(--s-md, 16px);
  height: 100%;
  min-height: 0;
  padding: var(--s-lg, 24px);
  box-sizing: border-box;
}
.plugin-settings-navigation,
.plugin-settings-detail {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--ecl-border);
  border-radius: var(--radius-lg, 12px);
}
.plugin-settings-navigation {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.plugin-settings-list {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}
.plugin-settings-choice {
  display: grid;
  gap: 4px;
  width: 100%;
  flex-shrink: 0;
  padding: 12px;
  text-align: start;
  border: 1px solid transparent;
  border-radius: var(--radius-md, 8px);
  color: var(--ecl-text);
  background: transparent;
  cursor: pointer;
}
.plugin-settings-choice:hover,
.plugin-settings-choice.selected {
  background: var(--ecl-hover);
  border-color: var(--ecl-border);
}
.plugin-settings-choice:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}
.plugin-settings-choice strong,
.plugin-settings-choice span {
  overflow-wrap: anywhere;
}
.plugin-settings-choice span,
.plugin-settings-heading p,
.plugin-setting-label span {
  font-size: 12px;
  color: var(--ecl-text-secondary);
}
.plugin-settings-detail {
  display: flex;
  flex-direction: column;
  padding: 20px;
}
.plugin-settings-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ecl-border);
}
.plugin-settings-heading > div {
  min-width: 0;
}
.plugin-settings-heading h2 {
  margin: 0;
  font-size: 18px;
  overflow-wrap: anywhere;
}
.plugin-settings-heading p {
  margin: 6px 0 0;
  overflow-wrap: anywhere;
}
.plugin-settings-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-top: 16px;
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
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--ecl-border);
}
.plugin-setting-label {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 160px;
  overflow-wrap: anywhere;
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
  margin: 16px 0 0;
  overflow-wrap: anywhere;
}
</style>
