<template>
  <PluginSettingsModal
    :visible="settingsModalVisible"
    :plugin="settingsTarget"
    :plugins="plugins"
    @close="store.closeSettings"
    @activate="activate"
    @openDirectory="openDirectory"
  />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import PluginSettingsModal from '@/features/plugins/components/PluginSettingsModal.vue'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginInfo } from '@/types/plugins'

const store = usePluginStore()
const { plugins, settingsModalVisible, settingsTarget } = storeToRefs(store)
const { t } = useI18n()
const { run } = useAsyncAction({ showSuccess: false })

function refresh(): void {
  void store.load(true).catch(() => {})
}

watch(
  settingsModalVisible,
  (visible, _, onCleanup) => {
    if (visible) onCleanup(pluginManagementApi.onStatusChanged(refresh))
  },
  { immediate: true }
)

async function activate(plugin: PluginInfo): Promise<void> {
  await run(() => store.toggle(plugin), { showError: true, errorMessage: t('plugins.enableFailed') })
}

async function openDirectory(plugin: PluginInfo): Promise<void> {
  const installationId = plugin.installation_id
  if (!installationId) return
  await run(() => pluginManagementApi.openDirectory(installationId), {
    showError: true,
    errorMessage: t('plugins.directoryOpenFailed'),
  })
}
</script>
