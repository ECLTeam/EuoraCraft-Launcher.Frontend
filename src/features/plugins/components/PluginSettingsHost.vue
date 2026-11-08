<template>
  <PluginSettingsModal
    :visible="settingsModalVisible"
    :plugin="settingsTarget"
    :plugins="plugins"
    @close="store.closeSettings"
    @activate="activate"
    @openDirectory="openDirectory"
  />
  <PluginPermissionsModal v-model:visible="permissionsVisible" :plugin="permissionsTarget" @saved="refresh" />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import PluginPermissionsModal from '@/features/plugins/components/PluginPermissionsModal.vue'
import PluginSettingsModal from '@/features/plugins/components/PluginSettingsModal.vue'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginInfo } from '@/types/plugins'

const store = usePluginStore()
const { plugins, settingsModalVisible, settingsTarget } = storeToRefs(store)
const { t } = useI18n()
const { run } = useAsyncAction({ showSuccess: false })
const permissionsVisible = ref(false)
const permissionsTarget = ref<PluginInfo | null>(null)

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
  if (plugin.installation_id && (plugin.review_required || !plugin.required_satisfied)) {
    if (plugin.requested_permissions?.length === 0) {
      await run(() => store.enableBasic(plugin), { showError: true, errorMessage: t('plugins.enableFailed') })
    } else {
      permissionsTarget.value = plugin
      permissionsVisible.value = true
    }
    return
  }
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
