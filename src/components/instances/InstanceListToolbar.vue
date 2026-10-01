<template>
  <div class="instance-toolbar" @keydown.esc.stop.prevent="closeMenu(true)">
    <div class="toolbar-heading">
      <h3 class="toolbar-title" :title="pathName">
        <UiIcon name="cube" :size="16" /><span>{{ pathName }}</span>
      </h3>
      <span v-if="totalCount" class="toolbar-count">{{ filteredCount }}/{{ totalCount }}</span>
    </div>
    <div class="toolbar-controls">
      <div class="search-box" :title="t('versions.manage.toolbar.searchHint')">
        <UiIcon name="search" :size="14" class="search-icon" />
        <input
          v-model="searchQuery"
          class="search-input"
          type="search"
          :placeholder="t('versions.manage.searchVersion')"
          :aria-label="t('versions.manage.toolbar.searchHint')"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          type="button"
          :aria-label="t('versions.manage.toolbar.clearSearch')"
          @click="searchQuery = ''"
        >
          <UiIcon name="close" :size="13" />
        </button>
      </div>
      <NPopover
        :show="openMenu === 'filter'"
        trigger="click"
        placement="bottom-end"
        :showArrow="false"
        raw
        @update:show="setMenu('filter', $event)"
      >
        <template #trigger>
          <UiButton
            ref="filterButton"
            variant="ghost"
            size="sm"
            class="filter-toggle"
            :class="{ active: filterCount > 0 }"
            :title="t('versions.manage.toolbar.filter')"
            :aria-label="filterLabel"
            :aria-expanded="openMenu === 'filter'"
            aria-haspopup="dialog"
          >
            <UiIcon name="filter" :size="14" /><span class="toolbar-label">{{
              t('versions.manage.toolbar.filter')
            }}</span
            ><span v-if="filterCount" class="filter-count">{{ filterCount }}</span>
          </UiButton>
        </template>
        <div
          ref="filterPanel"
          class="toolbar-popover filter-panel"
          role="dialog"
          :aria-label="t('versions.manage.toolbar.filter')"
          @keydown.esc.stop.prevent="closeMenu(true)"
        >
          <div class="filter-options">
            <label class="toolbar-choice"
              ><input v-model="favoritesOnly" type="checkbox" /><span>{{
                t('versions.manage.toolbar.favoritesOnly')
              }}</span></label
            >
            <label class="toolbar-choice"
              ><input v-model="pinnedOnly" type="checkbox" /><span>{{
                t('versions.manage.toolbar.pinnedOnly')
              }}</span></label
            >
            <label class="toolbar-choice"
              ><input v-model="showHidden" type="checkbox" /><span>{{
                t('versions.manage.toolbar.showHidden')
              }}</span></label
            >
          </div>
          <fieldset class="toolbar-option-group">
            <legend>{{ t('versions.manage.toolbar.category') }}</legend>
            <div class="category-options">
              <label class="toolbar-choice"
                ><input v-model="categoryId" type="radio" :name="categoryGroup" value="" /><span>{{
                  t('versions.manage.toolbar.allCategories')
                }}</span></label
              >
              <label v-for="category in categories" :key="category.id" class="toolbar-choice"
                ><input v-model="categoryId" type="radio" :name="categoryGroup" :value="category.id" /><span
                  :title="category.name"
                  >{{ category.name }}</span
                ></label
              >
            </div>
          </fieldset>
          <div class="toolbar-popover-footer">
            <UiButton
              variant="text"
              size="sm"
              :title="t('versions.manage.toolbar.manageCategories')"
              @click="manageCategories"
              >{{ t('versions.manage.toolbar.manageCategories') }}</UiButton
            >
            <UiButton
              variant="text"
              size="sm"
              :title="t('versions.manage.toolbar.clearFilters')"
              :disabled="!filterCount"
              @click="clearFilters"
              >{{ t('versions.manage.toolbar.clearFilters') }}</UiButton
            >
          </div>
        </div>
      </NPopover>
      <NPopover
        :show="openMenu === 'sort'"
        trigger="click"
        placement="bottom-end"
        :showArrow="false"
        raw
        @update:show="setMenu('sort', $event)"
      >
        <template #trigger>
          <UiButton
            ref="sortButton"
            variant="ghost"
            size="sm"
            class="sort-toggle"
            :title="sortSummary"
            :aria-label="t('versions.manage.toolbar.sort')"
            :aria-expanded="openMenu === 'sort'"
            aria-haspopup="dialog"
          >
            <UiIcon :name="sortDirection === 'desc' ? 'sort-descending' : 'sort-ascending'" :size="14" /><span
              class="toolbar-label"
              >{{ t('versions.manage.toolbar.sort') }}</span
            >
          </UiButton>
        </template>
        <div
          ref="sortPanel"
          class="toolbar-popover sort-panel"
          role="dialog"
          :aria-label="t('versions.manage.toolbar.sort')"
          @keydown.esc.stop.prevent="closeMenu(true)"
        >
          <fieldset class="toolbar-option-group">
            <legend>{{ t('versions.manage.toolbar.sort') }}</legend>
            <label v-for="key in sortKeys" :key="key" class="toolbar-choice"
              ><input
                type="radio"
                :name="sortGroup"
                :value="key"
                :checked="sortKey === key"
                @change="emit('sort', key, sortDirection)"
              /><span>{{ t(`versions.manage.toolbar.${key}`) }}</span></label
            >
          </fieldset>
          <div class="sort-directions">
            <UiButton
              v-for="direction in directions"
              :key="direction"
              size="sm"
              :variant="sortDirection === direction ? 'outline' : 'ghost'"
              :aria-pressed="sortDirection === direction"
              @click="emit('sort', sortKey, direction)"
              >{{ t(`versions.manage.toolbar.${direction}`) }}</UiButton
            >
          </div>
        </div>
      </NPopover>
      <div class="view-switch" role="group" :aria-label="t('versions.manage.toolbar.view')">
        <UiButton
          v-for="mode in viewModes"
          :key="mode"
          variant="ghost"
          size="sm"
          shape="square"
          :class="{ active: viewMode === mode }"
          :title="t(`versions.manage.toolbar.${mode}`)"
          :aria-label="t(`versions.manage.toolbar.${mode}`)"
          :aria-pressed="viewMode === mode"
          @click="emit('update:viewMode', mode)"
          ><UiIcon :name="mode === 'card' ? 'layout-grid' : 'list'" :size="14"
        /></UiButton>
      </div>
      <UiButton
        variant="ghost"
        size="sm"
        shape="square"
        class="refresh-button"
        :disabled="refreshLoading"
        :title="t('versions.manage.refresh')"
        :aria-label="t('versions.manage.refresh')"
        @click="emit('refresh')"
        ><UiIcon name="refresh" :size="14"
      /></UiButton>
      <UiButton
        variant="primary"
        size="sm"
        class="install-button"
        :title="t('versions.download.installNew')"
        :aria-label="t('versions.download.installNew')"
        @click="emit('install')"
        ><UiIcon name="download" :size="14" /><span class="toolbar-label">{{
          t('versions.manage.toolbar.install')
        }}</span></UiButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { NPopover } from 'naive-ui'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiButton from '@/components/ui/Button.vue'
import UiIcon from '@/components/ui/Icon.vue'
import type { InstanceCategory, InstanceSortKey } from '@/types/instances'

const props = defineProps<{
  pathName: string
  totalCount: number
  filteredCount: number
  categories: InstanceCategory[]
  refreshLoading: boolean
  viewMode: 'card' | 'list'
  sortKey: InstanceSortKey
  sortDirection: 'asc' | 'desc'
}>()
const emit = defineEmits<{
  'update:viewMode': [mode: 'card' | 'list']
  sort: [key: InstanceSortKey, direction: 'asc' | 'desc']
  refresh: []
  install: []
  manageCategories: []
}>()
const searchQuery = defineModel<string>('searchQuery', { required: true })
const favoritesOnly = defineModel<boolean>('favoritesOnly', { required: true })
const pinnedOnly = defineModel<boolean>('pinnedOnly', { required: true })
const showHidden = defineModel<boolean>('showHidden', { required: true })
const categoryId = defineModel<string>('categoryId', { required: true })
const { t } = useI18n()
const sortKeys: InstanceSortKey[] = ['lastLaunchedAt', 'totalRunDurationSeconds', 'launchCount', 'name', 'gameVersion']
const directions = ['asc', 'desc'] as const
const viewModes = ['card', 'list'] as const
const categoryGroup = useId()
const sortGroup = useId()
const openMenu = ref<'filter' | 'sort' | null>(null)
const filterButton = ref<InstanceType<typeof UiButton>>()
const sortButton = ref<InstanceType<typeof UiButton>>()
const filterPanel = ref<HTMLDivElement>()
const sortPanel = ref<HTMLDivElement>()
const filterCount = computed(
  () =>
    Number(favoritesOnly.value) +
    Number(pinnedOnly.value) +
    Number(showHidden.value) +
    Number(Boolean(categoryId.value))
)
const filterLabel = computed(() =>
  filterCount.value
    ? `${t('versions.manage.toolbar.filter')} (${filterCount.value})`
    : t('versions.manage.toolbar.filter')
)
const sortSummary = computed(
  () =>
    `${t('versions.manage.toolbar.sort')}: ${t(`versions.manage.toolbar.${props.sortKey}`)} · ${t(`versions.manage.toolbar.${props.sortDirection}`)}`
)

function setMenu(menu: 'filter' | 'sort', show: boolean) {
  if (show) openMenu.value = menu
  else if (openMenu.value === menu) openMenu.value = null
}
function closeMenu(restoreFocus = false) {
  const trigger = openMenu.value === 'filter' ? filterButton.value : sortButton.value
  openMenu.value = null
  if (restoreFocus) trigger?.$el.focus()
}
function clearFilters() {
  favoritesOnly.value = false
  pinnedOnly.value = false
  showHidden.value = false
  categoryId.value = ''
}
function manageCategories() {
  closeMenu()
  emit('manageCategories')
}

watch(openMenu, async (menu) => {
  if (!menu) return
  await nextTick()
  if (openMenu.value !== menu) return
  const panel = menu === 'filter' ? filterPanel.value : sortPanel.value
  panel?.querySelector<HTMLInputElement>('input')?.focus()
})
</script>

<style scoped src="@/styles/components/instances/InstanceListToolbar.css"></style>
