<template>
  <FullscreenModal :visible="visible" :title="panelTitle" :showFooter="false" :closable="!busy" @close="close">
    <div ref="bodyRef" class="plugin-panel">
      <UiLoading v-if="loading" mode="inline" />

      <NAlert v-else-if="error" type="error" :showIcon="false">
        {{ error }}
        <NButton text :disabled="busy" @click="load">{{ t('common.retry') }}</NButton>
      </NAlert>

      <NEmpty v-else-if="!panels.length" :description="t('plugins.panelEmpty')" />

      <template v-else>
        <p v-if="activePanel?.description" class="plugin-panel-description">{{ activePanel.description }}</p>

        <NTabs v-if="panels.length > 1" :value="activeKey" type="segment" @update:value="selectPanel">
          <NTab v-for="item in panels" :key="item.key" :name="item.key">{{ item.title }}</NTab>
        </NTabs>

        <NAlert v-if="actionError" type="error" :showIcon="false" class="plugin-panel-error">
          {{ actionError }}
        </NAlert>

        <div class="plugin-panel-body" :aria-busy="busy">
          <PluginPanelNodeView
            v-for="(node, index) in activePanel?.nodes ?? []"
            :key="index"
            :node="node"
            :data="data"
            :settings="settings"
            :busy="busy"
            @action="runAction"
            @setting="updateSetting"
          />
        </div>

        <Transition name="fade">
          <p v-if="busy" class="plugin-panel-busy">{{ t('plugins.panelRunning') }}</p>
        </Transition>
      </template>
    </div>
  </FullscreenModal>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NTab, NTabs } from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import UiLoading from '@/components/ui/Loading.vue'
import type {
  PluginInfo,
  PluginPanelData,
  PluginPanelDefinition,
  PluginPanelNode,
  PluginSettingsData,
} from '@/types/plugins'
import { getErrorMessage } from '@/utils/error'
import { pluginManagementApi } from '../api/pluginManagementApi'
import PluginPanelNodeView from './PluginPanelNodeView.vue'

const props = defineProps<{
  visible: boolean
  plugin: PluginInfo | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const panels = ref<PluginPanelDefinition[]>([])
const activeKey = ref('')
const data = ref<PluginPanelData>({ lists: {}, tasks: {} })
const settings = ref<PluginSettingsData | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const actionError = ref('')
const bodyRef = ref<HTMLElement | null>(null)

const panelTitle = computed(() =>
  props.plugin?.title ? `${props.plugin.title} · ${t('plugins.panelTitle')}` : t('plugins.panelTitle')
)

const activePanel = computed(() => panels.value.find((item) => item.key === activeKey.value) ?? panels.value[0])

const SUPPORTED_NODES = new Set(['text', 'group', 'button', 'setting', 'list', 'task'])

function hasUnknownNode(nodes: PluginPanelNode[]): boolean {
  return nodes.some(
    (node) => !SUPPORTED_NODES.has(node.type) || (node.type === 'group' && hasUnknownNode(node.children))
  )
}

async function load(): Promise<void> {
  const plugin = props.plugin
  if (!plugin) return
  loading.value = true
  error.value = ''
  actionError.value = ''
  try {
    panels.value = await pluginManagementApi.getPanels(plugin.name)
    if (panels.value.some((item) => hasUnknownNode(item.nodes))) {
      panels.value = []
      error.value = t('plugins.panelUnsupported')
      return
    }
    activeKey.value = panels.value[0]?.key ?? ''
    await refresh()
    await nextTick()
    bodyRef.value?.querySelector<HTMLElement>('button')?.focus()
  } catch (cause) {
    error.value = `${t('plugins.panelLoadFailed')}: ${getErrorMessage(cause)}`
  } finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  const plugin = props.plugin
  const key = activeKey.value
  if (!plugin || !key) return
  const [panelData, panelSettings] = await Promise.all([
    pluginManagementApi.getPanelData(plugin.name, key),
    pluginManagementApi.getSettings(plugin.name),
  ])
  if (activeKey.value !== key) return
  data.value = panelData
  settings.value = panelSettings
}

async function selectPanel(key: string): Promise<void> {
  activeKey.value = key
  actionError.value = ''
  await refresh()
}

async function runAction(command: string, args: Record<string, unknown>): Promise<void> {
  const plugin = props.plugin
  if (!plugin || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await pluginManagementApi.runPanelAction(plugin.name, command, args)
  } catch (cause) {
    actionError.value = `${t('plugins.panelActionFailed')}: ${getErrorMessage(cause)}`
  } finally {
    busy.value = false
  }
  await refresh()
}

async function updateSetting(key: string, value: unknown): Promise<void> {
  const plugin = props.plugin
  if (!plugin || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await pluginManagementApi.updateSetting(plugin.name, key, value, settings.value?.revision)
  } catch (cause) {
    actionError.value = `${t('plugins.panelActionFailed')}: ${getErrorMessage(cause)}`
  } finally {
    busy.value = false
  }
  await refresh()
}

function close(): void {
  if (busy.value) return
  panels.value = []
  data.value = { lists: {}, tasks: {} }
  settings.value = null
  error.value = ''
  actionError.value = ''
  emit('close')
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void load()
  },
  { immediate: true }
)
</script>

<style scoped>
.plugin-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
}

.plugin-panel-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.plugin-panel-error {
  margin: 0;
}

.plugin-panel-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plugin-panel-busy {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
