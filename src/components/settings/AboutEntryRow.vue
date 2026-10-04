<template>
  <div class="about-entry">
    <div class="about-entry__avatar-cell">
      <img
        v-if="entry.imageUrl"
        :src="entry.imageUrl"
        :alt="entry.name"
        class="about-entry__avatar about-entry__avatar--image"
      />
      <div v-else class="about-entry__avatar">{{ entry.initials }}</div>
    </div>
    <div class="about-entry__content">
      <div class="about-entry__name">{{ entry.name }}</div>
      <div class="about-entry__description">{{ t(`settings.aboutTab.descriptions.${entry.descriptionKey}`) }}</div>
      <div v-if="licenseText" class="about-entry__license">{{ licenseText }}</div>
    </div>
    <div class="about-entry__action-cell">
      <a class="about-entry__action" href="#" @click.prevent="openExternalUrl(entry.url)">
        <UiIcon :name="entry.iconName || 'github'" :size="14" />
        <span>{{ t(`settings.aboutTab.actions.${entry.actionLabelKey}`) }}</span>
      </a>
      <a v-if="licenseUrl" class="about-entry__action" href="#" @click.prevent="openExternalUrl(licenseUrl)">
        <UiIcon name="file-source" :size="14" />
        <span>{{ t('settings.aboutTab.actions.license') }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import type { AboutEntry } from '@/features/settings/about/aboutContent'
import { openExternalUrl } from '@/utils/openExternal'

defineProps<{ entry: AboutEntry; licenseText?: string; licenseUrl?: string }>()

const { t } = useI18n()
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
  font-size: 12px;
  font-weight: 600;
}

.about-entry__avatar--image {
  border: none;
  background: transparent;
  object-fit: contain;
}

.about-entry__content {
  min-width: 0;
  padding: 0 13px;
}

.about-entry__name {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.about-entry__license {
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}

.about-entry__description {
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
