<template>
  <div class="about-entry">
    <div class="about-entry__avatar-cell">
      <div class="about-entry__avatar">
        <UiIcon name="layers" :size="14" />
      </div>
    </div>
    <div class="about-entry__content">
      <div class="about-plugin-technology__name">
        {{ entry.name }}
        <span class="about-plugin-technology__badge" :title="pluginTitle">{{ pluginTitle }}</span>
      </div>
      <div v-if="entry.description" class="about-entry__description">{{ entry.description }}</div>
      <div v-if="entry.license" class="about-entry__license">{{ entry.license }}</div>
    </div>
    <div class="about-entry__action-cell">
      <a class="about-entry__action" href="#" @click.prevent="openExternalUrl(entry.url)">
        <UiIcon name="external-site" :size="14" />
        <span>{{ t('settings.aboutTab.actions.website') }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiIcon } from '@/components/ui'
import type { PluginTechnologyEntry } from '@/types/plugins'
import { openExternalUrl } from '@/utils/openExternal'

const props = defineProps<{ entry: PluginTechnologyEntry; pluginTitle: string }>()

const { t } = useI18n()

// 徽标展示宿主解析出的插件标题；插件名来自插件列表而非条目声明，条目自身无法指定来源。
const pluginTitle = computed(() => props.pluginTitle)
</script>

<style scoped>
.about-entry {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 40px;
}

.about-entry + .about-entry {
  margin-top: 5px;
}

.about-entry__avatar-cell {
  display: flex;
  align-items: center;
}

.about-entry__avatar {
  display: flex;
  width: 31px;
  height: 31px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--ecl-surface-muted);
  color: var(--text-secondary);
}

.about-entry__content {
  min-width: 0;
  padding: 0 13px;
}

.about-plugin-technology__name {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.about-plugin-technology__badge {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--primary) 40%, transparent);
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  color: var(--primary);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.about-entry__description {
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

.about-entry__license {
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

.about-entry__action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.about-entry__action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 13px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  text-decoration: none;
  transition: all var(--duration-fast) var(--ease-emphasized);
  white-space: nowrap;
}

.about-entry__action:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>
