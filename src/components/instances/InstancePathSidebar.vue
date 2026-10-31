<template>
  <aside class="path-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <UiIcon name="folder" :size="16" />
        {{ t('versions.manage.gamePath') }}
      </h3>
      <button class="btn-add" :title="t('common.add')" @click="emit('add')">
        <UiIcon name="add" :size="16" />
      </button>
    </div>

    <div class="path-list">
      <div
        v-for="(item, index) in paths"
        :key="item.path"
        :class="['path-item', { active: selectedIndex === index }]"
        role="button"
        tabindex="0"
        :aria-current="selectedIndex === index ? 'true' : undefined"
        @click="emit('select', index)"
        @keydown.enter.prevent="emit('select', index)"
        @keydown.space.prevent="emit('select', index)"
      >
        <div class="path-indicator"></div>
        <UiIcon name="folder" :size="16" class="path-icon" />
        <div class="path-info">
          <div class="path-name-row">
            <span class="path-name">{{ item.name || t('versions.manage.unnamedPath') }}</span>
            <span :class="['path-version-count', { 'is-empty': versionCount(item.path) === 0 }]">
              {{ t('versions.manage.versionCount', { count: versionCount(item.path) }) }}
            </span>
          </div>
          <span class="path-location" :title="item.path">{{ item.path }}</span>
        </div>
        <div v-if="!item.protected" class="path-actions">
          <button
            class="path-action-btn"
            :title="t('versions.manage.openFolder')"
            :aria-label="t('versions.manage.openFolder')"
            @click.stop="emit('open-folder', index)"
          >
            <UiIcon name="folder-open" :size="14" />
          </button>
          <button
            class="path-action-btn"
            :title="t('common.edit')"
            :aria-label="t('common.edit')"
            @click.stop="emit('edit', index)"
          >
            <UiIcon name="settings" :size="14" />
          </button>
          <button
            class="path-action-btn path-action-delete"
            :title="t('common.delete')"
            :aria-label="t('common.delete')"
            @click.stop="emit('remove', index)"
          >
            <UiIcon name="trash" :size="14" />
          </button>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <span class="footer-text">{{ t('versions.manage.pathCount', { count: paths.length }) }}</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import type { GamePath } from '@/features/instances/model/gamePath'

const props = defineProps<{
  paths: GamePath[]
  selectedIndex: number
  versionCounts: Record<string, number>
}>()

const emit = defineEmits<{
  add: []
  select: [index: number]
  edit: [index: number]
  remove: [index: number]
  'open-folder': [index: number]
}>()

const { t } = useI18n()
const versionCount = (path: string) => props.versionCounts[path] ?? 0
</script>

<style scoped src="@/styles/components/instances/InstancePathSidebar.css"></style>
