<template>
  <section class="version-panel">
    <InstanceListToolbar
      v-model:favoritesOnly="favoritesOnly"
      v-model:pinnedOnly="pinnedOnly"
      v-model:showHidden="showHidden"
      v-model:categoryId="categoryFilter"
      :pathName="pathName"
      :totalCount="versions.length"
      :filteredCount="filteredVersions.length"
      :categories="categories"
      :refreshLoading="refreshLoading"
      :searchQuery="searchQuery"
      :viewMode="viewMode"
      :sortKey="sortKey"
      :sortDirection="sortDirection"
      @update:searchQuery="emit('update:searchQuery', $event)"
      @update:viewMode="setViewMode"
      @sort="setSort"
      @refresh="emit('refresh')"
      @install="emit('install')"
      @manageCategories="categoryManagerVisible = true"
    />

    <div class="version-content">
      <UiEmptyState v-if="selectedPathIndex === -1" icon="folder" :title="t('versions.manage.selectPathHint')">
        <button v-if="pathCount === 0" class="btn-primary" @click="emit('addPath')">
          <UiIcon name="add" :size="16" />{{ t('common.add') }}
        </button>
      </UiEmptyState>
      <UiLoading v-else-if="loading" :label="t('versions.manage.scanning')" />
      <UiEmptyState
        v-else-if="versions.length === 0"
        :title="t('versions.manage.noVersionsFound')"
        :description="pathLocation"
      />
      <UiEmptyState v-else-if="filteredVersions.length === 0" icon="filter-off" title="没有符合当前筛选条件的实例" />

      <div v-else-if="viewMode === 'card'" class="instance-grid">
        <article
          v-for="version in filteredVersions"
          :key="instanceKey(version)"
          :class="['instance-card', { selected: selectedVersion === version.versionId, hidden: version.hidden }]"
          data-theme-component="instance-card"
          data-theme-node="instances.card"
          :style="coverStyle(version)"
          @contextmenu.prevent="showActionMenu($event, version)"
          @click="emit('selectVersion', version)"
        >
          <div class="card-heading">
            <InstanceIcon :version="version" :size="46" />
            <div class="card-title-copy">
              <strong>{{ instanceName(version) }}</strong>
              <span>{{ version.versionId }}</span>
            </div>
            <div class="state-actions">
              <button :class="{ active: version.pinned }" title="置顶" @click.stop="toggleFlag(version, 'pinned')">
                <UiIcon name="pin" :size="14" />
              </button>
              <button :class="{ active: version.favorite }" title="收藏" @click.stop="toggleFlag(version, 'favorite')">
                <UiIcon name="star" :size="14" />
              </button>
            </div>
          </div>
          <p v-if="version.description" class="card-description">{{ version.description }}</p>
          <div class="card-badges">
            <span :class="['badge', 'badge-' + getLoaderClass(version.primaryLoader)]">{{
              loaderDisplayName(version.primaryLoader)
            }}</span>
            <span class="category-badge" :style="categoryStyle(version.categoryId)">{{
              categoryName(version.categoryId)
            }}</span>
            <span v-for="tag in version.tags?.slice(0, 3)" :key="tag" class="tag-badge">#{{ tag }}</span>
          </div>
          <div class="card-stats">
            <span><UiIcon name="clock" :size="12" />{{ formatDate(version.lastLaunchedAt) }}</span>
            <span><UiIcon name="hourglass" :size="12" />{{ formatDuration(version.totalRunDurationSeconds) }}</span>
            <span><UiIcon name="rocket" :size="12" />{{ version.launchCount || 0 }} 次</span>
          </div>
          <div class="card-footer">
            <button title="隐藏实例" @click.stop="toggleFlag(version, 'hidden')">
              <UiIcon :name="version.hidden ? 'eye' : 'eye-off'" :size="14" />
            </button>
            <span class="card-spacer" />
            <button title="详情与个性化" @click.stop="emit('detail', version)">
              <UiIcon name="settings" :size="14" />
            </button>
            <button title="更多操作" @click.stop="showActionMenu($event, version)">
              <UiIcon name="more" :size="14" />
            </button>
            <button v-if="!version.isBroken" class="play-button" title="启动" @click.stop="emit('launch', version)">
              <UiIcon name="play" :size="14" />
            </button>
            <button class="delete-button" title="删除" @click.stop="emit('remove', version)">
              <UiIcon name="trash" :size="14" />
            </button>
          </div>
        </article>
      </div>

      <div v-else class="version-table">
        <div class="table-body">
          <div
            v-for="version in filteredVersions"
            :key="instanceKey(version)"
            :class="['table-row', { selected: selectedVersion === version.versionId, hidden: version.hidden }]"
            data-theme-component="instance-row"
            data-theme-node="instances.row"
            @contextmenu.prevent="showActionMenu($event, version)"
            @click="emit('selectVersion', version)"
          >
            <InstanceIcon class="list-icon" :version="version" :size="32" />
            <div class="instance-copy">
              <div class="instance-heading">
                <strong class="instance-name" :title="`${instanceName(version)}\n${version.versionId}`">{{
                  instanceName(version)
                }}</strong>
                <span v-if="version.favorite" class="instance-status" title="已收藏" aria-label="已收藏">
                  <UiIcon name="star" :size="13" />
                </span>
                <span v-if="version.pinned" class="instance-status" title="已置顶" aria-label="已置顶">
                  <UiIcon name="pin" :size="13" />
                </span>
              </div>
              <span class="instance-meta" :title="instanceMetadata(version)">{{ instanceMetadata(version) }}</span>
            </div>
            <div
              class="instance-labels"
              :title="[categoryName(version.categoryId), ...(version.tags || []).map((tag) => `#${tag}`)].join(' · ')"
            >
              <span class="category-badge" :style="categoryStyle(version.categoryId)">{{
                categoryName(version.categoryId)
              }}</span>
              <span v-for="tag in version.tags?.slice(0, 2)" :key="tag" class="tag-badge">#{{ tag }}</span>
              <span v-if="(version.tags?.length || 0) > 2" class="tag-badge tag-count"
                >+{{ version.tags!.length - 2 }}</span
              >
            </div>
            <div class="list-actions">
              <UiButton
                v-if="!version.isBroken"
                variant="outline"
                size="sm"
                class="quick-launch-button"
                title="快速启动"
                @click.stop="emit('launch', version)"
              >
                <UiIcon name="play" :size="14" />
                {{ t('versions.detail.launch') }}
              </UiButton>
              <UiButton
                variant="ghost"
                size="sm"
                shape="square"
                title="详情与设置"
                aria-label="详情与设置"
                @click.stop="emit('detail', version)"
              >
                <UiIcon name="settings" :size="16" />
              </UiButton>
              <UiButton
                variant="ghost"
                size="sm"
                shape="square"
                title="更多操作"
                aria-label="更多操作"
                @click.stop="showActionMenu($event, version)"
              >
                <UiIcon name="more" :size="16" />
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>
    <InstanceCategoryManager v-model:visible="categoryManagerVisible" @changed="handleCategoriesChanged" />
    <NDropdown
      placement="bottom-start"
      trigger="manual"
      :x="menuX"
      :y="menuY"
      :show="menuVisible"
      :options="actionOptions"
      @clickoutside="menuVisible = false"
      @select="handleActionSelect"
    />
  </section>
</template>

<script setup lang="ts">
import { NDropdown, type DropdownOption } from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import InstanceCategoryManager from '@/components/instances/InstanceCategoryManager.vue'
import InstanceIcon from '@/components/instances/InstanceIcon.vue'
import InstanceListToolbar from '@/components/instances/InstanceListToolbar.vue'
import UiButton from '@/components/ui/Button.vue'
import UiEmptyState from '@/components/ui/EmptyState.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { getLoaderClass, getLoaderName, getVersionLabelKey } from '@/config/version'
import { instanceProfileApi, targetFromVersion } from '@/features/instances/api/instanceProfileApi'
import { hasModLoader } from '@/features/instances/model/instanceCapabilities'
import { filterAndSortInstances, instanceDisplayName } from '@/features/instances/model/instancePresentation'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { InstanceCategory, InstanceSortKey, ScannedVersion } from '@/types/instances'
import { formatDate as formatDateUtil } from '@/utils/format'
const props = defineProps<{
  versions: ScannedVersion[]
  selectedPathIndex: number
  pathCount: number
  pathName: string
  pathLocation?: string
  loading: boolean
  refreshLoading: boolean
  searchQuery: string
  selectedVersion: string
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  refresh: []
  changed: []
  install: []
  addPath: []
  selectVersion: [version: ScannedVersion]
  detail: [version: ScannedVersion]
  launch: [version: ScannedVersion]
  remove: [version: ScannedVersion]
  action: [action: string, version: ScannedVersion]
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const categories = ref<InstanceCategory[]>([])
const categoryFilter = ref('')
const favoritesOnly = ref(false)
const pinnedOnly = ref(false)
const showHidden = ref(false)
const viewMode = ref<'card' | 'list'>(settingsStore.ui.instanceManager?.viewMode || 'list')
const sortKey = ref<InstanceSortKey>(settingsStore.ui.instanceManager?.sortKey || 'lastLaunchedAt')
const sortDirection = ref<'asc' | 'desc'>(settingsStore.ui.instanceManager?.sortDirection || 'desc')
const categoryManagerVisible = ref(false)
const coverUrls = ref<Record<string, string>>({})
const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuVersion = ref<ScannedVersion | null>(null)
const icon = (name: string) => () => h(UiIcon, { name, size: 15 })
const actionOptions = computed<DropdownOption[]>(() => [
  { label: '进入实例工作台', key: 'overview', icon: icon('cube') },
  { type: 'divider', key: 'd1' },
  {
    label: '资源管理',
    key: 'manage',
    icon: icon('layout-grid'),
    children: [
      ...(hasModLoader(menuVersion.value) ? [{ label: 'Mod 管理', key: 'mods', icon: icon('cube') }] : []),
      { label: '存档管理', key: 'worlds', icon: icon('globe') },
      { label: '截图管理', key: 'screenshots', icon: icon('photo') },
      { label: '服务器管理', key: 'servers', icon: icon('server') },
    ],
  },
  {
    label: '打开文件夹',
    key: 'folders',
    icon: icon('folder-open'),
    children: [
      { label: '实例文件夹', key: 'folder-instance', icon: icon('folder-open') },
      { label: '模组文件夹', key: 'folder-mods', icon: icon('folder') },
      { label: '存档文件夹', key: 'folder-saves', icon: icon('globe') },
      { label: '截图文件夹', key: 'folder-screenshots', icon: icon('photo') },
      { label: '日志文件夹', key: 'folder-logs', icon: icon('file-text') },
      { label: '崩溃报告文件夹', key: 'folder-crash-reports', icon: icon('alert-triangle') },
    ],
  },
  { type: 'divider', key: 'd2' },
  { label: '修改图标、别名与描述', key: 'profile', icon: icon('edit') },
  { label: menuVersion.value?.favorite ? '取消收藏' : '收藏', key: 'favorite', icon: icon('star') },
  { label: menuVersion.value?.pinned ? '取消置顶' : '置顶', key: 'pinned', icon: icon('pin') },
  { label: menuVersion.value?.hidden ? '取消隐藏' : '隐藏', key: 'hidden', icon: icon('eye-off') },
  { type: 'divider', key: 'd3' },
  {
    label: t('versions.detail.delete'),
    key: 'delete',
    icon: () => h(UiIcon, { name: 'trash', size: 15, style: { color: 'var(--error)' } }),
  },
])

function showActionMenu(event: MouseEvent, version: ScannedVersion) {
  menuVersion.value = version
  const anchor = event.type === 'click' ? (event.currentTarget as HTMLElement).getBoundingClientRect() : null
  menuX.value = anchor?.left ?? event.clientX
  menuY.value = anchor?.bottom ?? event.clientY
  menuVisible.value = true
}
async function handleActionSelect(key: string) {
  menuVisible.value = false
  if (!menuVersion.value) return
  if (key === 'favorite' || key === 'pinned' || key === 'hidden') {
    await toggleFlag(menuVersion.value, key)
    return
  }
  if (key === 'delete') {
    emit('remove', menuVersion.value)
    return
  }
  emit('action', key, menuVersion.value)
}

onMounted(async () => {
  // 后端可能返回 null/undefined（如演示环境未实现分类），统一归并为空数组，避免渲染期 .find 崩溃
  categories.value = (await instanceProfileApi.categories().catch(() => [])) ?? []
})

async function handleCategoriesChanged() {
  categories.value = (await instanceProfileApi.categories()) ?? []
  emit('changed')
}

const filteredVersions = computed(() => {
  return filterAndSortInstances(
    props.versions,
    {
      query: props.searchQuery,
      showHidden: showHidden.value,
      favoritesOnly: favoritesOnly.value,
      pinnedOnly: pinnedOnly.value,
      categoryId: categoryFilter.value,
    },
    { key: sortKey.value, direction: sortDirection.value },
    categoryName
  )
})

function instanceName(version: ScannedVersion): string {
  return instanceDisplayName(version)
}

function instanceKey(version: ScannedVersion): string {
  return `${version.path}::${version.versionId}`
}

function categoryName(id?: string): string {
  return categories.value.find((category) => category.id === id)?.name || '未分类'
}

function categoryStyle(id?: string): Record<string, string> {
  const color = categories.value.find((category) => category.id === id)?.color || '#8b95a5'
  return { color, borderColor: `${color}66`, backgroundColor: `${color}18` }
}

function loaderDisplayName(loaderType: string | null): string {
  return !loaderType || ['Unknown', 'release', 'snapshot', 'Vanilla'].includes(loaderType)
    ? 'Vanilla'
    : getLoaderName(loaderType)
}

function loaderVersionText(version: ScannedVersion): string {
  if (loaderDisplayName(version.primaryLoader) === 'Vanilla') return ''
  return version.loaderVersion ? `v${version.loaderVersion}` : ''
}

function versionTypeName(versionType: string): string {
  const key = getVersionLabelKey(versionType)
  // 未知类型（getVersionLabelKey 原样返回）时保持旧行为显示 Minecraft
  return key === versionType ? 'Minecraft' : t(key)
}

function instanceMetadata(version: ScannedVersion): string {
  const loader = [loaderDisplayName(version.primaryLoader), loaderVersionText(version)].filter(Boolean).join(' ')
  const normalizedType = version.versionType.toLowerCase()
  const typeLabel = versionTypeName(normalizedType)
  const versionType = normalizedType === 'release' || typeLabel === 'Minecraft' ? '' : typeLabel
  return [`Minecraft ${version.vanillaName || version.versionId}`, loader, versionType].filter(Boolean).join(' · ')
}

function formatDuration(seconds?: number): string {
  const total = Math.max(0, Number(seconds || 0))
  if (total < 60) return `${total} 秒`
  if (total < 3600) return `${Math.floor(total / 60)} 分钟`
  return `${Math.floor(total / 3600)} 小时 ${Math.floor((total % 3600) / 60)} 分`
}

function formatDate(value?: string | null): string {
  return formatDateUtil(value, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }, '从未启动')
}

function coverStyle(version: ScannedVersion) {
  const cover = coverUrls.value[instanceKey(version)]
  if (!cover) return undefined
  return { '--instance-cover': `linear-gradient(rgba(20,24,32,.78),rgba(20,24,32,.9)), url(${JSON.stringify(cover)})` }
}

watch(
  () => props.versions.map((version) => `${instanceKey(version)}:${version.cover?.value || ''}`).join('|'),
  async () => {
    const next: Record<string, string> = {}
    await Promise.all(
      props.versions.map(async (version) => {
        if (!version.cover?.value) return
        const url = await backend.file.toUrl(version.cover.value)
        if (url) next[instanceKey(version)] = url
      })
    )
    coverUrls.value = next
  },
  { immediate: true }
)

async function persistDisplaySettings() {
  await settingsStore
    .patchUi({
      instanceManager: { viewMode: viewMode.value, sortKey: sortKey.value, sortDirection: sortDirection.value },
    })
    .catch(() => undefined)
}

function setViewMode(mode: 'card' | 'list') {
  viewMode.value = mode
  void persistDisplaySettings()
}

function setSort(key: InstanceSortKey, direction: 'asc' | 'desc') {
  sortKey.value = key
  sortDirection.value = direction
  void persistDisplaySettings()
}

async function toggleFlag(version: ScannedVersion, field: 'favorite' | 'pinned' | 'hidden') {
  await instanceProfileApi.patch(targetFromVersion(version), { [field]: !version[field] })
  // 直接更新本地版本对象，避免触发全量扫描
  const flags = version as unknown as Record<string, boolean | undefined>
  flags[field] = !flags[field]
}
</script>

<style scoped src="@/styles/components/instances/InstalledInstanceList.css"></style>
