<template>
  <div
    class="mods-panel"
    data-drop-zone
    @dragover.prevent
    @drop.prevent="handleModDrop"
    @dragenter.prevent="handleModDragEnter"
    @dragleave="handleModDragLeave"
  >
    <div v-if="modDragging" class="mods-drop-overlay">
      <UiIcon name="download" :size="22" />
      <span>{{ t('versions.mods.selectModFileHint') }}</span>
    </div>
    <div v-if="modSupported" class="mods-panel-header">
      <div class="mods-panel-header-left">
        <div class="search-box">
          <UiIcon name="search" :size="15" class="search-icon" />
          <input
            v-model="modSearchQuery"
            type="text"
            class="search-input"
            :placeholder="t('versions.mods.searchPlaceholder')"
          />
          <button v-if="modSearchQuery" class="search-clear" type="button" @click="modSearchQuery = ''">
            <UiIcon name="close" :size="14" />
          </button>
        </div>
        <div class="mods-filter-tabs">
          <button
            v-for="f in modFilterOptions"
            :key="f.value"
            :class="['mods-filter-btn', { active: modFilter === f.value }]"
            @click="modFilter = f.value"
          >
            {{ f.label }}
          </button>
        </div>
      </div>
      <div class="mods-panel-header-right">
        <span v-if="filteredMods.length" class="mods-count">{{
          t('versions.mods.count', { count: filteredMods.length })
        }}</span>
        <NButton size="small" type="primary" @click="emit('openOnlineSearch')">
          <template #icon><UiIcon name="search" :size="14" /></template>
          {{ t('versions.mods.addMod') }}
        </NButton>
        <NButton quaternary circle size="small" :title="t('versions.mods.openFolder')" @click="handleOpenModsFolder">
          <template #icon><UiIcon name="folder-open" :size="16" /></template>
        </NButton>
      </div>
    </div>

    <div class="mods-panel-content">
      <InstanceContentState
        :loading="modSupported && modsLoading"
        :empty="!modSupported || filteredMods.length === 0"
        :emptyDescription="t(modSupported ? 'versions.mods.noMods' : 'versions.mods.loaderNotSupported')"
      >
        <div class="mods-list">
          <article
            v-for="mod in filteredMods"
            :key="mod.filename"
            :class="['mod-list-row', { 'is-disabled': !mod.enabled }]"
          >
            <div class="mod-list-identity">
              <span class="mod-list-icon">
                <img v-if="mod.icon_data" :src="mod.icon_data" alt="" class="mod-list-icon-img" loading="lazy" />
                <UiIcon v-else name="cube" :size="17" />
              </span>
              <div class="mod-list-title">
                <strong>{{ modDisplayName(mod) }}</strong>
                <span v-if="hasTranslatedName(mod)" class="mod-original-name">{{ mod.name }}</span>
                <span class="mod-list-filename" :title="mod.filename">{{ mod.filename }}</span>
                <span class="mod-list-metadata">{{ [mod.version, mod.author].filter(Boolean).join(' · ') }}</span>
                <ModDiagnostics
                  :diagnostics="mod.diagnostics"
                  :busy="modTogglePending.size > 0"
                  @enable="enableProvider"
                  @search="searchDependency"
                />
              </div>
            </div>

            <div class="mod-list-loader">
              <span v-if="mod.loader_type" class="badge" :class="'badge-' + mod.loader_type.toLowerCase()">
                {{ getLoaderName(mod.loader_type) }}
              </span>
              <span v-else class="badge badge-vanilla">{{ t('versions.manage.vanilla') }}</span>
            </div>

            <div class="mod-list-actions">
              <span :class="['mod-status', { enabled: mod.enabled }]">
                {{ t(mod.enabled ? 'versions.mods.enabled' : 'versions.mods.disabled') }}
              </span>
              <button class="btn-action" :title="t('versions.mods.checkOnline')" @click="handleOpenOnline(mod)">
                <UiIcon name="external-link" :size="13" />
              </button>
              <button
                class="btn-action btn-delete"
                :title="t('common.delete')"
                :disabled="modTogglePending.has(mod)"
                @click="handleDeleteMod(mod)"
              >
                <UiIcon name="trash" :size="13" />
              </button>
              <NSwitch
                :value="mod.enabled"
                :disabled="modTogglePending.has(mod)"
                size="small"
                @update:value="handleToggleMod(mod)"
              />
            </div>
          </article>
        </div>
        <template v-if="modSupported" #empty-actions>
          <NButton size="small" type="primary" @click="emit('openOnlineSearch')">
            <template #icon><UiIcon name="search" :size="14" /></template>
            {{ t('versions.mods.addMod') }}
          </NButton>
        </template>
      </InstanceContentState>
    </div>
  </div>

  <ConfirmDialog
    v-model:visible="confirmVisible"
    :title="confirmTitle"
    :content="confirmContent"
    :loading="confirmLoading"
    :danger="true"
    :closeOnConfirm="false"
    @confirm="handleConfirm"
  />
</template>

<script setup lang="ts">
import { NButton, NSwitch } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import ModDiagnostics from '@/components/instances/ModDiagnostics.vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useRequestScope } from '@/composables/useRequestScope'
import { instanceKey } from '@/composables/useResourceInstallTarget'
import { getLoaderName } from '@/config/version'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { modApi } from '@/features/mods/api/modApi'
import { useTargetOperationRefresh } from '@/features/operations/composables/useTargetOperationRefresh'
import type { ScannedVersion } from '@/types/instances'
import type { ModItem } from '@/types/mods'
import InstanceContentState from './InstanceContentState.vue'
defineOptions({ name: 'InstanceDetailModsTab' })

const props = defineProps<{
  version: ScannedVersion | null
}>()

const emit = defineEmits<{
  openOnlineSearch: [request?: { type: 'mod'; worldId: null; query: string }]
}>()

const { t } = useI18n()
const message = useLauncherMessage()

const mods = ref<ModItem[]>([])
const modsLoading = ref(false)
const modRequests = useRequestScope(() => (props.version ? instanceKey(props.version) : ''))
const modTogglePending = ref(new Set<ModItem>())
const modSearchQuery = ref('')
const modFilter = ref<'all' | 'enabled' | 'disabled'>('all')

const UNSUPPORTED_MOD_LOADERS = ['vanilla', 'optifine']
const modSupported = computed(
  () => !!props.version && !UNSUPPORTED_MOD_LOADERS.includes(props.version.primaryLoader?.toLowerCase())
)

const modFilterOptions = computed(() => [
  { label: t('versions.mods.filterAll'), value: 'all' as const },
  { label: t('versions.mods.filterEnabled'), value: 'enabled' as const },
  { label: t('versions.mods.filterDisabled'), value: 'disabled' as const },
])

const filteredMods = computed(() => {
  let list = mods.value
  // 筛选
  if (modFilter.value === 'enabled') list = list.filter((m) => m.enabled)
  else if (modFilter.value === 'disabled') list = list.filter((m) => !m.enabled)
  // 搜索
  const q = modSearchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((m) =>
      [m.filename, m.name, m.display_name, m.english_name].some((value) => value?.toLowerCase().includes(q))
    )
  }
  return list
})

function getTarget() {
  return props.version ? workspaceTarget(props.version) : null
}

useTargetOperationRefresh(getTarget, loadMods)

async function loadMods() {
  const isCurrent = modRequests.begin()
  modsLoading.value = false
  if (!modSupported.value) return
  const target = getTarget()
  if (!target) return
  modsLoading.value = true
  try {
    const loaded = await instanceWorkspaceApi.mods(target)
    if (isCurrent()) mods.value = loaded
  } catch (error) {
    if (isCurrent()) message.error(error instanceof Error ? error.message : t('versions.mods.modAddFailed'))
  } finally {
    if (isCurrent()) modsLoading.value = false
  }
}

async function handleToggleMod(mod: ModItem) {
  const target = getTarget()
  if (!target || modTogglePending.value.has(mod)) return
  const sourceFilename = mod.filename
  modTogglePending.value.add(mod)
  try {
    const result = await instanceWorkspaceApi.toggleMod(target, sourceFilename)
    mod.filename = result.enabled ? sourceFilename.replace(/\.disabled$/, '') : `${sourceFilename}.disabled`
    mod.enabled = result.enabled
    const actionText = result.enabled ? t('versions.mods.toggleEnabled') : t('versions.mods.toggleDisabled')
    message.success(t('versions.mods.modToggled', { name: modDisplayName(mod), action: actionText }))
    if (props.version && target.version_id === props.version.versionId && target.game_path === props.version.path)
      await loadMods()
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.mods.modToggleFailed'))
  } finally {
    modTogglePending.value.delete(mod)
  }
}

function handleDeleteMod(mod: ModItem) {
  if (modTogglePending.value.has(mod)) return
  openConfirm(t('common.delete'), t('versions.mods.deleteConfirm', { name: modDisplayName(mod) }), async () => {
    const target = getTarget()
    if (!target) return
    try {
      await instanceWorkspaceApi.removeMod(target, mod.filename)
      mods.value = mods.value.filter((m) => m.filename !== mod.filename)
      message.success(t('versions.mods.modDeleted'))
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('versions.mods.modDeleteFailed'))
    }
  })
}

const modDragging = ref(false)
let modDragDepth = 0

function handleModDragEnter() {
  modDragDepth += 1
  modDragging.value = true
}

function handleModDragLeave() {
  modDragDepth = Math.max(0, modDragDepth - 1)
  if (modDragDepth === 0) modDragging.value = false
}

async function handleModDrop(event: DragEvent) {
  modDragging.value = false
  modDragDepth = 0
  if (!modSupported.value) return
  const target = getTarget()
  if (!target) return
  const paths = [...(event.dataTransfer?.files || [])]
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path))
  if (!paths.length) {
    message.warning(t('versions.mods.selectModFileHint'))
    return
  }
  try {
    for (const path of paths) await instanceWorkspaceApi.addMod(target, path)
    message.success(t('versions.mods.modAdded'))
    await loadMods()
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.mods.modAddFailed'))
  }
}

async function handleOpenModsFolder() {
  const target = getTarget()
  if (!target) return
  try {
    await instanceWorkspaceApi.modsFolder(target)
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.mods.modAddFailed'))
  }
}

function modDisplayName(mod: ModItem): string {
  return mod.display_name || mod.name || mod.filename.replace(/\.(jar|disabled)$/, '')
}

function hasTranslatedName(mod: ModItem): boolean {
  return Boolean(mod.display_name && mod.name && mod.display_name !== mod.name)
}

function searchDependency(query: string) {
  emit('openOnlineSearch', { type: 'mod', worldId: null, query })
}

async function enableProvider(filename: string) {
  const provider = mods.value.find((mod) => mod.filename === filename && !mod.enabled)
  if (provider) await handleToggleMod(provider)
}

const identifyingMods = new Set<ModItem>()
async function handleOpenOnline(mod: ModItem) {
  if (identifyingMods.has(mod)) return
  identifyingMods.add(mod)
  const scopeKey = props.version ? instanceKey(props.version) : ''
  try {
    let source = mod.source
    let projectId = mod.source_project_id
    if (!projectId && !mod.mcmod_url && mod.sha512) {
      const result = await backend.command('game_resource_identify', { sha512: mod.sha512 })
      if (result.success && result.data?.matched) {
        source = result.data.source
        projectId = result.data.projectId
      }
    }
    if (scopeKey !== (props.version ? instanceKey(props.version) : '')) return
    let url =
      source === 'modrinth' && projectId ? `https://modrinth.com/mod/${encodeURIComponent(projectId)}` : mod.mcmod_url
    if (source === 'curseforge' && projectId) {
      const info = await modApi.info({ source: 'curseforge', mod_id: projectId })
      if (scopeKey !== (props.version ? instanceKey(props.version) : '')) return
      url = info.projectUrl || url
    }
    if (url) await modApi.openUrl(url)
    else searchDependency(mod.name || mod.filename)
  } catch (error) {
    if (scopeKey === (props.version ? instanceKey(props.version) : ''))
      message.error(error instanceof Error ? error.message : t('versions.mods.openOnlineFailed'))
  } finally {
    identifyingMods.delete(mod)
  }
}

// 实例切换时重新加载模组列表
watch(
  () => (props.version ? instanceKey(props.version) : ''),
  () => {
    mods.value = []
    void loadMods()
  },
  { immediate: true }
)

// ======================== 删除确认 ========================

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmLoading = ref(false)
let confirmAction: (() => Promise<void>) | null = null

function openConfirm(title: string, content: string, action: () => Promise<void>) {
  confirmTitle.value = title
  confirmContent.value = content
  confirmAction = action
  confirmLoading.value = false
  confirmVisible.value = true
}

async function handleConfirm() {
  if (!confirmAction || confirmLoading.value) return
  confirmLoading.value = true
  try {
    await confirmAction()
    confirmVisible.value = false
    confirmAction = null
  } finally {
    confirmLoading.value = false
  }
}
</script>

<style scoped src="@/styles/views/instances/InstanceDetailModal.css"></style>
