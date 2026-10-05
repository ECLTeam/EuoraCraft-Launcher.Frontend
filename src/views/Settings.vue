<template>
  <SectionLayout :title="t('settings.title')" icon="settings" :items="navItems">
    <template #nav-bottom>
      <PluginSlotHost slotId="plugin-slot-settings-nav-bottom" class="plugin-slot-container" />
    </template>
    <template #content-top>
      <PluginSlotHost slotId="plugin-slot-settings-content-top" class="plugin-slot-container" />
    </template>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <template #content-bottom>
      <PluginSlotHost slotId="plugin-slot-settings-content-bottom" class="plugin-slot-container" />
    </template>
  </SectionLayout>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionLayout from '@/components/layout/SectionLayout.vue'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const navItems = computed(() => [
  { path: '/settings/launcher', icon: 'settings', label: t('settings.launcherSettings') },
  { path: '/settings/appearance', icon: 'brush', label: t('settings.appearance') },
  { path: '/settings/game', icon: 'game', label: t('settings.gameSettings') },
  { path: '/settings/java', icon: 'package', label: t('javaManager.title') },
  { path: '/settings/about', icon: 'info', label: t('settings.about') },
])

onMounted(() => {
  void settingsStore.load().catch(() => {})
})
</script>
