<template>
  <div class="plugins-page">
    <section class="plugins-panel ecl-surface">
      <header class="plugins-toolbar">
        <NInput
          v-model:value="searchQuery"
          class="plugins-search"
          clearable
          size="small"
          :placeholder="t('plugins.searchPlugins')"
        >
          <template #prefix><UiIcon name="search" :size="14" /></template>
        </NInput>

        <NTabs v-if="isFolia" v-model:value="activeFilter" class="plugins-filters" type="segment" size="small">
          <NTab v-for="filter in filters" :key="filter.key" :name="filter.key">{{ filter.label }}</NTab>
        </NTabs>
        <NRadioGroup v-else v-model:value="activeFilter" class="plugins-filters" size="small">
          <NRadioButton v-for="filter in filters" :key="filter.key" :value="filter.key">
            {{ filter.label }}
          </NRadioButton>
        </NRadioGroup>

        <div class="plugins-toolbar-actions">
          <NButton size="small" @click="recoveryVisible = true">{{ t('plugins.fileRecoveryTitle') }}</NButton>
          <NDropdown :options="installOptions" trigger="click" @select="handleInstallSelect">
            <NButton type="primary" size="small">
              <template #icon><UiIcon name="add" :size="14" /></template>
              {{ t('plugins.install') }}
            </NButton>
          </NDropdown>
        </div>
      </header>

      <PluginSlotHost slotId="plugin-slot-plugins-toolbar-after" class="plugin-slot-container" />

      <div class="plugins-table-header">
        <span>{{ t('plugins.pluginName') }}</span>
        <span>{{ t('plugins.version') }}</span>
        <span>{{ t('plugins.status') }}</span>
        <span></span>
      </div>

      <div class="plugins-list-body">
        <UiLoading v-if="loading && !plugins.length" mode="block" class="plugins-spin" />
        <NAlert v-else-if="listError" type="error" :showIcon="false">
          {{ t('plugins.loadFailed') }}
          <NButton text @click="refreshPermissions">{{ t('common.retry') }}</NButton>
        </NAlert>
        <div v-else>
          <div v-if="filteredPlugins.length" class="plugins-list">
            <article v-for="plugin in filteredPlugins" :key="plugin.name" class="plugin-row">
              <div class="plugin-identity">
                <div class="plugin-icon">
                  <UiIcon :name="plugin.icon || 'plugin'" :size="16" />
                </div>
                <div class="plugin-content">
                  <span class="plugin-name" :title="plugin.title || plugin.name">{{
                    plugin.title || plugin.name
                  }}</span>
                  <div class="plugin-description" :title="pluginDescription(plugin)">
                    {{ pluginDescription(plugin) }}
                  </div>
                  <div v-if="plugin.error" class="plugin-error" :title="pluginError(plugin)">
                    {{ pluginError(plugin) }}
                  </div>
                </div>
              </div>

              <div class="plugin-version">
                <NTag size="small" :bordered="false">v{{ plugin.version }}</NTag>
              </div>

              <div class="plugin-status">
                <NTag size="small" :type="statusType(plugin.status)">
                  {{ t(`plugins.${plugin.status}`) }}
                </NTag>
                <NTag v-if="plugin.pending_restart && plugin.status !== 'pending_restart'" size="small" type="warning">
                  {{ t('plugins.pending_restart') }}
                </NTag>
              </div>

              <NSpace class="plugin-actions" :size="3" :wrap="true">
                <NButton v-if="plugin.installation_id" quaternary size="tiny" @click="openPermissions(plugin)">
                  {{ t('plugins.permissions') }}
                </NButton>
                <NButton
                  v-if="plugin.settings?.length"
                  quaternary
                  size="tiny"
                  :title="t('plugins.settings')"
                  @click="openSettings(plugin)"
                >
                  <template #icon><UiIcon name="settings" :size="13" /></template>
                </NButton>
                <NButton
                  quaternary
                  size="tiny"
                  :disabled="plugin.pending_restart && plugin.status !== 'enabled'"
                  @click="togglePlugin(plugin)"
                >
                  {{ ['enabled', 'stopping'].includes(plugin.status) ? t('plugins.disable') : t('plugins.enable') }}
                </NButton>
                <NButton
                  quaternary
                  size="tiny"
                  :loading="reloadingPlugins.includes(plugin.name)"
                  :disabled="plugin.pending_restart"
                  :title="t('plugins.reload')"
                  @click="reloadPlugin(plugin)"
                >
                  <template #icon><UiIcon name="refresh" :size="13" /></template>
                </NButton>
                <NPopconfirm v-if="!plugin.is_system" @positiveClick="unloadPlugin(plugin)">
                  <template #trigger>
                    <NButton quaternary size="tiny" type="error" :title="t('plugins.unload')">
                      <template #icon><UiIcon name="trash" :size="13" /></template>
                    </NButton>
                  </template>
                  {{ t('plugins.unload') }} {{ plugin.title || plugin.name }}?
                </NPopconfirm>
              </NSpace>
            </article>
          </div>

          <NEmpty
            v-else-if="!loading"
            class="plugins-empty"
            :description="activeFilter === 'disabled' ? t('plugins.noDisabledPlugins') : t('plugins.noPlugins')"
          >
            <template #extra>
              <NButton v-if="activeFilter !== 'disabled'" type="primary" size="small" @click="selectPackage">
                {{ t('plugins.installFirst') }}
              </NButton>
            </template>
          </NEmpty>
        </div>
        <PluginSlotHost slotId="plugin-slot-plugins-list-bottom" class="plugin-slot-container" />
      </div>
    </section>

    <PluginFileRecoveryModal v-model:visible="recoveryVisible" @resolved="refreshPermissions" />
    <PluginPermissionsModal
      v-model:visible="permissionsVisible"
      :plugin="permissionsTarget"
      @saved="refreshPermissions"
    />
    <PluginSettingsModal
      :visible="settingsModalVisible"
      :plugin="settingsTarget"
      @close="settingsModalVisible = false"
    />
    <PluginPackageInstallModal
      v-model:visible="packageModalVisible"
      :selection="packageSelection"
      @installed="packageModalVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import {
  NAlert,
  NButton,
  NDropdown,
  NEmpty,
  NInput,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NTab,
  NTabs,
  NTag,
  type DropdownOption,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useUiSkin } from '@/composables/useUiSkin'
import PluginFileRecoveryModal from '@/features/plugins/components/PluginFileRecoveryModal.vue'
import PluginPackageInstallModal from '@/features/plugins/components/PluginPackageInstallModal.vue'
import PluginPermissionsModal from '@/features/plugins/components/PluginPermissionsModal.vue'
import PluginSettingsModal from '@/features/plugins/components/PluginSettingsModal.vue'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginInfo, PluginPackageSelection } from '@/types/plugins'

const { t, te } = useI18n()
const { isFolia } = useUiSkin()
const { run, runResult } = useAsyncAction({ showSuccess: false, showError: false })
const pluginStore = usePluginStore()
const { plugins, loading, error: listError, reloadingPlugins } = storeToRefs(pluginStore)
const permissionsVisible = ref(false)
const recoveryVisible = ref(false)
const permissionsTarget = ref<PluginInfo | null>(null)
const searchQuery = ref('')
const activeFilter = ref('all')
const settingsModalVisible = ref(false)
const settingsTarget = ref<PluginInfo | null>(null)
const packageModalVisible = ref(false)
const packageSelection = ref<PluginPackageSelection | null>(null)

const installOptions = computed<DropdownOption[]>(() => [
  { key: 'package', label: t('plugins.installPackage') },
  { key: 'directory', label: t('plugins.installDirectory') },
])

const filters = computed(() => [
  { key: 'all', label: t('plugins.filterAll') },
  { key: 'enabled', label: t('plugins.filterEnabled') },
  { key: 'disabled', label: t('plugins.filterDisabled') },
])

const filteredPlugins = computed(() => {
  let result = plugins.value.filter((plugin) => !plugin.is_system)
  if (activeFilter.value === 'enabled') {
    result = result.filter((plugin) => plugin.status === 'enabled')
  } else if (activeFilter.value === 'disabled') {
    result = result.filter((plugin) => plugin.status !== 'enabled')
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return result
  return result.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(query) ||
      plugin.title?.toLowerCase().includes(query) ||
      plugin.author?.toLowerCase().includes(query) ||
      plugin.description?.toLowerCase().includes(query)
  )
})

function statusType(status: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (status === 'enabled') return 'success'
  if (status === 'disabled' || status === 'permission_denied' || status === 'error') return 'error'
  if (
    status === 'pending_restart' ||
    status === 'loading' ||
    status === 'enabling' ||
    status === 'disabling' ||
    status === 'unloading'
  ) {
    return 'warning'
  }
  if (status === 'loaded') return 'info'
  return 'default'
}

function pluginError(plugin: PluginInfo): string {
  if (!plugin.error) return ''
  const key = `plugins.errors.${plugin.error}`
  return te(key) ? t(key) : plugin.error.startsWith('PLUGIN_') ? t('plugins.runtimeError') : plugin.error
}

function pluginDescription(plugin: PluginInfo): string {
  const pluginId = plugin.author ? `${plugin.author}:${plugin.name}` : plugin.name
  return [pluginId, plugin.description].filter(Boolean).join(' · ')
}

function openPermissions(plugin: PluginInfo): void {
  permissionsTarget.value = plugin
  permissionsVisible.value = true
}

async function refreshPermissions(): Promise<void> {
  await pluginStore.load(true)
}

async function togglePlugin(plugin: PluginInfo) {
  if (
    !['enabled', 'stopping'].includes(plugin.status) &&
    plugin.installation_id &&
    (plugin.review_required || !plugin.required_satisfied)
  ) {
    openPermissions(plugin)
    return
  }
  const action = ['enabled', 'stopping'].includes(plugin.status) ? 'disable' : 'enable'
  await runResult(async () => pluginStore.toggle(plugin), {
    showSuccess: true,
    successMessage: t(`plugins.${action}Success`, { name: plugin.title || plugin.name }),
    showError: true,
    errorMessage: t(`plugins.${action}Failed`),
  })
}

async function reloadPlugin(plugin: PluginInfo) {
  if (reloadingPlugins.value.includes(plugin.name)) return
  await runResult(async () => pluginStore.reload(plugin.name), {
    showSuccess: true,
    successMessage: t('plugins.reloadSuccess', { name: plugin.title || plugin.name }),
    showError: true,
    errorMessage: t('plugins.reloadFailed'),
  })
}

async function unloadPlugin(plugin: PluginInfo) {
  await runResult(async () => pluginStore.unload(plugin.name), {
    showSuccess: true,
    successMessage: t('plugins.unloadSuccess', { name: plugin.title || plugin.name }),
    showError: true,
    errorMessage: t('plugins.unloadFailed'),
  })
}

async function installDirectory() {
  await run(async () => pluginStore.install(), {
    showSuccess: true,
    successMessage: t('plugins.installSuccess'),
    showError: true,
    errorMessage: t('plugins.installFailed'),
  })
}

async function selectPackage() {
  const selection = await run(() => pluginStore.selectPackage(), {
    showError: true,
    errorMessage: t('plugins.packageInspectFailed'),
  })
  if (!selection) return
  packageSelection.value = selection
  packageModalVisible.value = true
}

function handleInstallSelect(key: string | number) {
  if (key === 'package') void selectPackage()
  if (key === 'directory') void installDirectory()
}

function openSettings(plugin: PluginInfo) {
  settingsTarget.value = plugin
  settingsModalVisible.value = true
}

onMounted(() => void pluginStore.start().catch(() => {}))
onUnmounted(() => pluginStore.stop())
</script>

<style scoped src="@/styles/views/Plugins.css"></style>
