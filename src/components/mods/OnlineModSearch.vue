<template>
  <div
    class="oms-root"
    data-drop-zone
    @dragover.prevent
    @drop.prevent="handleDrop"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
  >
    <div v-if="dragging" class="oms-drop-overlay">
      <UiIcon name="download" :size="26" />
      <span>{{ t('mods.dropToInstall') }}</span>
    </div>

    <div class="mods-search-toolbar">
      <div class="search-controls">
        <div class="search-controls-main">
          <NInput
            v-model:value="query"
            class="query-input"
            :placeholder="t('mods.searchPlaceholder', { resource: resourceTypeLabel })"
            clearable
            @keydown.enter="handleSearch()"
          >
            <template #prefix><UiIcon name="search" :size="15" /></template>
          </NInput>
          <NButton type="primary" :loading="loading" @click="handleSearch()">
            <template #icon><UiIcon name="search" :size="15" /></template>
            {{ t('mods.search') }}
          </NButton>
        </div>
      </div>

      <div class="search-filters">
        <div class="filter-group">
          <span class="filter-label">{{ t('mods.source') }}</span>
          <span v-if="fixedSource" class="fixed-source-label">{{ sourceLabel(fixedSource) }}</span>
          <NSelect
            v-else
            v-model:value="sourceFilter"
            :options="sourceOptions"
            :placeholder="t('mods.allSources')"
            size="small"
            class="filter-item-small"
          />
        </div>
        <div class="filter-group">
          <span class="filter-label">{{ t('mods.sort') }}</span>
          <NSelect v-model:value="sortFilter" :options="sortOptions" size="small" class="filter-item-small" />
        </div>
        <div class="filter-group">
          <span class="filter-label">{{ t('mods.version') }}</span>
          <NSelect
            v-model:value="versionFilter"
            :options="gameVersionOptions"
            :placeholder="t('mods.allVersions')"
            size="small"
            class="filter-item"
          />
        </div>
        <div v-if="resourceType === 'mod'" class="filter-group">
          <span class="filter-label">{{ t('mods.loaderType') }}</span>
          <NSelect
            v-model:value="loaderFilter"
            :options="loaderOptions"
            :placeholder="t('mods.allLoaders')"
            placement="bottom-end"
            size="small"
            class="filter-item"
          />
        </div>
      </div>

      <div v-if="!isModpack" class="instance-selector-row">
        <span class="instance-selector-label">{{ t('mods.selectInstance') }}</span>
        <ResourceInstanceSelect
          :target="target"
          :placeholder="t('mods.selectInstanceHint')"
          :showNoneOption="true"
          :noneLabel="t('mods.noneInstance')"
          class="oms-instance-select"
          @persist="onInstancePersist"
        />
        <NButton v-if="resourceType === 'world'" secondary size="small" @click="chooseAndImportWorld">
          <template #icon><UiIcon name="upload" :size="15" /></template>
          {{ t('download.world.importLocal') }}
        </NButton>
        <div class="instance-selector-actions">
          <NButton quaternary circle size="small" title="刷新" @click="refreshResults">
            <template #icon><UiIcon name="refresh" :size="15" /></template>
          </NButton>
          <NButton size="small" quaternary @click="resetConditions">
            <template #icon><UiIcon name="close" :size="14" /></template>
            {{ t('mods.resetConditions') }}
          </NButton>
        </div>
      </div>
    </div>

    <PluginSlotHost slotId="plugin-slot-online-mods-search-after" class="plugin-slot-container" />

    <div v-if="sourceWarnings.length" class="source-warnings">
      <NAlert v-for="warning in sourceWarnings" :key="warning.name" type="warning" :showIcon="false">
        <strong>{{ warning.name }}</strong> · {{ warning.error }}
      </NAlert>
    </div>

    <div class="mods-results-panel">
      <div class="mods-results-content">
        <UiLoading :show="loading" mode="overlay" :label="t('mods.searching')" class="mods-results-spin">
          <NScrollbar v-if="results.length" class="mods-results-scroll">
            <div class="mod-list">
              <div v-for="mod in results" :key="mod.id" class="mod-row" @click="openDetails(mod)">
                <!-- 标识图标：小方块，只做识别不抢版面 -->
                <div class="mod-row-icon">
                  <img v-if="mod.iconUrl" :src="mod.iconUrl" :alt="mod.displayTitle" loading="lazy" />
                  <UiIcon v-else name="cube" :size="18" />
                </div>

                <!-- 主信息：单行紧凑 -->
                <div class="mod-row-main">
                  <div class="mod-row-title">
                    <span class="mod-row-name">
                      {{ mod.displayTitle }}{{ mod.title && mod.displayTitle !== mod.title ? ` | ${mod.title}` : '' }}
                    </span>
                    <div class="mod-row-tags">
                      <NTag v-if="mod.wiki" size="tiny" :bordered="false" type="info">MCMOD百科</NTag>
                      <NTag v-if="resourceType !== 'mod'" size="tiny" :bordered="false" type="info">
                        {{ resourceTypeLabel }}
                      </NTag>
                      <template v-if="resourceType === 'mod'">
                        <NTag
                          v-for="loader in mod.loaders.slice(0, 2)"
                          :key="`l:${loader}`"
                          size="tiny"
                          :bordered="false"
                        >
                          {{ loaderName(loader) }}
                        </NTag>
                      </template>
                      <NTag
                        v-for="category in mod.categories.slice(0, 1)"
                        :key="`c:${category}`"
                        size="tiny"
                        :bordered="false"
                      >
                        {{ category }}
                      </NTag>
                    </div>
                  </div>
                  <p class="mod-row-desc" :title="mod.wiki?.summary || mod.description">
                    {{ mod.wiki?.summary || mod.description }}
                  </p>
                  <div class="mod-row-meta">
                    <span v-if="mod.gameVersions[0]" class="mod-meta-item">
                      {{ mod.gameVersions[0]
                      }}{{ mod.gameVersions.length > 1 ? `+${mod.gameVersions.length - 1}` : '' }}
                    </span>
                    <span class="mod-meta-item">↓ {{ formatDownloads(mod.downloads) }}</span>
                    <span v-if="mod.dateModified" class="mod-meta-item">{{
                      formatRelativeTime(mod.dateModified)
                    }}</span>
                    <span class="mod-meta-item">{{ mod.author }}</span>
                    <span class="mod-meta-item mod-meta-source">{{ sourceLabel(mod.source) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="totalPages > 1" class="mods-pagination">
              <NButton size="small" quaternary circle :disabled="page <= 1" @click="goToPage(1)">
                <template #icon><UiIcon name="chevrons-left" :size="14" /></template>
              </NButton>
              <NButton size="small" quaternary :disabled="page <= 1" @click="goToPage(page - 10)">
                <template #icon><UiIcon name="chevron-left" :size="14" /></template>
                {{ t('mods.prev10Pages') }}
              </NButton>
              <NButton size="small" quaternary :disabled="page <= 1" @click="goToPage(page - 1)">
                <template #icon><UiIcon name="chevron-left" :size="14" /></template>
                {{ t('mods.prevPage') }}
              </NButton>
              <span class="mods-pagination-info">{{ page }} / {{ totalPages }}</span>
              <NButton size="small" quaternary :disabled="page >= totalPages" @click="goToPage(page + 1)">
                {{ t('mods.nextPage') }}
                <template #icon><UiIcon name="chevron-right" :size="14" /></template>
              </NButton>
              <NButton size="small" quaternary :disabled="page >= totalPages" @click="goToPage(page + 10)">
                {{ t('mods.next10Pages') }}
                <template #icon><UiIcon name="chevron-right" :size="14" /></template>
              </NButton>
              <NButton size="small" quaternary circle :disabled="page >= totalPages" @click="goToPage(totalPages)">
                <template #icon><UiIcon name="chevrons-right" :size="14" /></template>
              </NButton>
            </div>
          </NScrollbar>
          <NEmpty
            v-else-if="!loading"
            class="mods-results-empty"
            :description="
              searched
                ? t('mods.noResults', { resource: resourceTypeLabel })
                : t('mods.searchHint', { resource: resourceTypeLabel })
            "
          >
            <template #icon><UiIcon name="cloud-download" :size="42" /></template>
          </NEmpty>
        </UiLoading>
      </div>
    </div>

    <FullscreenModal
      v-model:visible="detailsVisible"
      :title="selectedMod?.displayTitle || t('mods.details')"
      wrapperClass="mod-detail-fullscreen"
      bodyClass="mod-detail-body"
    >
      <div class="mod-detail-shell">
        <UiLoading :show="detailLoading" mode="overlay">
          <div v-if="selectedMod" class="mod-detail-content">
            <!-- 顶部：模组信息独占一行，简介全宽紧贴 -->
            <section class="mod-intro-card">
              <div class="mod-intro-top">
                <div class="mod-intro-avatar">
                  <img
                    v-if="detailIcon && !iconError"
                    :src="detailIcon"
                    :alt="selectedMod.displayTitle"
                    @error="iconError = true"
                  />
                  <UiIcon v-else name="cube" :size="22" />
                </div>
                <div class="mod-intro-heading">
                  <div class="mod-intro-title-row">
                    <h2>{{ selectedMod.displayTitle }}</h2>
                    <span class="mod-intro-subtitle">{{ selectedMod.title }} · {{ selectedMod.author }}</span>
                    <div class="mod-intro-tags">
                      <NTag v-if="resourceType !== 'mod'" size="small" :bordered="false" type="info">
                        {{ resourceTypeLabel }}
                      </NTag>
                      <template v-if="resourceType === 'mod'">
                        <NTag
                          v-for="loader in selectedMod.loaders.slice(0, 2)"
                          :key="`l:${loader}`"
                          size="small"
                          :bordered="false"
                        >
                          {{ loaderName(loader) }}
                        </NTag>
                      </template>
                      <NTag
                        v-for="category in selectedMod.categories.slice(0, 1)"
                        :key="`c:${category}`"
                        size="small"
                        :bordered="false"
                      >
                        {{ category }}
                      </NTag>
                    </div>
                  </div>
                </div>
                <div class="mod-intro-links">
                  <NButton v-if="activeSourceRef" size="small" secondary @click="openUrl(activeSourceRef.projectUrl)">
                    <template #icon><UiIcon name="external-link" :size="14" /></template>
                    {{ sourceLabel(activeSourceRef.source) }}
                  </NButton>
                  <NButton v-if="selectedMod.wiki" size="small" secondary @click="openUrl(selectedMod.wiki.url)">
                    <template #icon><UiIcon name="file-text" :size="14" /></template>
                    MCMOD百科
                  </NButton>
                </div>
              </div>
              <p class="mod-intro-description">
                {{ selectedMod.wiki?.summary || selectedMod.description || detailInfo?.description }}
              </p>
            </section>

            <!-- 条件筛选区：版本/加载器与实例选择同行，实例靠右 --- -->
            <section class="mod-filter-section">
              <div class="mod-filter-row">
                <div class="filter-item">
                  <div class="filter-title">
                    <UiIcon name="cube" :size="15" />
                    {{ t('mods.filterVersion') }}
                  </div>
                  <NSelect
                    v-model:value="detailVersionFilter"
                    :options="detailGameVersionOptions"
                    :placeholder="t('mods.none')"
                    size="small"
                    clearable
                    filterable
                  />
                </div>
                <div class="filter-item">
                  <div class="filter-title">
                    <UiIcon name="layers" :size="15" />
                    {{ t('mods.loaderType') }}
                  </div>
                  <span v-if="singleLoader" class="single-loader">{{ loaderName(singleLoader) }}</span>
                  <NSelect
                    v-else
                    v-model:value="detailLoaderFilter"
                    :options="detailLoaderOptions"
                    :placeholder="t('mods.none')"
                    size="small"
                    clearable
                  />
                </div>
                <div class="filter-item mod-filter-instance">
                  <div class="filter-title">
                    <UiIcon name="game-controller" :size="15" />
                    {{ t('mods.selectCompatibleInstance') }}
                  </div>
                  <ResourceInstanceSelect
                    :target="target"
                    :placeholder="t('mods.selectInstanceHint')"
                    compatibleOnly
                    showNoneOption
                    :noneLabel="t('mods.none')"
                    @persist="onInstancePersist"
                  />
                  <NButton
                    quaternary
                    circle
                    size="small"
                    :loading="refreshingInstances"
                    :title="t('common.refresh')"
                    @click="refreshCompatibleInstances"
                  >
                    <template #icon><UiIcon name="refresh" :size="15" /></template>
                  </NButton>
                </div>
              </div>
            </section>

            <!-- 下方：按 Minecraft 版本与加载器直接排列可折叠文件分组 -->
            <section class="mod-version-section">
              <div class="mod-section-title">
                <UiIcon name="layers" :size="15" />
                {{ t('mods.chooseVersion') }}
              </div>
              <template v-if="selectedMod.alternatives.length > 1">
                <label>{{ t('mods.downloadSource') }}</label>
                <NSelect
                  v-model:value="selectedSourceKey"
                  class="detail-source-select"
                  :options="detailSourceOptions"
                />
              </template>
              <template v-if="filteredVersionGroups.length">
                <div class="version-list">
                  <section
                    v-for="group in filteredVersionGroups"
                    :key="group.key"
                    class="version-accordion-group"
                    :class="{ selected: selectedGroupKey === group.key }"
                  >
                    <button
                      type="button"
                      class="version-group-header"
                      :aria-expanded="isVersionGroupExpanded(group.key)"
                      @click="toggleVersionGroup(group)"
                    >
                      <span class="version-group-title">{{ versionGroupLabel(group) }}</span>
                      <UiIcon
                        name="chevron-down"
                        :size="16"
                        class="version-group-chevron"
                        :class="{ expanded: isVersionGroupExpanded(group.key) }"
                      />
                    </button>
                    <div v-if="isVersionGroupExpanded(group.key)" class="version-group-files">
                      <RequiredModDependencies
                        v-if="resourceType === 'mod' && dependencyGroupKey === group.key"
                        :dependencies="requiredDependencies"
                        :loading="dependencyLoading"
                        :gameVersion="group.gameVersion"
                        @open="openDependencyDetails"
                      />
                      <button
                        v-for="file in group.files"
                        :key="file.id"
                        type="button"
                        class="version-file-row"
                        :class="{
                          selected: selectedFileId === file.id && selectedGroupKey === group.key,
                          'direct-action': usesDirectVersionAction,
                        }"
                        @click="selectVersionFile(group, file)"
                      >
                        <span class="version-number">
                          <span v-if="group.type === 'test' && testVersionPrefix(file)" class="version-test-prefix">
                            {{ testVersionPrefix(file) }}
                          </span>
                          {{ file.versionNumber }}
                        </span>
                        <span class="version-filename">{{ file.filename }}</span>
                        <UiIcon
                          v-if="
                            !usesDirectVersionAction && selectedFileId === file.id && selectedGroupKey === group.key
                          "
                          name="check"
                          :size="15"
                          class="version-check"
                        />
                      </button>
                    </div>
                  </section>
                </div>
              </template>
              <p v-else class="version-hint">{{ t('mods.noCompatibleVersion') }}</p>
            </section>
          </div>
        </UiLoading>
      </div>

      <template v-if="isModpack" #footer>
        <div class="mod-detail-footer">
          <div class="mod-detail-install">
            <NButton type="primary" :disabled="!selectedFileId" @click="openModpackOnlineInstall">
              <template #icon><UiIcon name="download" :size="15" /></template>
              {{ t('modpackImport.installPack') }}
            </NButton>
          </div>
        </div>
      </template>
      <template v-else-if="!usesDirectVersionAction" #footer>
        <div class="mod-detail-footer">
          <NButton secondary :disabled="!selectedFileId" :loading="savingAs" @click="handleSaveAs">
            <template #icon><UiIcon name="save" :size="15" /></template>
            {{ t('common.saveAs') }}
          </NButton>
          <div class="mod-detail-install">
            <span v-if="instance" class="install-target">
              {{ t('mods.installTo', { instance: instance.displayName }) }}
            </span>
            <NButton
              type="primary"
              :loading="installing"
              :disabled="!selectedFileId || !instance"
              @click="installSelected"
            >
              <template #icon><UiIcon name="download" :size="15" /></template>
              {{ installProgress || t('mods.install') }}
            </NButton>
          </div>
        </div>
      </template>
    </FullscreenModal>

    <ConfirmDialog
      v-model:visible="installConfirmVisible"
      :title="t('mods.installResourceTitle', { resource: resourceTypeLabel })"
      :confirmText="t('mods.install')"
      :cancelText="t('common.saveAs')"
      :loading="installing"
      :confirmDisabled="resourceType === 'datapack' && !selectedWorldId"
      :closeOnConfirm="false"
      @confirm="installSelected"
      @cancel="handleSaveAs"
    >
      <div class="version-install-confirm">
        <p v-if="instance" class="version-install-prompt">
          {{
            t('mods.installVersionPrompt', {
              mod: selectedMod?.displayTitle,
              version: selectedFile?.versionNumber,
              instance: instance.displayName,
            })
          }}
        </p>
        <div v-if="resourceType === 'datapack'" class="version-install-world">
          <span class="version-install-world-label">{{ t('mods.selectWorld') }}</span>
          <NSelect
            v-model:value="selectedWorldId"
            :options="worldOptions"
            :loading="worldsLoading"
            :placeholder="t('mods.selectWorld')"
            filterable
          />
          <span v-if="!worldsLoading && !worldOptions.length" class="version-install-world-hint">
            {{ t('mods.noWorld') }}
          </span>
        </div>
        <p v-if="installing && installProgress" class="version-install-progress">{{ installProgress }}</p>

        <RequiredModDependencies
          :dependencies="requiredDependencies"
          :loading="dependencyLoading"
          :gameVersion="selectedVersionContext.gameVersion"
          @open="openDependencyDetails"
        />
      </div>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NInput, NScrollbar, NSelect, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { globalCache, CACHE_GROUPS, CACHE_KEYS } from '@/cache'
import { useAutoRefreshCache } from '@/cache/composable'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import RequiredModDependencies from '@/components/mods/RequiredModDependencies.vue'
import ResourceInstanceSelect from '@/components/resources/ResourceInstanceSelect.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceKey, parseInstanceKey, useResourceInstallTarget } from '@/composables/useResourceInstallTarget'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import { LOADERS } from '@/config/version'
import {
  getPopularPage,
  getResourceSourceConfig,
  type DownloadResourceType,
} from '@/features/download/model/downloadPrefetch'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { useModpackImportStore } from '@/features/instances/stores/modpackImportStore'
import { modApi } from '@/features/mods/api/modApi'
import {
  aprilFoolsAnchor,
  groupModVersions,
  isModVersionCompatible,
  snapshotFamily,
  type ModVersionGroup,
  type VersionGroupType,
} from '@/features/mods/model/modVersionGroups'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import type { DownloadConfig } from '@/types/config'
import type {
  GameResourceType,
  MinecraftVersionCatalog,
  MinecraftVersionItem,
  MinecraftVersionType,
  ScannedVersion,
} from '@/types/instances'
import type { ModInfo, ModSearchItem, ModSourceReference, ModSourceStatus, ModVersion } from '@/types/mods'
import { getErrorMessage } from '@/utils/error'

const props = withDefaults(
  defineProps<{
    resourceType?: DownloadResourceType
    fixedSource?: 'modrinth' | 'curseforge'
  }>(),
  { resourceType: 'mod', fixedSource: undefined }
)

const emit = defineEmits<{
  (e: 'installed'): void
}>()

const { t, locale } = useI18n()
const resourceTypeLabel = computed(() =>
  props.resourceType === 'world' ? t('download.world.title') : t(`download.${props.resourceType}`)
)
const isModpack = computed(() => props.resourceType === 'modpack')
const modpackImportStore = useModpackImportStore()
const usesDirectVersionAction = computed(() =>
  ['mod', 'resourcepack', 'shaderpack', 'datapack', 'world'].includes(props.resourceType)
)
const message = useLauncherMessage()
const route = useRoute()
const router = useRouter()
const { loading, run } = useAsyncAction({ showSuccess: false, showError: false })

const target = useResourceInstallTarget(props.resourceType, true)
const instance = target.selectedInstance

const query = ref('')
const searched = ref(false)
const results = ref<ModSearchItem[]>([])
const sourceStatuses = ref<Record<string, ModSourceStatus>>({})
const PAGE_SIZE = 20
const page = ref(1)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const detailsVisible = ref(false)
const detailLoading = ref(false)
const refreshingInstances = ref(false)
const installConfirmVisible = ref(false)
const dependencyLoading = ref(false)
const selectedMod = ref<ModSearchItem | null>(null)
const detailInfo = ref<ModInfo | null>(null)
const versions = ref<ModVersion[]>([])
const requiredDependencies = ref<ModInfo[]>([])
const dependencyGroupKey = ref('')
const selectedVersionContext = ref({ gameVersion: '', loader: '' })
const preferredDetailFilter = ref<{ gameVersion: string; loader: string } | null>(null)
const versionGroups = computed(() => groupModVersions(versions.value, resolveVersionGroup))
const selectedGroupKey = ref('')
const expandedVersionGroupKeys = ref<string[]>([])
const versionLoaderOptions = computed(() =>
  Array.from(new Set(versions.value.flatMap((version) => version.loaders.map((loader) => loader.toLocaleLowerCase()))))
)
const detailVersionFilter = ref('')
const detailLoaderFilter = ref('')

// 版本目录 -> 版本号到类型的映射，用于版本下拉框按 正式版/测试版/愚人节版 分组
const versionTypeMap = computed<Record<string, MinecraftVersionType>>(() => {
  const map: Record<string, MinecraftVersionType> = {}
  const catalog = versionCatalogData.value
  if (!catalog) return map
  const types: (keyof MinecraftVersionCatalog)[] = ['release', 'snapshot', 'april_fools', 'old_beta', 'old_alpha']
  for (const type of types) {
    for (const item of catalog[type] ?? []) {
      map[item.id] = type
    }
  }
  return map
})

// 快照 -> 对应正式版：优先按名称中的版本族归并（26.3-snapshot-9 -> 26.3），否则按发布时间取下一个正式版
const versionDisplayMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  const catalog = versionCatalogData.value
  if (!catalog) return map
  const releases = [...catalog.release].sort((a, b) => a.releaseTime.localeCompare(b.releaseTime))
  for (const item of catalog.snapshot ?? []) {
    const family = snapshotFamily(item.id)
    const release = releases.find((entry) => entry.releaseTime > item.releaseTime)
    map[item.id] = family ?? release?.id ?? item.id
  }
  return map
})

// 版本分组解析：正式版/愚人节版归自己，快照等测试版归到对应正式版；
// 愚人节版按发布日期锚定到下一个正式版作为排序锚点，避免按字符串名错位
function resolveVersionGroup(gameVersion: string): {
  displayVersion: string
  type: VersionGroupType
  sortVersion: string
} {
  const type = versionTypeMap.value[gameVersion]
  if (type === 'april_fools') {
    return {
      displayVersion: gameVersion,
      type: 'april',
      sortVersion: aprilFoolsAnchor(gameVersion, versionCatalog.value, catalogAprilFools.value),
    }
  }
  if (type === 'release') return { displayVersion: gameVersion, type: 'release', sortVersion: gameVersion }
  const display = versionDisplayMap.value[gameVersion] ?? gameVersion
  return { displayVersion: display, type: 'test', sortVersion: display }
}

// 版本下拉框：按 正式版/测试版/愚人节版 分组，默认无
const detailGameVersionOptions = computed(() => {
  const modVersions = Array.from(new Set(versions.value.flatMap((version) => version.gameVersions)))
  const typeMap = versionTypeMap.value
  const groups: { release: string[]; test: string[]; april: string[] } = { release: [], test: [], april: [] }
  for (const id of modVersions) {
    const type = typeMap[id]
    if (type === 'april_fools') groups.april.push(id)
    else if (type === 'release') groups.release.push(id)
    else groups.test.push(id)
  }
  const options: Array<
    | { label: string; value: string }
    | { type: 'group'; label: string; children: Array<{ label: string; value: string }> }
  > = [{ label: t('mods.none'), value: '' }]
  const pushGroup = (label: string, values: string[]) => {
    if (values.length) {
      options.push({ type: 'group', label, children: values.map((id) => ({ label: id, value: id })) })
    }
  }
  pushGroup(t('versions.download.release'), groups.release)
  pushGroup(t('mods.testGroup'), groups.test)
  pushGroup(t('versions.download.aprilFools'), groups.april)
  return options
})
const detailLoaderOptions = computed(() => [
  { label: t('mods.none'), value: '' },
  ...uniqueOptions(versions.value.flatMap((version) => version.loaders.map((loader) => loader.toLocaleLowerCase()))),
])

// 模组只支持一种加载器时直接展示该加载器，不可切换
const singleLoader = computed(() => {
  const loaders = uniqueOptions(
    versions.value.flatMap((version) => version.loaders.map((loader) => loader.toLocaleLowerCase()))
  )
  return loaders.length === 1 ? (loaders[0]?.value ?? '') : ''
})

// 版本类型标签：正式版/测试版/愚人节版
function versionTypeLabel(type: VersionGroupType): string {
  if (type === 'april') return t('versions.download.aprilFools')
  if (type === 'release') return t('versions.download.release')
  return t('mods.testGroup')
}

// 版本类型排序权重：正式版在前，测试版次之，愚人节版最后
const VERSION_TYPE_ORDER: Record<VersionGroupType, number> = { release: 0, test: 1, april: 2 }

// 按游戏版本 / 加载器过滤版本分组，按排序锚点版本号降序排列，同版本正式版在前，空分组直接剔除
const filteredVersionGroups = computed(() => {
  // 下拉框清空后值为 null，需兜底为空字符串再比较
  const gameVersion = (detailVersionFilter.value ?? '').toLocaleLowerCase()
  const loader = (detailLoaderFilter.value ?? '').toLocaleLowerCase()
  // 快照选中时归并到对应正式版分组，正式版选中时同时展示该版本正式版与测试版分组
  const selectedDisplay = (gameVersion && versionDisplayMap.value[gameVersion]) || gameVersion
  return versionGroups.value
    .filter((group) => !gameVersion || group.gameVersion.toLocaleLowerCase() === selectedDisplay.toLocaleLowerCase())
    .filter((group) => !loader || !group.loader || group.loader.toLocaleLowerCase() === loader)
    .filter((group) => group.files.length > 0)
    .sort((left, right) => {
      const versionOrder = right.sortVersion.localeCompare(left.sortVersion, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      if (versionOrder !== 0) return versionOrder
      const typeOrder = VERSION_TYPE_ORDER[left.type] - VERSION_TYPE_ORDER[right.type]
      if (typeOrder !== 0) return typeOrder
      return left.loader.localeCompare(right.loader)
    })
})
const selectedSourceKey = ref('')
const selectedFileId = ref<string | null>(null)
const selectedFile = computed(() => versions.value.find((file) => file.id === selectedFileId.value) ?? null)
const installing = ref(false)
const installProgress = ref('')
const savingAs = ref(false)

const dragging = ref(false)
let dragDepth = 0

const selectedWorldId = ref<string | null>(null)
const worldOptions = ref<Array<{ label: string; value: string }>>([])
const worldsLoading = ref(false)

// 筛选与排序（作为搜索参数传给后端）
const versionFilter = ref('')
const loaderFilter = ref('')
const sourceFilter = ref(props.fixedSource ?? '')
const sortFilter = ref('')

// 搜索结果缓存：状态缓存持久化上次视图，页缓存加速翻页
interface ModSearchCacheState {
  instanceKey: string
  query: string
  source: string
  version: string
  loader: string
  sort: string
  page: number
  results: ModSearchItem[]
  total: number
  sources: Record<string, ModSourceStatus>
}

const STATE_CACHE_TTL = 24 * 60 * 60 * 1000

function stateCacheKey(): string {
  return `mod-search-state:${props.resourceType}`
}

const pageCache = new Map<
  string,
  { results: ModSearchItem[]; total: number; sources: Record<string, ModSourceStatus> }
>()
/** pageCache 最大条目数，防止长会话大量搜索/翻页导致内存持续增长 */
const PAGE_CACHE_MAX_ENTRIES = 60
// 请求序号守卫：旧请求晚到时不得覆盖新请求的搜索结果与详情数据
let searchRequestId = 0
let sourceRequestId = 0

function pageCacheKey(targetPage: number): string {
  const inst = instance.value
  const loader = props.resourceType === 'mod' ? loaderFilter.value || inst?.primaryLoader || '' : ''
  const gameVersion = versionFilter.value || inst?.vanillaName || ''
  return [
    target.selectedKey.value,
    props.resourceType,
    query.value.trim(),
    props.fixedSource || sourceFilter.value,
    gameVersion,
    loader,
    sortFilter.value,
    targetPage,
  ].join('\u0000')
}

function saveState(): void {
  globalCache.set<ModSearchCacheState>(
    stateCacheKey(),
    {
      instanceKey: target.selectedKey.value,
      query: query.value.trim(),
      source: props.fixedSource || sourceFilter.value,
      version: versionFilter.value,
      loader: loaderFilter.value,
      sort: sortFilter.value,
      page: page.value,
      results: results.value,
      total: total.value,
      sources: sourceStatuses.value,
    },
    { ttl: STATE_CACHE_TTL, persistent: false }
  )
}

function restoreState(): boolean {
  const cached = globalCache.get<ModSearchCacheState>(stateCacheKey())
  if (!cached || cached.instanceKey !== target.selectedKey.value) return false
  // 默认热门列表使用共享缓存的 10 分钟时效；搜索和翻页继续恢复原有视图。
  const defaultSource = props.resourceType === 'world' ? 'curseforge' : 'modrinth'
  if (
    cached.page === 1 &&
    !cached.query &&
    !cached.version &&
    !cached.loader &&
    !cached.sort &&
    (!cached.source || cached.source === defaultSource)
  )
    return false
  query.value = cached.query
  sourceFilter.value = props.fixedSource ?? cached.source
  versionFilter.value = cached.version
  loaderFilter.value = cached.loader
  sortFilter.value = cached.sort
  page.value = cached.page
  results.value = cached.results
  total.value = cached.total
  sourceStatuses.value = cached.sources
  searched.value = true
  return true
}

const { data: versionCatalogData, fetchData: fetchVersionCatalog } = useAutoRefreshCache<MinecraftVersionCatalog>(
  CACHE_KEYS.VERSIONS,
  () => instanceInstallApi.getCatalog(),
  { ttl: 10 * 60 * 1000, group: CACHE_GROUPS.VERSION, persistent: true, autoRefresh: false }
)

const versionCatalog = computed<MinecraftVersionItem[]>(() => versionCatalogData.value?.release ?? [])

const catalogAprilFools = computed<MinecraftVersionItem[]>(() => versionCatalogData.value?.april_fools ?? [])

const gameVersionOptions = computed(() => {
  if (versionCatalog.value.length) {
    return [
      { label: t('mods.allVersions'), value: '' },
      ...versionCatalog.value.map((v) => ({ label: v.id, value: v.id })),
    ]
  }
  return [
    { label: t('mods.allVersions'), value: '' },
    ...uniqueOptions(results.value.flatMap((item) => item.gameVersions)),
  ]
})

const loaderOptions = computed(() => {
  const modLoaders = LOADERS.filter((l) => !['vanilla', 'optifine', 'liteloader'].includes(l.value))
  return [{ label: t('mods.allLoaders'), value: '' }, ...modLoaders.map((l) => ({ label: l.label, value: l.value }))]
})

const curseforgeAvailable = ref(true)
const sourceOptions = computed(() => {
  const options = [
    { label: t('mods.allSources'), value: '' },
    { label: 'Modrinth', value: 'modrinth' },
    { label: 'CurseForge', value: 'curseforge', disabled: !curseforgeAvailable.value },
  ]
  if (isModpack.value) options.push({ label: 'FTB', value: 'ftb' })
  return options
})
const sortOptions = [
  { label: t('mods.sortDefault'), value: '' },
  { label: t('mods.sortRelevance'), value: 'relevance' },
  { label: t('mods.sortDownloads'), value: 'downloads' },
  { label: t('mods.sortFollows'), value: 'follows' },
  { label: t('mods.sortNewest'), value: 'newest' },
  { label: t('mods.sortUpdated'), value: 'updated' },
]

// 实例就绪后自动加载热门列表
let popularLoaded = false
// 标记首屏视图（恢复缓存或热门列表）是否已加载，避免实例切换 watch 重复触发首次启动
let listBootstrapped = false
watch(
  () => target.ready.value,
  (readyVal) => {
    if (!readyVal) return
    void fetchVersionCatalog()
    void getResourceSourceConfig()
      .then((config) => {
        curseforgeAvailable.value = config.curseforge?.available ?? true
        if (!props.fixedSource && !curseforgeAvailable.value && sourceFilter.value === 'curseforge') {
          sourceFilter.value = ''
        }
      })
      .catch(() => {})
    const queryQ = typeof route.query.q === 'string' ? route.query.q : ''
    handleQueryInstance()
    // 有搜索参数：自动搜索；无参数：恢复缓存视图或加载热门列表
    if (queryQ) {
      query.value = queryQ
      void handleSearch()
    } else if (!popularLoaded) {
      popularLoaded = true
      if (!restoreState()) {
        void loadPopular()
      }
    }
    listBootstrapped = true
  },
  { immediate: true }
)

// 归一化实例路径用于跨来源匹配：统一分隔符、忽略尾部斜杠，Windows 下忽略大小写
function normalizeInstancePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '')
}

// 读取 query.instance 并按当前实例自动选中安装位置，随后清除该参数
function handleQueryInstance(): void {
  const queryInstance = typeof route.query.instance === 'string' ? route.query.instance : ''
  if (!queryInstance) return
  const parsed = parseInstanceKey(queryInstance)
  const hit =
    target.installableInstances.value.find((version) => instanceKey(version) === queryInstance) ??
    target.installableInstances.value.find(
      (version) =>
        version.versionId === parsed.versionId &&
        normalizeInstancePath(version.path).toLowerCase() === normalizeInstancePath(parsed.path).toLowerCase()
    )
  if (hit) {
    target.setTarget(hit)
    void target.persist()
  }
  // 应用一次后清除 query，避免切页/后退时反复覆盖用户的选择
  const restQuery = { ...route.query }
  delete restQuery.instance
  void router.replace({ query: restQuery })
}

// 组件复用时（同路由仅 query 变化）也能响应新的 instance 参数
watch(
  () => route.query.instance,
  (value) => {
    if (typeof value === 'string') handleQueryInstance()
  }
)

// 实例切换后按新实例的派生条件（版本/加载器）刷新列表；用户手动条件仍优先
watch(
  () => target.selectedKey.value,
  (nextKey, prevKey) => {
    if (!target.ready.value || !listBootstrapped || nextKey === prevKey) return
    page.value = 1
    if (query.value.trim()) {
      void handleSearch(true)
    } else {
      void loadPopular(true)
    }
  }
)

const sourceWarnings = computed(() =>
  Object.entries(sourceStatuses.value)
    .filter(([, status]) => !status.available && status.error)
    .map(([name, status]) => ({ name: name === 'mcmod' ? 'MCMOD百科' : sourceLabel(name), error: status.error }))
)

function sourceKey(value: ModSourceReference): string {
  return `${value.source}:${value.projectId}`
}

const detailSourceOptions = computed(() =>
  (selectedMod.value?.alternatives ?? []).map((platform) => ({
    label: sourceLabel(platform.source),
    value: sourceKey(platform),
  }))
)

const activeSourceRef = computed(
  () => selectedMod.value?.alternatives.find((platform) => sourceKey(platform) === selectedSourceKey.value) ?? null
)

// 弹窗内图标优先取项目详情（更完整），搜索命中兜底
const detailIcon = computed(() => detailInfo.value?.iconUrl || selectedMod.value?.iconUrl || '')
const iconError = ref(false)
watch(detailIcon, () => {
  iconError.value = false
})

function sourceLabel(value: string): string {
  if (value === 'modrinth') return 'Modrinth'
  if (value === 'curseforge') return 'CurseForge'
  return value
}

function uniqueOptions(values: string[]): Array<{ label: string; value: string }> {
  return Array.from(new Set(values))
    .filter(Boolean)
    .map((value) => ({ label: value, value }))
}

function loaderName(value: string): string {
  if (value === 'neoforge') return 'NeoForge'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function updateVersionCompatibility(file: ModVersion | null): void {
  if (!file) {
    const mod = selectedMod.value
    target.setCompatibleFilter(mod ? { gameVersions: mod.gameVersions, loaders: mod.loaders } : null)
    return
  }
  target.setCompatibleFilter({
    gameVersions: file.gameVersions,
    loaders: props.resourceType === 'mod' ? file.loaders : [],
  })
}

function versionGroupLabel(group: ModVersionGroup): string {
  const showLoader = props.resourceType === 'mod' && versionLoaderOptions.value.length > 1 && group.loader
  const gameVersion = group.gameVersion || t('mods.unknown')
  const typeLabel = group.gameVersion ? versionTypeLabel(group.type) : ''
  return `${gameVersion}${typeLabel ? ` ${typeLabel}` : ''}${showLoader ? ` ${loaderName(group.loader)}` : ''}`
}

// 测试版分组内文件可能分属不同快照，取文件支持的测试版本号生成 [26w29a] 前缀用于区分
function testVersionPrefix(file: ModVersion): string {
  const testVersions = file.gameVersions.filter((id) => {
    const type = versionTypeMap.value[id]
    return type !== undefined && type !== 'release'
  })
  return testVersions.length ? `[${testVersions.join('/')}]` : ''
}

const DEPENDENCY_CACHE_TTL = 30 * 60 * 1000
let dependencyRequestId = 0

async function loadProjectInfo(
  source: ModInfo['source'],
  projectId: string,
  resourceType: GameResourceType | 'world' | 'modpack' = props.resourceType
): Promise<ModInfo> {
  const cacheKey = `mod-project-info:${source}:${resourceType}:${projectId}`
  const cached = globalCache.get<ModInfo>(cacheKey)
  if (cached) return cached
  const info = await modApi.info({ mod_id: projectId, source, resource_type: resourceType })
  globalCache.set(cacheKey, info, { ttl: DEPENDENCY_CACHE_TTL, group: CACHE_GROUPS.API })
  return info
}

async function loadRequiredDependencies(file: ModVersion, groupKey: string): Promise<void> {
  const requestId = ++dependencyRequestId
  dependencyGroupKey.value = groupKey
  requiredDependencies.value = []
  if (props.resourceType !== 'mod' || activeSourceRef.value?.source !== 'modrinth') {
    dependencyLoading.value = false
    return
  }

  dependencyLoading.value = true

  const projectIds = Array.from(
    new Set(
      (file.dependencies ?? [])
        .filter((dependency) => dependency.dependencyType === 'required' && dependency.projectId)
        .map((dependency) => dependency.projectId as string)
        .filter((projectId) => projectId !== file.projectId)
    )
  )
  if (!projectIds.length) {
    dependencyLoading.value = false
    return
  }

  try {
    const projects = await Promise.all(
      projectIds.map(async (projectId) => {
        try {
          return await loadProjectInfo('modrinth', projectId, 'mod')
        } catch {
          return null
        }
      })
    )
    if (requestId === dependencyRequestId) {
      requiredDependencies.value = projects.filter((project): project is ModInfo => project !== null)
    }
  } finally {
    if (requestId === dependencyRequestId) dependencyLoading.value = false
  }
}

function isVersionGroupExpanded(groupKey: string): boolean {
  return expandedVersionGroupKeys.value.includes(groupKey)
}

async function selectVersionFile(group: ModVersionGroup, file: ModVersion): Promise<void> {
  selectedGroupKey.value = group.key
  selectedFileId.value = file.id
  selectedVersionContext.value = { gameVersion: group.gameVersion, loader: group.loader }
  // 整合包不绑定现有实例：选中版本后直接打开在线安装对话框
  if (isModpack.value) {
    openModpackOnlineInstall()
    return
  }
  // 兼容实例始终继承所选 mod 的项目级兼容选项（openDetails 已按 mod.gameVersions/loaders 设置），
  // 不随所选文件收窄，保证弹窗「选择兼容实例」与下载页保持一致。
  if (props.resourceType === 'mod') void loadRequiredDependencies(file, group.key)
  if (!usesDirectVersionAction.value) return

  if (instance.value) {
    installConfirmVisible.value = true
    return
  }
  await handleSaveAs()
}

/** 打开在线整合包安装对话框：预填当前来源与所选版本文件。 */
function openModpackOnlineInstall(): void {
  const mod = selectedMod.value
  const platform = activeSourceRef.value
  const fileId = selectedFileId.value
  if (!mod || !platform || !fileId) return
  detailsVisible.value = false
  void modpackImportStore.openOnline({
    source: platform.source,
    projectId: platform.projectId,
    fileId,
    title: mod.displayTitle,
  })
}

function toggleVersionGroup(group: ModVersionGroup): void {
  if (isVersionGroupExpanded(group.key)) {
    expandedVersionGroupKeys.value = expandedVersionGroupKeys.value.filter((key) => key !== group.key)
    return
  }

  expandedVersionGroupKeys.value = [...expandedVersionGroupKeys.value, group.key]
  const inst = instance.value
  const preferred = inst
    ? group.files.find((file) => isModVersionCompatible(file, inst.vanillaName, inst.primaryLoader))
    : undefined
  const file = preferred ?? group.files[0]
  if (!file) return
  if (usesDirectVersionAction.value) {
    if (props.resourceType === 'mod') {
      selectedVersionContext.value = { gameVersion: group.gameVersion, loader: group.loader }
      void loadRequiredDependencies(file, group.key)
    }
    return
  }
  void selectVersionFile(group, file)
}

function initializeVersionGroups(files: ModVersion[]): void {
  const groups = groupModVersions(files, resolveVersionGroup)
  expandedVersionGroupKeys.value = []

  const inst = instance.value
  const preferred = inst
    ? groups.find((group) =>
        group.files.some((file) => isModVersionCompatible(file, inst.vanillaName, inst.primaryLoader))
      )
    : undefined
  if (!preferred || !inst) {
    selectedGroupKey.value = ''
    selectedFileId.value = null
    updateVersionCompatibility(null)
    return
  }

  const compatibleFile = preferred.files.find((file) =>
    isModVersionCompatible(file, inst.vanillaName, inst.primaryLoader)
  )
  if (!compatibleFile) return
  expandedVersionGroupKeys.value = [preferred.key]
  if (!usesDirectVersionAction.value) {
    void selectVersionFile(preferred, compatibleFile)
    return
  }
  selectedGroupKey.value = ''
  selectedFileId.value = null
  updateVersionCompatibility(null)
}

function formatDownloads(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

const TIME_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 365 * 24 * 3600 },
  { unit: 'month', seconds: 30 * 24 * 3600 },
  { unit: 'week', seconds: 7 * 24 * 3600 },
  { unit: 'day', seconds: 24 * 3600 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
]

function formatRelativeTime(value: string): string {
  const delta = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(delta)) return ''
  const absSeconds = Math.abs(delta) / 1000
  let matched = TIME_UNITS.find((entry) => absSeconds >= entry.seconds)
  if (!matched) matched = { unit: 'minute', seconds: 60 }
  const amount = Math.round(delta / 1000 / matched.seconds)
  return new Intl.RelativeTimeFormat(locale.value).format(amount, matched.unit)
}

function onInstancePersist(): void {
  void target.persist()
}

async function refreshCompatibleInstances(): Promise<void> {
  if (refreshingInstances.value) return
  refreshingInstances.value = true
  try {
    await target.refreshInstances()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    refreshingInstances.value = false
  }
}

watch(
  () => [props.resourceType, instance.value?.path, instance.value?.versionId],
  async ([, path, versionId]) => {
    if (props.resourceType !== 'datapack' || !path || !versionId) {
      worldOptions.value = []
      selectedWorldId.value = null
      return
    }
    const selected = instance.value
    if (!selected) return
    worldsLoading.value = true
    try {
      const worlds = await instanceWorkspaceApi.worlds(workspaceTarget(selected))
      worldOptions.value = worlds.map((world) => ({ label: world.name, value: world.id }))
      selectedWorldId.value = worlds[0]?.id ?? null
    } catch {
      worldOptions.value = []
      selectedWorldId.value = null
    } finally {
      worldsLoading.value = false
    }
  }
)

async function fetchPage(targetPage: number, force = false) {
  const inst = instance.value
  const loader = props.resourceType === 'mod' ? loaderFilter.value || inst?.primaryLoader || '' : ''
  const source = props.fixedSource || sourceFilter.value || 'modrinth'
  const isDefaultPopular =
    targetPage === 1 &&
    !query.value.trim() &&
    !versionFilter.value &&
    !loaderFilter.value &&
    !sortFilter.value &&
    source === (props.resourceType === 'world' ? 'curseforge' : 'modrinth')
  const key = pageCacheKey(targetPage)
  if (!force && !isDefaultPopular) {
    const cached = pageCache.get(key)
    if (cached) {
      // 命中缓存同样要作废在途请求，避免慢响应稍后覆盖缓存结果
      searchRequestId += 1
      results.value = cached.results
      total.value = cached.total
      sourceStatuses.value = cached.sources
      page.value = targetPage
      return
    }
  }
  const requestId = ++searchRequestId
  const response = await run(() =>
    isDefaultPopular
      ? getPopularPage(props.resourceType, inst, target.selectedKey.value, force)
      : modApi.search({
          query: query.value.trim(),
          source,
          game_version: versionFilter.value || inst?.vanillaName || '',
          loader_type: loader,
          resource_type: props.resourceType,
          limit: PAGE_SIZE,
          offset: (targetPage - 1) * PAGE_SIZE,
          sort: sortFilter.value,
        })
  ).catch((error) => {
    message.error(getErrorMessage(error))
    return undefined
  })
  if (!response || requestId !== searchRequestId) return
  const items = response.items ?? []
  const totalCount = response.total ?? items.length
  const sources = response.sources ?? {}
  results.value = items
  total.value = totalCount
  sourceStatuses.value = sources
  page.value = targetPage
  if (pageCache.size >= PAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = pageCache.keys().next().value
    if (oldestKey !== undefined) pageCache.delete(oldestKey)
  }
  pageCache.set(key, { results: items, total: totalCount, sources })
  saveState()
}

async function handleSearch(force = false) {
  const trimmed = query.value.trim()
  if (trimmed.length > 100) {
    message.error(t('mods.queryTooLong'))
    return
  }

  searched.value = true
  query.value = trimmed
  await fetchPage(1, force)
}

async function loadPopular(force = false) {
  searched.value = true
  query.value = ''
  await fetchPage(1, force)
}

async function goToPage(targetPage: number) {
  if (targetPage < 1 || targetPage > totalPages.value || targetPage === page.value) return
  await fetchPage(targetPage)
}

function refreshResults(): void {
  void (query.value.trim() ? handleSearch(true) : loadPopular(true))
}

function resetConditions(): void {
  versionFilter.value = ''
  loaderFilter.value = ''
  sourceFilter.value = ''
  sortFilter.value = ''
}

function openDetails(mod: ModSearchItem, preferred: { gameVersion: string; loader: string } | null = null): void {
  installConfirmVisible.value = false
  preferredDetailFilter.value = preferred
  selectedMod.value = mod
  const initialSource = mod.alternatives[0] ?? {
    source: mod.source,
    projectId: mod.projectId,
    slug: mod.slug,
    projectUrl: mod.projectUrl,
  }
  selectedSourceKey.value = sourceKey(initialSource)
  detailInfo.value = null
  versions.value = []
  selectedGroupKey.value = ''
  expandedVersionGroupKeys.value = []
  selectedFileId.value = null
  dependencyRequestId += 1
  dependencyLoading.value = false
  requiredDependencies.value = []
  dependencyGroupKey.value = ''
  detailVersionFilter.value = ''
  detailLoaderFilter.value = ''
  // 搜索页和详情页共用同一个安装目标；仅在当前实例不兼容时清空。
  target.setCompatibleFilter({ gameVersions: mod.gameVersions, loaders: mod.loaders })
  detailsVisible.value = true
}

function openDependencyDetails(info: ModInfo): void {
  const source = info.source
  const mod: ModSearchItem = {
    id: `${source}:${info.id}`,
    projectId: info.id,
    slug: info.slug,
    title: info.title,
    displayTitle: info.title,
    description: info.description,
    author: info.author,
    iconUrl: info.iconUrl,
    downloads: 0,
    follows: 0,
    source,
    projectUrl: info.projectUrl,
    categories: [],
    loaders: info.loaders,
    gameVersions: info.gameVersions,
    resourceType: 'mod',
    alternatives: [{ source, projectId: info.id, slug: info.slug, projectUrl: info.projectUrl }],
  }
  openDetails(mod, { ...selectedVersionContext.value })
}

// 关闭详情时只解除兼容过滤，保留与搜索页联动后的实例选择。
watch(detailsVisible, (val) => {
  if (!val) {
    installConfirmVisible.value = false
    target.setCompatibleFilter(null)
  }
})

// 打开弹窗或切换下载源时加载完整版本列表，供版本与加载器分组展示
watch(
  () => [detailsVisible.value, selectedSourceKey.value],
  () => {
    if (detailsVisible.value && selectedMod.value && activeSourceRef.value) {
      void loadSelectedSource()
    }
  }
)

// 实例条件同步：版本/加载器与所选实例一致，模组不支持该版本/加载器时保持无
function syncFiltersFromInstance(inst: ScannedVersion): void {
  const hasGameVersion = versions.value.some((v) => v.gameVersions.includes(inst.vanillaName))
  detailVersionFilter.value = hasGameVersion ? inst.vanillaName : ''
  const loaderLower = inst.primaryLoader.toLocaleLowerCase()
  const hasLoader = versions.value.some((v) => v.loaders.map((l) => l.toLocaleLowerCase()).includes(loaderLower))
  detailLoaderFilter.value = hasLoader ? loaderLower : ''
}

// 选择实例变化时：同步版本和加载器条件
watch(instance, (inst) => {
  if (inst) syncFiltersFromInstance(inst)
})

// 条件变化时：若当前实例不匹配则清空实例选择
watch([detailVersionFilter, detailLoaderFilter], () => {
  const inst = instance.value
  if (!inst) return
  const versionMatch =
    !detailVersionFilter.value || inst.vanillaName.toLocaleLowerCase() === detailVersionFilter.value.toLocaleLowerCase()
  const loaderMatch =
    !detailLoaderFilter.value || inst.primaryLoader.toLocaleLowerCase() === detailLoaderFilter.value.toLocaleLowerCase()
  if (!versionMatch || !loaderMatch) {
    target.clearTarget()
  }
})

async function loadSelectedSource() {
  const platform = activeSourceRef.value
  if (!platform) return
  const requestId = ++sourceRequestId
  detailInfo.value = null
  versions.value = []
  selectedGroupKey.value = ''
  expandedVersionGroupKeys.value = []
  selectedFileId.value = null
  dependencyRequestId += 1
  dependencyLoading.value = false
  requiredDependencies.value = []
  dependencyGroupKey.value = ''
  detailVersionFilter.value = ''
  detailLoaderFilter.value = ''
  detailLoading.value = true
  try {
    const [info, files] = await Promise.all([
      loadProjectInfo(platform.source, platform.projectId),
      modApi.versions({
        mod_id: platform.projectId,
        source: platform.source,
        game_version: '',
        loader_type: '',
        resource_type: props.resourceType,
      }),
    ])
    // 请求已被更新的来源/弹窗切换作废，丢弃响应避免旧源数据装到新源上
    if (requestId !== sourceRequestId) return
    detailInfo.value = info
    versions.value = files
    const preferred = preferredDetailFilter.value
    // 从前置模组卡片进入时优先定位原游戏版本；否则与当前实例联动。
    const inst = instance.value
    if (preferred?.gameVersion && files.some((version) => version.gameVersions.includes(preferred.gameVersion))) {
      detailVersionFilter.value = preferred.gameVersion
      const loader = preferred.loader.toLocaleLowerCase()
      detailLoaderFilter.value = files.some((version) =>
        version.loaders.some((item) => item.toLocaleLowerCase() === loader)
      )
        ? loader
        : ''
    } else if (inst) {
      syncFiltersFromInstance(inst)
    } else {
      const loaders = uniqueOptions(
        files.flatMap((version) => version.loaders.map((loader) => loader.toLocaleLowerCase()))
      )
      detailLoaderFilter.value = loaders.length === 1 ? (loaders[0]?.value ?? '') : ''
    }
    initializeVersionGroups(files)
    if (preferred?.gameVersion) {
      const matchingGroups = versionGroups.value.filter(
        (group) =>
          group.gameVersion.toLocaleLowerCase() === preferred.gameVersion.toLocaleLowerCase() &&
          (!preferred.loader || group.loader.toLocaleLowerCase() === preferred.loader.toLocaleLowerCase())
      )
      if (matchingGroups.length) expandedVersionGroupKeys.value = matchingGroups.map((group) => group.key)
    }
  } catch (error) {
    if (requestId === sourceRequestId) message.error(getErrorMessage(error))
  } finally {
    // 被更新的请求作废时不得清理 loading/偏好，交给最新请求处理
    if (requestId === sourceRequestId) {
      preferredDetailFilter.value = null
      detailLoading.value = false
    }
  }
}

async function installSelected() {
  const mod = selectedMod.value
  const inst = instance.value
  const platform = activeSourceRef.value
  const fileId = selectedFileId.value
  if (!mod || !inst || !platform || !fileId) return
  // 兼容实例继承 mod 项目级选项，安装前仍需校验所选文件与实例的游戏版本/加载器是否匹配，避免装错
  if (selectedFile.value && !isModVersionCompatible(selectedFile.value, inst.vanillaName, inst.primaryLoader)) {
    message.warning(t('mods.instanceCompatibleWarning'))
    return
  }
  if (props.resourceType === 'datapack' && !selectedWorldId.value) {
    message.warning(t('mods.selectWorld'))
    return
  }
  installing.value = true
  installProgress.value = t('mods.resolvingDependencies')
  const loader = props.resourceType === 'mod' ? inst.primaryLoader : ''
  const taskId = globalTaskQueue.addTask({
    type: 'download',
    name: mod.displayTitle,
    versionId: inst.vanillaName,
    loaderType: loader,
  })
  try {
    const result = await modApi.install({
      mod_id: platform.projectId,
      source: platform.source,
      file_id: fileId,
      game_path: inst.path,
      instance_id: inst.versionId,
      game_version: inst.vanillaName,
      loader_type: loader,
      resource_type: props.resourceType,
      world_id: props.resourceType === 'datapack' ? (selectedWorldId.value ?? undefined) : undefined,
      task_id: taskId,
    })
    const successMessage = t('mods.installSuccess', {
      count: result.installed.length,
      resource: resourceTypeLabel.value,
    })
    globalTaskQueue.updateTask(taskId, { status: 'completed', progress: 100, message: successMessage })
    message.success(successMessage)
    installConfirmVisible.value = false
    detailsVisible.value = false
    await target.persist()
    emit('installed')
  } catch (error) {
    const messageText = getErrorMessage(error)
    globalTaskQueue.updateTask(taskId, { status: 'error', message: messageText })
    message.error(messageText)
  } finally {
    installing.value = false
    installProgress.value = ''
  }
}

async function openUrl(url: string) {
  if (!url) return
  await modApi.openUrl(url).catch((error) => message.error(getErrorMessage(error)))
}

function parentDirectory(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const separatorIndex = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  if (separatorIndex < 0) return ''
  const directory = trimmed.slice(0, separatorIndex)
  return /^[A-Za-z]:$/.test(directory) ? `${directory}\\` : directory
}

function joinLocalPath(directory: string, filename: string): string {
  const separator = directory.includes('\\') ? '\\' : '/'
  return `${directory.replace(/[\\/]+$/, '')}${separator}${filename}`
}

function lastLaunchedResourceDirectory(): string {
  const launchedAt = (candidate: ScannedVersion): number => {
    const timestamp = Date.parse(candidate.lastLaunchedAt ?? '')
    return Number.isFinite(timestamp) ? timestamp : 0
  }
  const latest = [...target.installableInstances.value]
    .filter((candidate) => candidate.lastLaunchedAt)
    .sort((left, right) => launchedAt(right) - launchedAt(left))[0]
  const fallback = latest ?? instance.value ?? target.installableInstances.value[0]
  if (!fallback) return ''
  const directory =
    props.resourceType === 'world'
      ? 'saves'
      : {
          mod: 'mods',
          resourcepack: 'resourcepacks',
          shaderpack: 'shaderpacks',
          datapack: 'datapacks',
          // 整合包不支持另存为，仅为类型完备
          modpack: 'mods',
          schematic: 'schematics',
        }[props.resourceType]
  return joinLocalPath(fallback.path, directory)
}

async function readDownloadConfig(): Promise<DownloadConfig> {
  return (unwrapResponse(await backend.config.get('download'), '读取下载设置') ?? {}) as DownloadConfig
}

async function persistSaveDirectory(path: string): Promise<void> {
  const directory = parentDirectory(path)
  if (!directory) return
  const current = await readDownloadConfig()
  await backend.config.set('download', {
    ...current,
    resourceSaveDirectories: {
      ...(current.resourceSaveDirectories ?? {}),
      [props.resourceType]: directory,
    },
  })
}

async function handleSaveAs() {
  const mod = selectedMod.value
  const platform = activeSourceRef.value
  const fileId = selectedFileId.value
  if (!mod || !platform || !fileId || savingAs.value) return
  try {
    const config = await readDownloadConfig()
    const defaultDirectory = config.resourceSaveDirectories?.[props.resourceType] || lastLaunchedResourceDirectory()
    const selected = unwrapResponse(
      await backend.command('select_save_file', {
        purpose: 'mod-file',
        default_directory: defaultDirectory || undefined,
        default_name: selectedFile.value?.filename || undefined,
      }),
      '选择保存位置'
    )
    if (!selected.path) return
    savingAs.value = true
    await modApi.downloadToPath({
      mod_id: platform.projectId,
      source: platform.source,
      file_id: fileId,
      save_path: selected.path,
      resource_type: props.resourceType,
    })
    await persistSaveDirectory(selected.path)
    message.success(t('mods.saveAsSuccess', { path: selected.path }))
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    savingAs.value = false
  }
}

function handleDragEnter() {
  dragDepth += 1
  dragging.value = true
}

function handleDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

async function handleDrop(event: DragEvent) {
  dragging.value = false
  dragDepth = 0
  const inst = instance.value
  if (!inst) {
    message.warning(t('mods.selectInstanceFirst'))
    return
  }
  const paths = [...(event.dataTransfer?.files || [])]
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path))
  if (!paths.length) {
    message.warning(t('mods.dropToInstall'))
    return
  }
  try {
    if (props.resourceType === 'modpack') {
      // 整合包拖放由全局拖放层（App.vue）接管，不装入现有实例
      return
    }
    if (props.resourceType === 'mod') {
      for (const path of paths) await instanceWorkspaceApi.addMod(workspaceTarget(inst), path)
    } else if (props.resourceType === 'world') {
      for (const path of paths) await instanceWorkspaceApi.importWorld(workspaceTarget(inst), path)
    } else {
      const worldId = props.resourceType === 'datapack' ? (selectedWorldId.value ?? undefined) : undefined
      await instanceWorkspaceApi.installResources(workspaceTarget(inst), props.resourceType, paths, worldId)
    }
    message.success(t('mods.installSuccess', { count: paths.length, resource: resourceTypeLabel.value }))
    await target.persist()
    emit('installed')
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}

async function chooseAndImportWorld(): Promise<void> {
  const inst = instance.value
  if (!inst) {
    message.warning(t('mods.selectInstanceFirst'))
    return
  }
  try {
    const selected = unwrapResponse(
      await backend.command('select_file', { purpose: 'world-import' }),
      t('download.world.importLocal')
    )
    if (!selected.path) return
    await instanceWorkspaceApi.importWorld(workspaceTarget(inst), selected.path)
    message.success(t('download.world.importSuccess'))
    await target.persist()
    emit('installed')
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}
</script>

<style scoped src="@/styles/views/OnlineMods.css"></style>
