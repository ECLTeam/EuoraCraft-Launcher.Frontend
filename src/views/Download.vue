<template>
  <div class="download-page">
    <aside class="download-nav ecl-surface">
      <div class="download-nav-title">
        <UiIcon name="download" :size="18" />
        <span>{{ t('download.title') }}</span>
      </div>
      <button
        v-for="item in navItems"
        :key="item.id"
        class="download-nav-item"
        :class="{ active: activeTab === item.id }"
        @click="switchTab(item.id)"
      >
        <UiIcon :name="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </aside>

    <main class="download-content">
      <Transition name="page" mode="out-in">
        <InstancesTab v-if="activeTab === 'instances'" :key="activeTab" />
        <OnlineModSearch v-else-if="activeTab === 'mod'" :key="activeTab" :resourceType="'mod'" />
        <OnlineModSearch v-else-if="activeTab === 'resourcepack'" :key="activeTab" :resourceType="'resourcepack'" />
        <OnlineModSearch v-else-if="activeTab === 'shaderpack'" :key="activeTab" :resourceType="'shaderpack'" />
        <OnlineModSearch v-else-if="activeTab === 'datapack'" :key="activeTab" :resourceType="'datapack'" />
        <OnlineModSearch v-else-if="activeTab === 'modpack'" :key="activeTab" :resourceType="'modpack'" />
        <OnlineModSearch
          v-else-if="activeTab === 'world'"
          :key="activeTab"
          resourceType="world"
          fixedSource="curseforge"
        />
      </Transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import OnlineModSearch from '@/components/mods/OnlineModSearch.vue'
import UiIcon from '@/components/ui/Icon.vue'
import InstancesTab from '@/views/instances/InstancesTab.vue'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

type DownloadTab = 'instances' | 'mod' | 'resourcepack' | 'shaderpack' | 'datapack' | 'modpack' | 'world'

const validTabs: DownloadTab[] = ['instances', 'mod', 'resourcepack', 'shaderpack', 'datapack', 'modpack', 'world']

const navItems = computed(() => [
  { id: 'instances' as const, icon: 'cube', label: t('download.instanceDownload') },
  { id: 'mod' as const, icon: 'puzzle', label: t('download.mod') },
  { id: 'resourcepack' as const, icon: 'image', label: t('download.resourcepack') },
  { id: 'shaderpack' as const, icon: 'sparkles', label: t('download.shaderpack') },
  { id: 'datapack' as const, icon: 'layers', label: t('download.datapack') },
  { id: 'modpack' as const, icon: 'package', label: t('download.modpack') },
  { id: 'world' as const, icon: 'globe', label: t('download.world.title') },
])

const fromQuery = typeof route.query.tab === 'string' ? route.query.tab : ''
const activeTab = ref<DownloadTab>(
  (validTabs as string[]).includes(fromQuery) ? (fromQuery as DownloadTab) : 'instances'
)

watch(
  () => route.query.tab,
  (value) => {
    activeTab.value =
      typeof value === 'string' && validTabs.includes(value as DownloadTab) ? (value as DownloadTab) : 'instances'
  }
)
function switchTab(tab: DownloadTab) {
  activeTab.value = tab
  // 同步 query，方便版本弹窗等外部入口带 tab 直达；不覆盖其他外部参数
  const query: LocationQueryRaw = { ...route.query, tab }
  if (tab !== 'datapack') delete query.world
  void router.replace({ query })
}
</script>

<style scoped>
.download-page {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 0;
  grid-template-columns: 156px minmax(0, 1fr);
  gap: 12px;
}

.download-nav {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 6px;
}

.download-nav-title {
  display: flex;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  padding: 0 6px;
  border-bottom: 1px solid var(--ecl-border);
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
}

.download-nav-title :deep(svg) {
  color: var(--primary);
}

.download-nav-item {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 9px;
  margin: 3px 0;
  padding: 0 10px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition:
    color var(--duration-fast) var(--ease-emphasized),
    background var(--duration-fast) var(--ease-emphasized);
}

.download-nav-item:hover {
  background: var(--glass-item-hover);
  color: var(--text-primary);
}

.download-nav-item.active {
  background: var(--glass-item-active-bg);
  color: var(--primary);
  font-weight: 600;
}

.download-content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

@media (max-width: 840px) {
  .download-page {
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 10px;
  }
}
</style>
