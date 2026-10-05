<template>
  <div class="install-page">
    <!-- 顶部栏：类型筛选 + 搜索 -->
    <div class="panel-header">
      <UiSelect v-model="selectedCategory" :options="categoryOptions" class="category-select" />

      <div class="header-right">
        <span v-if="filteredVersions.length > 0" class="version-count-badge">
          {{ t('versions.download.versionCount', { count: filteredVersions.length }) }}
        </span>
        <button class="btn-refresh" @click="fetchVersions(true)">
          <UiIcon name="refresh" :size="14" />
          {{ t('versions.download.refreshList') }}
        </button>
        <div class="search-box">
          <UiIcon name="search" :size="16" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('versions.download.searchVersion')"
            class="search-input"
          />
          <button v-if="searchQuery" class="search-clear" type="button" @click="searchQuery = ''">
            <UiIcon name="close" :size="14" />
          </button>
        </div>
        <PluginSlotHost slotId="plugin-slot-versions-list-toolbar" class="plugin-slot-container" />
      </div>
    </div>

    <!-- 版本列表 -->
    <div class="version-panel">
      <div class="version-content">
        <!-- 加载中 -->
        <UiLoading v-if="loading" :label="t('versions.download.fetchingList')" />

        <!-- 空状态 -->
        <div v-else-if="filteredVersions.length === 0" class="empty-state">
          <UiIcon name="cube" :size="48" class="empty-icon" />
          <p class="empty-text">
            {{ t('versions.download.noVersions') }}
          </p>
          <p class="empty-hint">
            {{ t('versions.download.checkNetwork') }}
          </p>
          <button class="btn-primary" @click="fetchVersions(true)">
            <UiIcon name="refresh" :size="16" />
            {{ t('versions.download.refreshList') }}
          </button>
        </div>

        <!-- 版本列表 -->
        <div v-else ref="scrollContainerRef" class="version-list-scroll" @scroll="handleScroll">
          <div class="virtual-scroll-container" :style="{ height: `${totalHeight}px` }">
            <div class="virtual-scroll-content" :style="{ transform: `translateY(${topOffset}px)` }">
              <div
                v-for="version in visibleVersions"
                :key="version.id"
                class="version-item"
                :style="{ height: `${itemHeight}px` }"
              >
                <div
                  class="version-icon"
                  :class="[version.type, { 'has-image': Boolean(getVersionImage(version.type)) }]"
                >
                  <img
                    v-if="getVersionImage(version.type)"
                    :src="getVersionImage(version.type)"
                    alt=""
                    class="version-icon-img"
                  />
                  <UiIcon v-else :name="getVersionIcon(version.type)" :size="18" />
                </div>

                <div class="version-info">
                  <div class="version-header">
                    <span class="version-id">{{ version.id }}</span>
                    <span :class="['badge', getVersionBadgeClass(version.type)]">
                      {{ getVersionTypeLabel(version.type) }}
                    </span>
                  </div>
                  <span class="version-date">
                    <UiIcon name="calendar" :size="12" />
                    {{ formatDate(version.releaseTime) }}
                  </span>
                </div>

                <div class="version-actions">
                  <button
                    class="btn-install"
                    :title="t('versions.download.install')"
                    :disabled="downloading === version.id"
                    @click="openInstallWithVersion(version.id)"
                  >
                    <UiIcon name="download" :size="16" />
                    <span class="btn-install-text">{{ t('versions.download.install') }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <InstanceInstallModal
      v-model:visible="showInstallDialog"
      v-model:versionName="installForm.versionName"
      v-model:loaderVersion="installForm.loaderVersion"
      v-model:fabricApiVersion="installForm.fabricApiVersion"
      v-model:gamePath="installForm.gamePath"
      :mcVersion="installForm.mcVersion"
      :versionTypeLabel="installVersionTypeLabel"
      :versionImage="installVersionImage"
      :defaultVersionName="defaultVersionName"
      :loader="installForm.loader"
      :loaderVersionOptions="getLoaderVersionOptions(installForm.loader)"
      :loaderVersionsLoading="loaderVersionsLoading"
      :fabricApiVersionOptions="fabricApiVersionOptions"
      :fabricApiVersionsLoading="fabricApiVersionsLoading"
      :gamePaths="gamePaths"
      :loaders="loaders"
      :isSubmittingInstall="isSubmittingInstall"
      @selectLoader="selectLoader"
      @install="startInstall"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAutoRefreshCache, CACHE_KEYS, CACHE_GROUPS } from '@/cache/composable'
import InstanceInstallModal from '@/components/instances/InstanceInstallModal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiSelect from '@/components/ui/Select.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import {
  VERSION_FILTERS,
  INSTALLABLE_LOADERS,
  getVersionIcon as _getVersionIcon,
  getVersionImage as _getVersionImage,
  getVersionBadgeClass as _getVersionBadgeClass,
  getVersionLabelKey,
} from '@/config/version'
import { instanceInstallApi, type InstallableLoader } from '@/features/instances/api/instanceInstallApi'
import { useInstanceInstallStore } from '@/features/instances/stores/instanceInstallStore'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { CommandPayloadMap } from '@/types/api'
import type { MinecraftPathEntry } from '@/types/config'
import type { MinecraftVersionCatalog, MinecraftVersionItem, MinecraftVersionType } from '@/types/instances'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const launcherMessage = useLauncherMessage()
const { run } = useAsyncAction({ showSuccess: false, showError: false })
const installStore = useInstanceInstallStore()
const settingsStore = useSettingsStore()
const {
  loaderVersions,
  loaderVersionsLoading,
  fabricApiVersions,
  fabricApiVersionsLoading,
  submittingVersionId: downloading,
  isSubmittingInstall,
} = storeToRefs(installStore)

const searchQuery = ref('')
const selectedCategory = ref('all')

const {
  data: versionCatalog,
  loading,
  error: versionsError,
  fetchData: fetchVersionsData,
} = useAutoRefreshCache<MinecraftVersionCatalog>(CACHE_KEYS.VERSIONS, () => instanceInstallApi.getCatalog(), {
  ttl: 10 * 60 * 1000,
  group: CACHE_GROUPS.VERSION,
  persistent: true,
})

/**
 * 通用加载器版本加载函数
 * Store 内部使用请求 ID 防止旧响应覆盖新选择。
 */
async function loadLoaderVersions(loaderType: string, gameVersion: string) {
  if (!['fabric', 'forge', 'neoforge', 'quilt'].includes(loaderType)) return
  try {
    const versions = await installStore.loadLoaderVersions(loaderType as InstallableLoader, gameVersion)
    if (versions?.length === 0) {
      const loaderName = loaderType.charAt(0).toUpperCase() + loaderType.slice(1)
      launcherMessage.warning(t('versions.download.noLoaderVersions', { loader: loaderName }))
    }
  } catch (e: unknown) {
    console.error(`获取 ${loaderType} 版本失败:`, e)
  }
}

async function loadFabricVersions(gameVersion: string) {
  await loadLoaderVersions('fabric', gameVersion)
}

async function loadForgeVersions(gameVersion: string) {
  await loadLoaderVersions('forge', gameVersion)
}

async function loadNeoforgeVersions(gameVersion: string) {
  await loadLoaderVersions('neoforge', gameVersion)
}

async function loadQuiltVersions(gameVersion: string) {
  await loadLoaderVersions('quilt', gameVersion)
}

async function loadFabricApiVersions(gameVersion: string) {
  try {
    await installStore.loadFabricApiVersions(gameVersion)
  } catch (e: unknown) {
    console.error('获取 Fabric API 版本失败:', e)
  }
}

const scrollContainerRef = ref<HTMLElement | null>(null)
const visibleRange = ref({ start: 0, end: 20 })
const itemHeight = 56
const bufferSize = 5

const showInstallDialog = ref(false)
watch(
  showInstallDialog,
  (visible) => {
    if (!visible) installStore.clearLoaderVersions()
  },
  { flush: 'sync' }
)

const installForm = ref({
  mcVersion: '',
  versionName: '',
  loader: 'vanilla',
  loaderVersion: '',
  fabricApiVersion: '',
  gamePath: '',
})

const categories = computed(() =>
  VERSION_FILTERS.map((c) => ({
    id: c.id,
    name: t(c.labelKey),
    icon: c.icon,
  }))
)

const categoryOptions = computed(() =>
  categories.value.map((c) => ({
    value: c.id,
    label: `${c.name} (${getCategoryCount(c.id)})`,
  }))
)

const loaders = INSTALLABLE_LOADERS.map((l) => ({
  value: l.value,
  label: l.label,
  icon: l.icon,
  image: l.image || (l.value === 'vanilla' ? '/img/item/grass.png' : ''),
}))

function getCategoryCount(categoryId: string): number {
  const catalog = versionCatalog.value
  if (!catalog) return 0
  return catalog[categoryId as keyof MinecraftVersionCatalog]?.length || 0
}

/**
 * 构建版本 ID 到真实类型的映射表。
 * 后端返回的 all 数组中 type 可能全部为 'all'，需要按分类数组校正。
 */
const versionTypeMap = computed(() => {
  const catalog = versionCatalog.value
  const map = new Map<string, string>()
  if (!catalog) return map
  const typeKeys: (keyof MinecraftVersionCatalog)[] = ['release', 'snapshot', 'april_fools', 'old_beta', 'old_alpha']
  for (const type of typeKeys) {
    const list = catalog[type]
    if (!Array.isArray(list)) continue
    for (const v of list) {
      if (v?.id) map.set(v.id, type)
    }
  }
  return map
})

const installVersionType = computed(() => versionTypeMap.value.get(installForm.value.mcVersion) || 'release')
const installVersionTypeLabel = computed(() => getVersionTypeLabel(installVersionType.value))
const installVersionImage = computed(() => getVersionImage(installVersionType.value) || '/img/item/grass.png')

const filteredVersions = computed(() => {
  const catalog = versionCatalog.value
  let versions: MinecraftVersionItem[] = []
  if (catalog) {
    versions = catalog[selectedCategory.value as keyof MinecraftVersionCatalog] || []
  }

  // 校正 all 分类下版本的 type，避免全部显示为 'all'
  const typeMap = versionTypeMap.value
  versions = versions.map((v) => {
    const realType = typeMap.get(v.id)
    if (realType && realType !== 'all' && v.type !== realType) {
      return { ...v, type: realType as MinecraftVersionType }
    }
    return v
  })

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    versions = versions.filter((v) => v.id.toLowerCase().includes(query))
  }
  // 按发布时间降序排列
  return versions.slice().sort((a, b) => {
    const ta = a.releaseTime ? new Date(a.releaseTime).getTime() : 0
    const tb = b.releaseTime ? new Date(b.releaseTime).getTime() : 0
    return tb - ta
  })
})

const visibleVersions = computed(() => {
  const { start, end } = visibleRange.value
  return (filteredVersions.value || []).slice(start, end)
})

const totalHeight = computed(() => (filteredVersions.value || []).length * itemHeight)
const topOffset = computed(() => visibleRange.value.start * itemHeight)

async function fetchVersions(force = false) {
  await fetchVersionsData(force)
  if (versionsError.value) {
    launcherMessage.error(t('versions.download.fetchFailed'))
  }
}

async function fetchLoaderVersions() {
  const mc = installForm.value.mcVersion
  if (!mc) return
  switch (installForm.value.loader) {
    case 'fabric':
      await Promise.all([loadFabricVersions(mc), loadFabricApiVersions(mc)])
      break
    case 'forge':
      await loadForgeVersions(mc)
      break
    case 'neoforge':
      await loadNeoforgeVersions(mc)
      break
    case 'quilt':
      await loadQuiltVersions(mc)
      break
  }
}

function getLoaderVersionOptions(loader: string) {
  if (!['fabric', 'forge', 'neoforge', 'quilt'].includes(loader)) return []
  return [
    { label: t('versions.download.latestDefault'), value: '' },
    ...loaderVersions.value[loader as InstallableLoader].map((version) => ({
      label: version,
      value: version,
    })),
  ]
}

const fabricApiVersionOptions = computed(() => [
  { label: t('versions.download.latestDefault'), value: '' },
  ...fabricApiVersions.value.map((version) => ({
    label: version,
    value: version,
  })),
])

const defaultGamePath = ref('')
const gamePaths = ref<{ value: string; label: string }[]>([])

async function loadDefaultGamePath() {
  const loaded = await run(async () => settingsStore.load())
  if (loaded === undefined && settingsStore.status !== 'ready') return
  const data = settingsStore.game
  const paths = data.minecraft_paths || []
  gamePaths.value = paths.map((p: MinecraftPathEntry) => {
    const pathStr = typeof p === 'string' ? p : p.path || ''
    const name =
      typeof p === 'object' && p.name ? p.name : pathStr.split(/[\\/]/).pop() || t('versions.manage.gamePath')
    return { value: pathStr, label: name }
  })

  if (data.last_install_path) {
    defaultGamePath.value = data.last_install_path
  } else if (paths.length > 0) {
    const first = paths[0]
    if (first) {
      defaultGamePath.value = typeof first === 'string' ? first : first.path || ''
    }
  }
}

async function saveLastInstallPath(path: string) {
  if (!path) return
  await run(async () => settingsStore.patchGame({ last_install_path: path }))
}

function openInstallWithVersion(versionId: string) {
  installForm.value = {
    mcVersion: versionId,
    versionName: '',
    loader: 'vanilla',
    loaderVersion: '',
    fabricApiVersion: '',
    gamePath: defaultGamePath.value,
  }
  showInstallDialog.value = true
}

const defaultVersionName = computed(() => {
  const { mcVersion, loader, loaderVersion } = installForm.value
  if (loader === 'vanilla' || !loader) return mcVersion
  if (!loaderVersion) return `${mcVersion}-${loader}`
  return `${mcVersion}-${loader}-${loaderVersion}`
})

function selectLoader(loader: string) {
  installForm.value.loader = loader
  installForm.value.loaderVersion = ''
  installForm.value.fabricApiVersion = ''
  installStore.clearLoaderVersions()
  if (loader !== 'vanilla') {
    fetchLoaderVersions()
  }
}

// 选择加载器版本后自动更新默认版本名
watch(
  () => installForm.value.loaderVersion,
  () => {
    installForm.value.versionName = ''
  }
)

async function doInstall() {
  const versionId = installForm.value.mcVersion
  const versionName = installForm.value.versionName?.trim() || defaultVersionName.value
  const loader = installForm.value.loader
  const loaderVersion = installForm.value.loaderVersion
  const fabricApiVersion = installForm.value.fabricApiVersion
  const gamePath = installForm.value.gamePath || defaultGamePath.value

  if (!versionId) {
    launcherMessage.warning(t('versions.download.noVersionId'))
    return
  }
  if (!gamePath) {
    launcherMessage.warning('请选择游戏目录')
    return
  }

  // 校验版本文件夹冲突
  try {
    const versionDirName = versionName
    if (await installStore.hasVersionConflict(gamePath, versionDirName)) {
      launcherMessage.error(t('versions.download.versionConflict', { version: versionDirName }))
      return
    }
  } catch (e) {
    console.warn('版本冲突校验失败:', e)
  }

  showInstallDialog.value = false

  // 添加到任务队列
  const taskId = globalTaskQueue.addTask({
    type: 'install',
    name: versionName,
    versionId,
    loaderType: loader,
  })
  // 不自动打开面板，用户通过顶部栏按钮查看

  try {
    const params: CommandPayloadMap['game_install'] = {
      version_id: versionId,
      task_id: taskId,
      game_path: gamePath,
    }
    if (versionName !== versionId) {
      params.version_name = versionName
    }
    if (loader !== 'vanilla') {
      params.loader_type = loader as 'fabric' | 'forge' | 'neoforge' | 'quilt'
      params.loader_version = loaderVersion
      if (loader === 'fabric' && fabricApiVersion) {
        params.fabric_api_version = fabricApiVersion
      }
    }

    const submitted = await installStore.install(versionId, params)
    if (submitted.status !== 'success') {
      globalTaskQueue.removeTask(taskId)
      return
    }
    launcherMessage.success(t('versions.download.installQueued', { version: versionId }))
    saveLastInstallPath(gamePath)
  } catch (e: unknown) {
    globalTaskQueue.updateTask(taskId, {
      status: 'error',
      message: (e instanceof Error ? e.message : String(e)) || t('versions.download.installFailed'),
    })
    launcherMessage.error((e instanceof Error ? e.message : String(e)) || t('versions.download.installFailed'))
  }
}

async function startInstall() {
  if (!installForm.value.mcVersion) return
  await doInstall()
}

function getVersionTypeLabel(type: string): string {
  return t(getVersionLabelKey(type)) || type
}

function getVersionBadgeClass(type: string): string {
  return _getVersionBadgeClass(type)
}

function getVersionIcon(type: string): string {
  return _getVersionIcon(type)
}

function getVersionImage(type: string): string {
  return _getVersionImage(type)
}

let scrollRafId: number | null = null

function handleScroll() {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    if (!scrollContainerRef.value || !filteredVersions.value) return
    const scrollTop = scrollContainerRef.value.scrollTop
    const containerHeight = scrollContainerRef.value.clientHeight
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize)
    const endIndex = Math.min(
      filteredVersions.value.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize
    )
    visibleRange.value = { start: startIndex, end: endIndex }
  })
}

watch(filteredVersions, (newVal) => {
  if (!newVal || newVal.length === 0) return
  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop = 0
      visibleRange.value = { start: 0, end: 20 + bufferSize * 2 }
    }
  })
})

onMounted(() => {
  loadDefaultGamePath()
  fetchVersions()
  nextTick(() => {
    if (scrollContainerRef.value) {
      visibleRange.value = {
        start: 0,
        end: Math.ceil(scrollContainerRef.value.clientHeight / itemHeight) + bufferSize * 2,
      }
    }
  })
})

onUnmounted(() => installStore.clearLoaderVersions())
</script>

<style scoped src="@/styles/views/instances/InstancesTab.css"></style>
