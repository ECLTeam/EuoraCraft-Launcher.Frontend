<template>
  <FullscreenModal
    ref="detailModalRef"
    v-model:visible="visible"
    :title="title"
    :showFooter="false"
    wrapperClass="version-detail-modal"
    bodyClass="version-detail-body"
  >
    <div class="vdm-shell">
      <aside class="vdm-nav ecl-surface">
        <div class="vdm-nav-identity">
          <button class="vdm-nav-icon-btn" title="更换实例图标" @click="iconPickerVisible = true">
            <InstanceIcon v-if="version" :version="version" :size="36" />
          </button>
          <div class="vdm-nav-copy">
            <strong>{{ version?.displayName || version?.versionId || '...' }}</strong>
            <span>{{ version?.versionId }} · {{ getLoaderName(version?.primaryLoader || 'vanilla') }}</span>
          </div>
        </div>

        <nav class="vdm-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['vdm-tab-button', { active: isTabActive(tab.id) }]"
            @click="selectTab(tab.id)"
          >
            <UiIcon :name="tab.icon" :size="15" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
        <PluginSlotHost slotId="plugin-slot-version-detail-tab" class="plugin-slot-container" />
      </aside>

      <main class="vdm-main">
        <div class="vdm-content">
          <Transition name="page" mode="out-in">
            <div v-if="activeTab === 'overview'" :key="activeTab" class="vdm-page overview-page">
              <InstanceDetailOverviewTab
                :version="version"
                :runStats="runStats"
                :statsLoading="statsLoading"
                :crashAnalyzing="crashAnalyzing"
                @launch="handleLaunch"
                @openFolder="handleOpenFolder"
                @analyzeCrash="handleAnalyzeCrash"
                @action="handleAction"
                @delete="handleDelete"
              />
            </div>

            <div v-else-if="activeTab === 'profile'" :key="activeTab" class="vdm-page profile-page">
              <InstanceDetailProfileTab :version="version" :visible="visible" @updated="emit('updated')" />
            </div>

            <div v-else-if="activeTab === 'mods' && isModdedInstance" :key="activeTab" class="vdm-page mods-page">
              <InstanceDetailModsTab :version="version" @openOnlineSearch="handleOnlineSearch" />
            </div>

            <div v-else-if="activeTab === 'settings'" :key="activeTab" class="vdm-page version-settings-page">
              <InstanceDetailSettingsTab :version="version" :visible="visible" />
            </div>

            <div v-else-if="activeTab === 'resourcepacks' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceResourcesTab
                :version="version"
                :worldOptions="worldOptions"
                initialType="resourcepack"
                :allowedTypes="['resourcepack']"
                @openOnlineSearch="handleOnlineSearch"
              />
            </div>
            <div v-else-if="activeTab === 'shaderpacks' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceResourcesTab
                :version="version"
                :worldOptions="worldOptions"
                initialType="shaderpack"
                :allowedTypes="['shaderpack']"
                @openOnlineSearch="handleOnlineSearch"
              />
            </div>
            <div v-else-if="activeTab === 'datapacks' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceResourcesTab
                :version="version"
                :worldOptions="worldOptions"
                initialType="datapack"
                :allowedTypes="['datapack']"
                @openOnlineSearch="handleOnlineSearch"
              />
            </div>
            <div v-else-if="activeTab === 'schematics' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceResourcesTab
                :version="version"
                :worldOptions="worldOptions"
                initialType="schematic"
                :allowedTypes="['schematic']"
              />
            </div>
            <div v-else-if="activeTab === 'worlds' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceWorldsTab :version="version" @changed="handleWorldsChanged" />
            </div>
            <div v-else-if="activeTab === 'screenshots' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceScreenshotsTab :version="version" @updated="emit('updated')" />
            </div>
            <div v-else-if="activeTab === 'servers' && version" :key="activeTab" class="vdm-page workspace-page">
              <InstanceServersTab :version="version" />
            </div>
          </Transition>
        </div>

        <PluginSlotHost slotId="plugin-slot-version-detail-footer" class="plugin-slot-container" />
      </main>
    </div>
  </FullscreenModal>
  <Modal v-model:visible="iconPickerVisible" :parentId="detailModalRef?.modalId" title="选择实例图标" width="520px">
    <div class="icon-picker-grid">
      <button @click="setProfileIcon('auto')"><UiIcon name="refresh" :size="28" /><span>自动</span></button>
      <button
        v-for="icon in iconChoices"
        :key="`${icon.type}-${icon.value}`"
        @click="setProfileIcon(icon.type, icon.value)"
      >
        <img :src="icon.image" alt="" /><span>{{ icon.label }}</span>
      </button>
      <button @click="chooseLocalProfileIcon"><UiIcon name="photo" :size="28" /><span>本地图片</span></button>
    </div>
  </Modal>
  <CrashLogPickerModal
    v-model:visible="showCrashPicker"
    :parentId="detailModalRef?.modalId"
    :version="version"
    :gamePath="getGamePath() ?? ''"
    @analyze="runCrashAnalysis"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { launcherErrorQueue } from '@/app/runtime/errorPresentation'
import CrashLogPickerModal from '@/components/instances/CrashLogPickerModal.vue'
import InstanceDetailModsTab from '@/components/instances/InstanceDetailModsTab.vue'
import InstanceDetailOverviewTab from '@/components/instances/InstanceDetailOverviewTab.vue'
import InstanceDetailProfileTab from '@/components/instances/InstanceDetailProfileTab.vue'
import InstanceDetailSettingsTab from '@/components/instances/InstanceDetailSettingsTab.vue'
import InstanceIcon from '@/components/instances/InstanceIcon.vue'
import InstanceResourcesTab from '@/components/instances/InstanceResourcesTab.vue'
import InstanceScreenshotsTab from '@/components/instances/InstanceScreenshotsTab.vue'
import InstanceServersTab from '@/components/instances/InstanceServersTab.vue'
import InstanceWorldsTab from '@/components/instances/InstanceWorldsTab.vue'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceKey } from '@/composables/useResourceInstallTarget'
import { getLoaderName } from '@/config/version'
import { instanceInstallApi } from '@/features/instances/api/instanceInstallApi'
import { instanceProfileApi, targetFromVersion } from '@/features/instances/api/instanceProfileApi'
import { instanceRuntimeApi } from '@/features/instances/api/instanceRuntimeApi'
import { hasModLoader } from '@/features/instances/model/instanceCapabilities'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import type { GameResourceType, ScannedVersion, VersionRunStats, WorldEntry } from '@/types/instances'
interface Props {
  visible: boolean
  version: ScannedVersion | null
  initialTab?: DetailTab
}

type DetailTab =
  | 'overview'
  | 'mods'
  | 'resourcepacks'
  | 'shaderpacks'
  | 'datapacks'
  | 'schematics'
  | 'worlds'
  | 'screenshots'
  | 'servers'
  | 'profile'
  | 'settings'

const props = withDefaults(defineProps<Props>(), {
  initialTab: 'overview',
})
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'launch', version: ScannedVersion): void
  (e: 'delete', version: ScannedVersion): void
  (e: 'updated'): void
  (e: 'action', action: string, version: ScannedVersion): void
}>()

const { t } = useI18n()
const detailModalRef = ref<InstanceType<typeof FullscreenModal> | null>(null)
const message = useLauncherMessage()
const router = useRouter()

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const title = computed(() => props.version?.displayName || props.version?.versionId || t('versions.detail.settings'))

const activeTab = ref<DetailTab>('overview')

/** Mod 导航项对应本地模组管理视图 */
function isTabActive(id: DetailTab): boolean {
  return activeTab.value === id
}
function selectTab(id: DetailTab) {
  activeTab.value = id
}
const runStats = reactive<VersionRunStats>({
  launchCount: 0,
  lastRunDurationSeconds: 0,
  totalRunDurationSeconds: 0,
})
const statsLoading = ref(false)
const crashAnalyzing = ref(false)
const showCrashPicker = ref(false)
let statsRequestId = 0

const isModdedInstance = computed(() => hasModLoader(props.version))
const tabs = computed(() => {
  const items: Array<{ id: DetailTab; icon: string; label: string }> = [
    { id: 'overview', icon: 'info', label: t('versions.detail.overview') },
    { id: 'resourcepacks', icon: 'package', label: '资源包' },
    { id: 'shaderpacks', icon: 'sun', label: '光影包' },
    { id: 'datapacks', icon: 'archive', label: '数据包' },
    { id: 'schematics', icon: 'grid', label: '原理图' },
    { id: 'worlds', icon: 'globe', label: '存档' },
    { id: 'screenshots', icon: 'photo', label: '截图' },
    { id: 'servers', icon: 'server', label: '服务器' },
    { id: 'profile', icon: 'brush', label: '个性化' },
    { id: 'settings', icon: 'settings', label: t('versions.detail.settings') },
  ]
  if (isModdedInstance.value) {
    items.splice(1, 0, { id: 'mods', icon: 'cube', label: t('versions.mods.title') })
  }
  return items
})
const worldOptions = ref<Array<{ label: string; value: string }>>([])
function handleWorldsChanged(worlds: WorldEntry[]) {
  worldOptions.value = worlds.map((world) => ({ label: world.name, value: world.id }))
}

const iconPickerVisible = ref(false)
const iconChoices = [
  { type: 'builtin' as const, value: 'grass', label: '草方块', image: '/img/item/grass.png' },
  { type: 'builtin' as const, value: 'chest', label: '箱子', image: '/img/item/chest.png' },
  { type: 'builtin' as const, value: 'command', label: '命令方块', image: '/img/item/command.png' },
  { type: 'builtin' as const, value: 'coal', label: '煤炭', image: '/img/item/coal.png' },
  { type: 'builtin' as const, value: 'iron', label: '铁块', image: '/img/item/iron.png' },
  { type: 'builtin' as const, value: 'quartz', label: '石英', image: '/img/item/quartz.png' },
  { type: 'loader' as const, value: 'vanilla', label: 'Vanilla', image: '/img/item/grass.png' },
  { type: 'loader' as const, value: 'forge', label: 'Forge', image: '/img/item/forge.png' },
  { type: 'loader' as const, value: 'neoforge', label: 'NeoForge', image: '/img/item/neoforge.png' },
  { type: 'loader' as const, value: 'fabric', label: 'Fabric', image: '/img/item/fabric.png' },
  { type: 'loader' as const, value: 'quilt', label: 'Quilt', image: '/img/item/quilt.png' },
  { type: 'loader' as const, value: 'optifine', label: 'OptiFine', image: '/img/item/optifine.png' },
]

async function setProfileIcon(type: 'auto' | 'builtin' | 'loader', value?: string) {
  const version = props.version
  if (!version) return
  await instanceProfileApi.setIcon(targetFromVersion(version), type, { value })
  iconPickerVisible.value = false
  emit('updated')
}

async function chooseLocalProfileIcon() {
  const version = props.version
  if (!version) return
  const sourcePath = await instanceProfileApi.chooseLocalIcon()
  if (!sourcePath) return
  await instanceProfileApi.setIcon(targetFromVersion(version), 'local', { sourcePath })
  iconPickerVisible.value = false
  emit('updated')
}

// ======================== 运行统计 / 崩溃分析 ========================

function getGamePath(): string | null {
  return props.version?.path || props.version?.jsonPath || null
}

async function loadRunStats() {
  const version = props.version
  const gamePath = getGamePath()
  if (!version || !gamePath) return
  const requestId = ++statsRequestId
  statsLoading.value = true
  try {
    const stats = await instanceRuntimeApi.getStats(gamePath, version.versionId || version.id)
    if (requestId === statsRequestId) Object.assign(runStats, stats)
  } catch (error) {
    if (requestId === statsRequestId) {
      Object.assign(runStats, { launchCount: 0, lastRunDurationSeconds: 0, totalRunDurationSeconds: 0 })
      message.error(error instanceof Error ? error.message : t('versions.detail.loadStatsFailed'))
    }
  } finally {
    if (requestId === statsRequestId) statsLoading.value = false
  }
}

async function handleAnalyzeCrash() {
  if (!props.version || !getGamePath() || crashAnalyzing.value) return
  showCrashPicker.value = true
}

async function runCrashAnalysis(filePath: string) {
  const version = props.version
  const gamePath = getGamePath()
  if (!version || !gamePath || crashAnalyzing.value) return
  crashAnalyzing.value = true
  try {
    const result = await instanceRuntimeApi.analyzeCrash(filePath, gamePath, version.versionId || version.id)
    launcherErrorQueue.enqueue({
      error_id: result.reportId,
      title: t('error.crash.title'),
      message: t('error.crash.manualMessage', { version: result.versionId }),
      kind: 'game_crash',
      crash: result,
    })
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.crashAnalysisFailed'))
  } finally {
    crashAnalyzing.value = false
  }
}

// ======================== 快捷操作 ========================

function handleLaunch() {
  if (props.version) {
    emit('launch', props.version)
    visible.value = false
  }
}

function handleOpenFolder() {
  if (props.version?.path) {
    void instanceInstallApi.openFolder(props.version.path)
  }
}

function handleDelete() {
  if (props.version) {
    emit('delete', props.version)
    visible.value = false
  }
}

function handleAction(action: string) {
  if (props.version) emit('action', action, props.version)
}

function handleOnlineSearch(request?: {
  type: Exclude<GameResourceType, 'schematic'>
  worldId: string | null
  query: string
}) {
  const version = props.version
  if (!version) return
  visible.value = false
  void router.push({
    name: 'download',
    query: {
      tab: request?.type || 'mod',
      instance: instanceKey(version),
      ...(request?.worldId ? { world: request.worldId } : {}),
      ...(request?.query ? { q: request.query } : {}),
    },
  })
}

// 重置 activeTab 当弹窗打开时；关闭时由各 tab 子组件自行 flush 挂起的自动保存
watch(
  () => props.visible,
  (val) => {
    if (val) {
      activeTab.value = props.initialTab === 'mods' && !isModdedInstance.value ? 'overview' : props.initialTab
      void loadRunStats()
    }
  },
  { immediate: true }
)

watch(isModdedInstance, (modded) => {
  if (!modded && activeTab.value === 'mods') activeTab.value = 'overview'
})

const stopStatsListening = instanceRuntimeApi.onChanged((payload) => {
  const version = props.version
  if (
    props.visible &&
    version &&
    payload.versionId === (version.versionId || version.id) &&
    payload.gamePath === getGamePath()
  ) {
    void loadRunStats()
  }
})

onBeforeUnmount(() => {
  statsRequestId += 1
  stopStatsListening()
})
</script>

<style scoped src="@/styles/views/instances/InstanceDetailModal.css"></style>
