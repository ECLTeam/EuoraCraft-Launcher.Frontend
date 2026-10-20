<template>
  <FullscreenModal :visible="visible" :title="pluginTitle" :showFooter="false" :closable="!saving" @close="close">
    <div class="plugin-settings">
      <UiLoading v-if="loading" mode="inline" />
      <NAlert v-else-if="error" type="error" :showIcon="false">
        {{ error }}
        <NButton text @click="load">{{ t('common.retry') }}</NButton>
      </NAlert>
      <NEmpty v-else-if="!schema.length" :description="t('plugins.noSettings')" />
      <ul v-else class="plugin-setting-list">
        <li v-for="item in schema" :key="item.key" class="plugin-setting-row">
          <div class="plugin-setting-label">
            <strong>{{ item.description || item.key }}</strong
            ><span>{{ item.key }}</span>
          </div>
          <div class="plugin-setting-value">
            <NSwitch
              v-if="item.type === 'bool'"
              :aria-label="item.description || item.key"
              :disabled="saving"
              :value="Boolean(values[item.key])"
              @update:value="updateSetting(item.key, $event)"
            />
            <NInputNumber
              v-else-if="item.type === 'number'"
              :inputProps="{ 'aria-label': item.description || item.key }"
              class="setting-control"
              :disabled="saving"
              :value="numberValue(values[item.key])"
              @update:value="updateSetting(item.key, $event)"
            />
            <NSelect
              v-else-if="item.type === 'select'"
              :aria-label="item.description || item.key"
              class="setting-control"
              :disabled="saving"
              :value="stringValue(values[item.key])"
              :options="selectOptions(item)"
              @update:value="updateSetting(item.key, $event)"
            />
            <NInput
              v-else
              :inputProps="{ 'aria-label': item.description || item.key }"
              class="setting-control"
              :disabled="saving"
              :value="stringValue(values[item.key])"
              @update:value="values[item.key] = $event"
              @change="updateSetting(item.key, $event)"
            />
          </div>
        </li>
      </ul>

      <Transition name="fade">
        <NAlert v-if="savedHint" class="saved-hint" type="success" :showIcon="false">
          {{ t('plugins.settingSaved') }}
        </NAlert>
      </Transition>
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
import type { PluginInfo, PluginSettingSchema } from '@/types/plugins'

const props = defineProps<{
  visible: boolean
  plugin: PluginInfo | null
}>()

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const store = usePluginStore()
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const scope = useRequestScope(() => `${props.visible}:${props.plugin?.installation_id ?? props.plugin?.name ?? ''}`)
const schema = ref<PluginSettingSchema[]>([])
const values = ref<Record<string, unknown>>({})
const savedHint = ref(false)
let hintTimer: ReturnType<typeof setTimeout> | null = null

const pluginTitle = computed(() =>
  props.plugin ? t('plugins.settingsTitle', { name: props.plugin.title || props.plugin.name }) : ''
)

function close() {
  if (!saving.value) emit('close')
}

function stringValue(value: unknown): string {
  return value == null ? '' : String(value)
}

function numberValue(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function selectOptions(item: PluginSettingSchema) {
  const options = item.options ?? (Array.isArray(item.default) ? item.default : [])
  return options.map((option) => ({ label: String(option), value: String(option) }))
}

async function updateSetting(key: string, value: unknown) {
  if (!props.plugin || saving.value) return
  const pluginName = props.plugin.name
  const current = scope.begin()
  saving.value = true
  error.value = ''
  try {
    await store.updateSetting(pluginName, key, value)
    if (!current()) return
    values.value = { ...values.value, [key]: value }
    savedHint.value = true
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => {
      savedHint.value = false
    }, 1500)
  } catch {
    if (current()) error.value = t('plugins.settingSaveFailed')
  } finally {
    saving.value = false
  }
}

async function load(): Promise<void> {
  if (!props.visible || !props.plugin) return
  const name = props.plugin.name
  const current = scope.begin()
  loading.value = true
  error.value = ''
  savedHint.value = false
  try {
    const data = await store.getSettings(name)
    if (!current()) return
    schema.value = data.schema || []
    values.value = { ...data.values }
  } catch {
    if (current()) error.value = t('plugins.settingLoadFailed')
  } finally {
    if (current()) loading.value = false
  }
}

watch(
  () => [props.visible, props.plugin?.name] as const,
  () => {
    scope.invalidate()
    if (props.visible) void load()
  },
  { immediate: true }
)
onUnmounted(() => {
  if (hintTimer) clearTimeout(hintTimer)
})
</script>

<style scoped>
.plugin-setting-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.plugin-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-bottom: 1px solid var(--ecl-border);
}
.plugin-setting-label {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.plugin-setting-label span {
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
.plugin-setting-value {
  flex-shrink: 0;
}

.plugin-settings {
  position: relative;
  max-width: 720px;
  min-height: 240px;
  margin: 0 auto;
  padding: 20px;
}

.setting-control {
  width: 180px;
}

.saved-hint {
  position: sticky;
  bottom: 12px;
  width: fit-content;
  margin: 12px auto 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-emphasized);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
