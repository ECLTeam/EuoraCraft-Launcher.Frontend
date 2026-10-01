<template>
  <section class="workspace-panel" data-drop-zone @dragover.prevent @drop.prevent="installDropped">
    <header class="workspace-toolbar">
      <div v-if="types.length > 1" class="resource-tabs">
        <NButton
          v-for="item in types"
          :key="item.value"
          size="small"
          :type="resourceType === item.value ? 'primary' : 'default'"
          secondary
          @click="resourceType = item.value"
        >
          {{ item.label }}
        </NButton>
      </div>
      <NSelect
        v-if="resourceType === 'datapack'"
        v-model:value="worldId"
        :options="worldOptions"
        placeholder="选择存档"
        size="small"
        class="world-select"
      />
      <NInput v-model:value="query" clearable size="small" placeholder="搜索资源名称、版本或来源" />
      <div class="toolbar-actions">
        <NButton quaternary circle size="small" :loading="loading" title="刷新" @click="load">
          <template #icon><UiIcon name="refresh" :size="16" /></template>
        </NButton>
        <NButton quaternary circle size="small" title="在线搜索" @click="onlineVisible = true">
          <template #icon><UiIcon name="search" :size="16" /></template>
        </NButton>
        <NButton quaternary circle size="small" title="导出清单" @click="exportManifest">
          <template #icon><UiIcon name="file-download" :size="16" /></template>
        </NButton>
        <NButton
          v-if="resourceType !== 'resourcepack'"
          quaternary
          circle
          size="small"
          type="error"
          title="删除"
          :disabled="selected.size === 0"
          @click="removeSelected"
        >
          <template #icon><UiIcon name="trash" :size="16" /></template>
        </NButton>
        <NButton size="small" type="primary" class="toolbar-primary-btn" @click="chooseAndInstall">
          <template #icon><UiIcon name="plus" :size="13" /></template>
          安装资源
        </NButton>
      </div>
    </header>
    <UiLoading :show="loading" mode="overlay">
      <div v-if="filtered.length" class="resource-table">
        <div
          v-for="item in filtered"
          :key="item.id"
          class="resource-row"
          :class="{ 'resource-row-pack': resourceType === 'resourcepack' }"
        >
          <div v-if="resourceType === 'resourcepack'" class="resource-icon">
            <img
              v-if="item.iconData && !failedIcons.has(item.id)"
              :src="item.iconData"
              alt=""
              @error="failedIcons.add(item.id)"
            />
            <UiIcon v-else name="package" :size="24" />
          </div>
          <NCheckbox v-else :checked="selected.has(item.id)" @update:checked="toggleSelected(item.id)" />
          <div class="resource-copy">
            <strong>{{ item.name || item.id }}</strong
            ><small>{{ item.id }} · {{ item.version || '本地资源' }}</small>
            <span v-if="item.duplicateHash || item.duplicateProjectId" class="resource-warning">检测到重复项</span>
            <span v-if="item.missingDependencies?.length" class="resource-warning"
              >缺少依赖：{{ item.missingDependencies.join(', ') }}</span
            >
          </div>
          <span class="resource-source">{{ item.source }}</span>
          <NSwitch v-if="resourceType !== 'schematic'" :value="item.enabled" @update:value="toggle(item, $event)" />
          <span v-else class="resource-na">—</span>
          <div class="resource-actions">
            <NButton
              v-if="resourceType === 'schematic'"
              size="tiny"
              quaternary
              :title="t('schematic.preview')"
              data-testid="schematic-preview-btn"
              @click="openPreview(item)"
            >
              <template #icon><UiIcon name="cube" :size="14" /></template>
            </NButton>
            <NButton size="tiny" type="error" quaternary @click="removeOne(item)">删除</NButton>
          </div>
        </div>
      </div>
      <NEmpty v-else description="这里还没有资源" />
    </UiLoading>

    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :content="confirmContent"
      :loading="confirmLoading"
      :danger="confirmDanger"
      :closeOnConfirm="false"
      @confirm="handleConfirm"
    />
    <SchematicPreviewModal
      v-model:visible="previewVisible"
      :version="version"
      :resourceId="previewResource?.id"
      :resourceName="previewResource?.name || previewResource?.id"
    />
    <Modal v-model:visible="onlineVisible" title="在线搜索资源" width="700px">
      <div class="online-toolbar">
        <NInput v-model:value="onlineQuery" placeholder="输入项目名称" @keyup.enter="searchOnline" />
        <NSelect v-model:value="onlineSource" :options="onlineSources" />
        <NButton type="primary" :loading="onlineLoading" @click="searchOnline">搜索</NButton>
      </div>
      <div class="online-results">
        <div v-for="(item, index) in onlineItems" :key="String((item as any).project_id || (item as any).id || index)">
          <strong>{{ (item as any).title || (item as any).name || '未命名项目' }}</strong>
          <span>{{ (item as any).description || (item as any).summary || '' }}</span>
        </div>
      </div>
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { NButton, NCheckbox, NEmpty, NInput, NSelect, NSwitch } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import SchematicPreviewModal from '@/features/instances/components/SchematicPreviewModal.vue'
import type { GameResource, GameResourceType, ScannedVersion } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'

const props = defineProps<{
  version: ScannedVersion
  worldOptions?: Array<{ label: string; value: string }>
  /** 初始选中的资源类型，默认 'mod' */
  initialType?: GameResourceType
  /** 限定可切换的资源类型；为空表示全部 */
  allowedTypes?: GameResourceType[]
}>()
const message = useLauncherMessage()
const { t } = useI18n()
const resourceType = ref<GameResourceType>(props.initialType || 'mod')
const worldId = ref<string | null>(null)
const resources = ref<GameResource[]>([])
const failedIcons = ref(new Set<string>())
const selected = ref(new Set<string>())
const query = ref('')
const loading = ref(false)
const onlineVisible = ref(false)
const onlineQuery = ref('')
const onlineSource = ref<'modrinth' | 'curseforge'>('modrinth')
const onlineItems = ref<unknown[]>([])
const onlineLoading = ref(false)
const previewResource = ref<GameResource | null>(null)
const previewVisible = ref(false)
const allTypes: Array<{ value: GameResourceType; label: string }> = [
  { value: 'mod', label: '模组' },
  { value: 'resourcepack', label: '资源包' },
  { value: 'shaderpack', label: '光影包' },
  { value: 'datapack', label: '数据包' },
  { value: 'schematic', label: '原理图' },
]
const types = computed(() =>
  props.allowedTypes?.length ? allTypes.filter((t) => props.allowedTypes!.includes(t.value)) : allTypes
)
const onlineSources = [
  { label: 'Modrinth', value: 'modrinth' },
  { label: 'CurseForge', value: 'curseforge' },
]
const target = computed(() => workspaceTarget(props.version))
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return needle
    ? resources.value.filter((item) =>
        `${item.name} ${item.id} ${item.version || ''} ${item.source}`.toLocaleLowerCase().includes(needle)
      )
    : resources.value
})

async function load() {
  if (resourceType.value === 'datapack' && !worldId.value) {
    resources.value = []
    return
  }
  loading.value = true
  try {
    resources.value = await instanceWorkspaceApi.resources(target.value, resourceType.value, worldId.value || undefined)
    failedIcons.value = new Set()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '读取资源失败')
  } finally {
    loading.value = false
  }
}
// 安装后的延迟刷新定时器：组件卸载时清理，避免卸载后仍触发请求
let refreshTimer: ReturnType<typeof setTimeout> | null = null

async function install(paths: string[]) {
  if (!paths.length) return
  try {
    await instanceWorkspaceApi.installResources(target.value, resourceType.value, paths, worldId.value || undefined)
  } catch (error) {
    message.error(getErrorMessage(error, '资源安装失败'))
    return
  }
  message.success('资源安装任务已创建')
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(load, 500)
}
async function chooseAndInstall() {
  try {
    await install(await instanceWorkspaceApi.chooseResourceFiles())
  } catch (error) {
    message.error(getErrorMessage(error, '选择资源文件失败'))
  }
}
async function installDropped(event: DragEvent) {
  const paths = [...(event.dataTransfer?.files || [])]
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path))
  if (!paths.length) return message.warning('当前桌面环境未提供拖拽文件路径，请使用“安装资源”')
  await install(paths)
}
async function toggle(item: GameResource, enabled: boolean) {
  try {
    await instanceWorkspaceApi.toggleResource(
      target.value,
      resourceType.value,
      item.id,
      enabled,
      worldId.value || undefined
    )
  } catch (error) {
    message.error(getErrorMessage(error, '资源状态切换失败'))
    return
  }
  item.enabled = enabled
}
function toggleSelected(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function confirmDelete(ids: string[]) {
  openConfirm(
    '删除',
    `确定删除 ${ids.length} 个资源？`,
    async () => {
      await instanceWorkspaceApi.deleteResources(target.value, resourceType.value, ids, worldId.value || undefined)
      selected.value = new Set()
      await load()
    },
    true
  )
}
function removeOne(item: GameResource) {
  confirmDelete([item.id])
}
function removeSelected() {
  confirmDelete([...selected.value])
}
function openPreview(item: GameResource) {
  previewResource.value = item
  previewVisible.value = true
}
async function searchOnline() {
  if (!onlineQuery.value.trim()) return
  onlineLoading.value = true
  try {
    const result = unwrapResponse(
      await backend.command('game_resource_search', {
        query: onlineQuery.value,
        game_version: props.version.vanillaName || props.version.versionId,
        loader: props.version.primaryLoader,
        source: onlineSource.value,
      }),
      '搜索在线资源'
    )
    onlineItems.value = result.items
  } catch (error) {
    message.error(getErrorMessage(error, '搜索在线资源失败'))
  } finally {
    onlineLoading.value = false
  }
}
async function exportManifest() {
  const selected = unwrapResponse(
    await backend.command('select_save_file', { purpose: 'resource-manifest' }),
    '选择清单保存位置'
  )
  if (!selected.path) return
  const format = selected.path.toLocaleLowerCase().endsWith('.csv') ? 'csv' : 'json'
  await instanceWorkspaceApi.exportResourceManifest(
    target.value,
    resourceType.value,
    selected.path,
    format,
    worldId.value || undefined
  )
  message.success('资源清单已导出')
}
watch([resourceType, worldId], () => {
  selected.value = new Set()
  void load()
})

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmDanger = ref(false)
const confirmLoading = ref(false)
let confirmAction: (() => Promise<void>) | null = null

function openConfirm(title: string, content: string, action: () => Promise<void>, danger = false) {
  confirmTitle.value = title
  confirmContent.value = content
  confirmDanger.value = danger
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

onMounted(load)
onBeforeUnmount(() => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.workspace-panel {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  overflow: hidden;
  background: var(--ecl-surface);
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
  box-shadow: var(--ecl-shadow-surface);
}

.workspace-toolbar,
.online-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.workspace-toolbar {
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ecl-border);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: nowrap;
}

/* 主操作按钮与辅助按钮分隔，作为工具栏的视觉终点 */
.toolbar-actions .toolbar-primary-btn {
  margin-left: 12px;
}

.resource-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--ecl-hover);
  border-radius: var(--ecl-radius-control);
}

.workspace-toolbar > .n-input {
  min-width: 180px;
  flex: 1;
}

.world-select {
  width: 180px;
}

.resource-table {
  display: flex;
  flex-direction: column;
}

.resource-row {
  display: grid;
  grid-template-columns: 28px minmax(220px, 1fr) 110px 60px auto;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ecl-border);
  transition:
    background var(--duration-fast) var(--ease-emphasized),
    transform var(--duration-fast) var(--ease-emphasized);
}

.resource-row:last-child {
  border-bottom: 0;
}

.resource-row-pack {
  grid-template-columns: 40px minmax(0, 1fr) 110px 60px auto;
}

.resource-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: var(--ecl-radius-control);
  background: var(--ecl-hover);
  color: var(--ecl-text-secondary);
}

.resource-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 640px) {
  .resource-row-pack {
    grid-template-columns: 40px minmax(0, 1fr) 40px auto;
    gap: 8px;
    padding: 10px 12px;
  }

  .resource-row-pack .resource-source {
    display: none;
  }
}

.resource-row:hover {
  background: var(--ecl-hover);
}

.resource-row:has(.resource-warning) {
  background: color-mix(in srgb, #e39a35 3%, transparent);
}

.resource-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.resource-copy strong {
  overflow: hidden;
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-copy small {
  overflow: hidden;
  color: var(--ecl-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-source {
  overflow: hidden;
  justify-self: start;
  max-width: 110px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ecl-hover);
  color: var(--ecl-text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-na {
  color: var(--ecl-text-secondary);
}

.resource-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.resource-warning {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin-top: 2px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--ecl-primary-alpha);
  color: #e39a35;
  font-size: 11px;
}

.online-results {
  display: grid;
  gap: 8px;
  max-height: 420px;
  overflow: auto;
  margin-top: 12px;
}

.online-results > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
  transition:
    background var(--duration-fast) var(--ease-emphasized),
    border-color var(--duration-fast) var(--ease-emphasized);
}

.online-results > div:hover {
  background: var(--ecl-surface-muted);
  border-color: var(--ecl-border-strong);
}

.online-results strong {
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
}

.online-results span {
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
</style>
