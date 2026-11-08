<template>
  <div class="about-plugin-row">
    <div class="about-plugin-row__avatar-cell">
      <div class="about-plugin-row__avatar">
        <UiIcon name="puzzle" :size="16" />
      </div>
    </div>
    <div class="about-plugin-row__content">
      <div class="about-plugin-row__name">
        {{ plugin.title || plugin.name }}
        <span class="about-plugin-row__version">v{{ plugin.version }}</span>
        <span v-if="plugin.license" class="about-plugin-row__license">{{ plugin.license }}</span>
      </div>
      <div v-if="plugin.author" class="about-plugin-row__author">{{ plugin.author }}</div>
      <div v-if="plugin.description" class="about-plugin-row__description">{{ plugin.description }}</div>
    </div>
    <div class="about-plugin-row__action-cell">
      <a
        v-if="isHttpUrl(plugin.homepage)"
        class="about-plugin-row__action"
        href="#"
        @click.prevent="openExternalUrl(plugin.homepage)"
      >
        <UiIcon name="external-site" :size="14" />
        <span>{{ t('settings.aboutTab.actions.homepage') }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { UiIcon } from '@/components/ui'
import type { PluginInfo } from '@/types/plugins'
import { openExternalUrl } from '@/utils/openExternal'

defineProps<{ plugin: PluginInfo }>()

const { t } = useI18n()

// 仅 http(s) 链接渲染为外链按钮；清单校验兜底之外的防御，避免任意 scheme 注入。
function isHttpUrl(value: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
</script>

<style scoped>
.about-plugin-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 40px;
}

.about-plugin-row + .about-plugin-row {
  margin-top: 5px;
}

.about-plugin-row__avatar-cell {
  display: flex;
  align-items: center;
}

.about-plugin-row__avatar {
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

.about-plugin-row__content {
  min-width: 0;
  padding: 0 13px;
}

.about-plugin-row__name {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.about-plugin-row__version,
.about-plugin-row__license {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 400;
}

.about-plugin-row__author {
  margin-top: 1px;
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.4;
}

.about-plugin-row__description {
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

.about-plugin-row__action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.about-plugin-row__action {
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

.about-plugin-row__action:hover {
  border-color: var(--primary);
  color: var(--primary);
}
</style>
