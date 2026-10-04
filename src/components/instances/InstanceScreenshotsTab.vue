<template>
  <section class="screens-panel">
    <header class="screens-toolbar">
      <NInput v-model:value="query" clearable size="small" placeholder="搜索截图文件名" />
      <NSelect v-model:value="direction" :options="sortOptions" size="small" class="sort-select" />
      <div class="toolbar-actions">
        <NButton quaternary circle size="small" :loading="loading" title="刷新" aria-label="刷新" @click="load">
          <template #icon><UiIcon name="refresh" :size="16" /></template>
        </NButton>
        <NButton quaternary circle size="small" title="打开截图目录" aria-label="打开截图目录" @click="openFolder">
          <template #icon><UiIcon name="folder-open" :size="16" /></template>
        </NButton>
      </div>
    </header>
    <InstanceContentState :loading="loading" :empty="groups.length === 0" emptyDescription="还没有截图">
      <div class="screens-content">
        <section v-for="group in groups" :key="group.date" class="shot-group">
          <h3>{{ group.date }}</h3>
          <div class="shot-grid">
            <article v-for="shot in group.items" :key="shot.id" class="shot-card">
              <img :src="shot.thumbnailUrl" :alt="shot.name" loading="lazy" />
              <div>
                <strong>{{ shot.name }}</strong
                ><small>{{ shot.width }}×{{ shot.height }} · {{ formatSize(shot.size) }}</small>
              </div>
              <div class="shot-actions">
                <NButton quaternary circle size="tiny" title="复制" @click="copy(shot)">
                  <template #icon><UiIcon name="copy" :size="14" /></template>
                </NButton>
                <NButton quaternary circle size="tiny" title="另存为" @click="saveAs(shot)">
                  <template #icon><UiIcon name="file-download" :size="14" /></template>
                </NButton>
                <NButton quaternary circle size="tiny" title="设为封面" @click="cover(shot)">
                  <template #icon><UiIcon name="photo" :size="14" /></template>
                </NButton>
                <NButton quaternary circle size="tiny" title="设为背景" @click="background(shot)">
                  <template #icon><UiIcon name="layout-grid" :size="14" /></template>
                </NButton>
                <NButton quaternary circle size="tiny" type="error" title="删除" @click="remove(shot)">
                  <template #icon><UiIcon name="trash" :size="14" /></template>
                </NButton>
              </div>
            </article>
          </div>
        </section>
      </div>
    </InstanceContentState>
    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :content="confirmContent"
      :loading="confirmLoading"
      :danger="confirmDanger"
      :closeOnConfirm="false"
      @confirm="handleConfirm"
    />
  </section>
</template>

<script setup lang="ts">
import { NButton, NInput, NSelect } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useRequestScope } from '@/composables/useRequestScope'
import { instanceKey } from '@/composables/useResourceInstallTarget'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import type { ScannedVersion, ScreenshotEntry } from '@/types/instances'
import InstanceContentState from './InstanceContentState.vue'
const props = defineProps<{ version: ScannedVersion }>()
const emit = defineEmits<{ updated: [] }>()
const message = useLauncherMessage()
const loading = ref(false)
const shots = ref<ScreenshotEntry[]>([])
const query = ref('')
const direction = ref<'desc' | 'asc'>('desc')
const target = computed(() => workspaceTarget(props.version))
const screenshotRequests = useRequestScope(() => instanceKey(props.version))
const sortOptions = [
  { label: '最新在前', value: 'desc' },
  { label: '最早在前', value: 'asc' },
]
const groups = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  const values = [...shots.value]
    .filter((s) => !needle || s.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) =>
      direction.value === 'desc' ? b.modifiedAt.localeCompare(a.modifiedAt) : a.modifiedAt.localeCompare(b.modifiedAt)
    )
  const map = new Map<string, ScreenshotEntry[]>()
  for (const shot of values) map.set(shot.dateGroup, [...(map.get(shot.dateGroup) || []), shot])
  return [...map].map(([date, items]) => ({ date, items }))
})
async function load() {
  const isCurrent = screenshotRequests.begin()
  const requestedTarget = target.value
  loading.value = true
  try {
    const loaded = await instanceWorkspaceApi.screenshots(requestedTarget)
    await Promise.all(
      loaded.map(async (shot) => {
        const thumb = await instanceWorkspaceApi.thumbnail(requestedTarget, shot.id)
        shot.thumbnailUrl = (await backend.file.toUrl(thumb.path)) || ''
      })
    )
    if (isCurrent()) shots.value = loaded
  } catch (reason) {
    if (isCurrent()) message.error(reason instanceof Error ? reason.message : '读取截图失败')
  } finally {
    if (isCurrent()) loading.value = false
  }
}
async function openFolder() {
  await instanceWorkspaceApi.folders(target.value, 'screenshots')
}
async function copy(shot: ScreenshotEntry) {
  await instanceWorkspaceApi.copyScreenshot(target.value, shot.id)
  message.success('已复制到剪贴板')
}
async function saveAs(shot: ScreenshotEntry) {
  const result = unwrapResponse(await backend.command('select_save_file', { purpose: 'screenshot' }), '选择保存位置')
  if (result.path) await instanceWorkspaceApi.saveScreenshot(target.value, shot.id, result.path)
}
async function cover(shot: ScreenshotEntry) {
  await instanceWorkspaceApi.setCover(target.value, shot.id)
  message.success('实例封面已更新')
  emit('updated')
}
async function background(shot: ScreenshotEntry) {
  await instanceWorkspaceApi.setBackground(target.value, shot.id)
  message.success('启动器背景已更新')
}
function remove(shot: ScreenshotEntry) {
  openConfirm(
    '删除截图',
    `删除截图 ${shot.name}？`,
    async () => {
      await instanceWorkspaceApi.deleteScreenshot(target.value, shot.id)
      await load()
    },
    true
  )
}
const formatSize = (size: number) =>
  size < 1024 * 1024 ? `${Math.round(size / 1024)} KiB` : `${(size / 1024 / 1024).toFixed(1)} MiB`

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

watch(
  () => instanceKey(props.version),
  () => {
    shots.value = []
    void load()
  },
  { immediate: true }
)
</script>

<style scoped>
.screens-panel {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  overflow: hidden;
  background: var(--ecl-surface);
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
  box-shadow: var(--ecl-shadow-surface);
}
.screens-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ecl-border);
}
.screens-toolbar > .n-input {
  flex: 1;
  min-width: 180px;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: nowrap;
}
.screens-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
.sort-select {
  width: 130px;
}
.shot-group h3 {
  margin: 12px 0 8px;
}
.shot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.shot-card {
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-bg);
}
.shot-card img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  background: #111;
}
.shot-card > div {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
}
.shot-card small {
  color: var(--text-secondary);
}
.shot-actions {
  flex-direction: row !important;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
  padding-top: 0 !important;
}
</style>
