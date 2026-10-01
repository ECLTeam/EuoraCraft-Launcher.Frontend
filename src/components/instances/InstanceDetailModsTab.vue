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
      <div v-if="!modSupported" class="mods-empty empty-state">
        <UiIcon name="puzzle" :size="36" class="empty-icon" />
        <p class="empty-text">{{ t('versions.mods.loaderNotSupported') }}</p>
      </div>
      <UiLoading v-else :show="modsLoading" mode="overlay" class="mods-spin">
        <template v-if="filteredMods.length">
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
                <button
                  v-if="mod.project_id || mod.mcmod_url"
                  class="btn-action"
                  :title="t('versions.mods.checkOnline')"
                  @click="handleOpenOnline(mod)"
                >
                  <UiIcon name="external-link" :size="13" />
                </button>
                <button class="btn-action btn-delete" :title="t('common.delete')" @click="handleDeleteMod(mod)">
                  <UiIcon name="trash" :size="13" />
                </button>
                <NSwitch :value="mod.enabled" size="small" @update:value="handleToggleMod(mod)" />
              </div>
            </article>
          </div>
        </template>
        <div v-else-if="!modsLoading" class="mods-empty empty-state">
          <UiIcon name="puzzle" :size="36" class="empty-icon" />
          <p class="empty-text">{{ t('versions.mods.noMods') }}</p>
          <div class="empty-actions" style="display: flex; gap: 8px; margin-top: 4px">
            <NButton size="small" type="primary" @click="emit('openOnlineSearch')">
              <template #icon><UiIcon name="search" :size="14" /></template>
              {{ t('versions.mods.addMod') }}
            </NButton>
          </div>
        </div>
      </UiLoading>
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
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { getLoaderName } from '@/config/version'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { modApi } from '@/features/mods/api/modApi'
import type { ScannedVersion } from '@/types/instances'
import type { ModItem } from '@/types/mods'
defineOptions({ name: 'InstanceDetailModsTab' })

const props = defineProps<{
  version: ScannedVersion | null
}>()

const emit = defineEmits<{
  openOnlineSearch: []
}>()

const { t } = useI18n()
const message = useLauncherMessage()

const mods = ref<ModItem[]>([])
const modsLoading = ref(false)
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

async function loadMods() {
  if (!modSupported.value) return
  const target = getTarget()
  if (!target) return
  modsLoading.value = true
  try {
    mods.value = await instanceWorkspaceApi.mods(target)
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.mods.modAddFailed'))
  } finally {
    modsLoading.value = false
  }
}

async function handleToggleMod(mod: ModItem) {
  const target = getTarget()
  if (!target) return
  try {
    const result = await instanceWorkspaceApi.toggleMod(target, mod.filename)
    mod.enabled = result.enabled
    const actionText = result.enabled ? t('versions.mods.toggleEnabled') : t('versions.mods.toggleDisabled')
    message.success(t('versions.mods.modToggled', { name: modDisplayName(mod), action: actionText }))
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.mods.modToggleFailed'))
  }
}

function handleDeleteMod(mod: ModItem) {
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

async function handleOpenOnline(mod: ModItem) {
  const url = mod.mcmod_url || (mod.project_id ? `https://modrinth.com/mod/${mod.project_id}` : '')
  if (!url) return
  try {
    await modApi.openUrl(url)
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.mods.openOnlineFailed'))
  }
}

// 实例切换时重新加载模组列表
watch(
  () => props.version?.versionId,
  () => void loadMods(),
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
