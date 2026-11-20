<template>
  <div class="tab-pane fileset-page">
    <header class="fileset-toolbar">
      <div class="fileset-heading">
        <UiIcon name="photo" :size="18" />
        <span class="fileset-title">{{ t('fileset.title') }}</span>
        <span v-if="items.length" class="fileset-count">{{ items.length }}</span>
      </div>
      <div class="fileset-toolbar-actions">
        <UiButton :loading="importing" @click="importMedia">{{ t('fileset.import') }}</UiButton>
        <UiButton variant="outline" :loading="loading" @click="reload">{{ t('fileset.refresh') }}</UiButton>
      </div>
    </header>

    <p class="fileset-hint">{{ t('fileset.hint') }}</p>
    <p v-if="notice" class="fileset-notice">{{ notice }}</p>

    <div class="fileset-body">
      <UiLoading v-if="loading && !items.length" />
      <UiEmptyState
        v-else-if="!items.length"
        icon="photo"
        :title="t('fileset.emptyTitle')"
        :description="t('fileset.emptyDescription')"
      />
      <div v-else class="fileset-grid">
        <article v-for="item in items" :key="item.id" class="fileset-card">
          <div class="fileset-preview" @mouseenter="loadVideoPreview(item)">
            <img v-if="item.kind === 'image' && thumbnails[item.id]" :src="thumbnails[item.id]" alt="" loading="lazy" />
            <video
              v-else-if="item.kind === 'video' && previews[item.id]"
              :src="previews[item.id]"
              class="fileset-preview-video"
              muted
              loop
              playsinline
              preload="metadata"
            ></video>
            <UiIcon v-else name="photo" :size="26" />
          </div>
          <div class="fileset-info">
            <strong class="fileset-name" :title="item.name">{{ item.name }}</strong>
            <span class="fileset-detail">{{ detailOf(item) }}</span>
          </div>
          <div class="fileset-card-actions">
            <UiButton size="sm" variant="text" @click="openRename(item)">{{ t('fileset.rename') }}</UiButton>
            <UiButton size="sm" variant="text" @click="askDelete(item)">{{ t('fileset.delete') }}</UiButton>
          </div>
        </article>
      </div>
    </div>

    <NModal v-model:show="renameVisible" preset="card" class="fileset-dialog" :title="t('fileset.renameTitle')">
      <NInput
        v-model:value="renameValue"
        :maxlength="80"
        :placeholder="t('fileset.renamePlaceholder')"
        @keyup.enter="submitRename"
      />
      <template #footer>
        <div class="fileset-dialog-footer">
          <UiButton variant="outline" @click="renameVisible = false">{{ t('fileset.cancel') }}</UiButton>
          <UiButton :loading="renaming" @click="submitRename">{{ t('fileset.confirm') }}</UiButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="deleteVisible" preset="card" class="fileset-dialog" :title="t('fileset.deleteTitle')">
      <p>{{ t('fileset.deleteContent') }}</p>
      <template #footer>
        <div class="fileset-dialog-footer">
          <UiButton variant="outline" @click="deleteVisible = false">{{ t('fileset.cancel') }}</UiButton>
          <UiButton variant="danger" :loading="deleting" @click="submitDelete">{{ t('fileset.deleteConfirm') }}</UiButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { NInput, NModal } from 'naive-ui'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton, UiEmptyState, UiIcon, UiLoading } from '@/components/ui'
import { filesetApi } from '@/features/fileset/api/filesetApi'
import type { FileSetItem } from '@/types/fileset'

const { t } = useI18n()

const items = ref<FileSetItem[]>([])
const loading = ref(false)
const importing = ref(false)
const renaming = ref(false)
const deleting = ref(false)
const notice = ref('')

// 缩略图与视频地址按条目缓存，避免滚动或重渲染时重复签发协议令牌。
const thumbnails = reactive<Record<string, string>>({})
const previews = reactive<Record<string, string>>({})

const renameVisible = ref(false)
const renameValue = ref('')
const renameTarget = ref<FileSetItem | null>(null)

const deleteVisible = ref(false)
const deleteTarget = ref<FileSetItem | null>(null)

function detailOf(item: FileSetItem): string {
  const size = formatSize(item.byteSize)
  if (item.kind === 'image' && item.width && item.height) return `${item.width}×${item.height} · ${size}`
  return size
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

async function loadThumbnails(list: FileSetItem[]): Promise<void> {
  const images = list.filter((item) => item.kind === 'image' && !thumbnails[item.id])
  await Promise.all(
    images.map(async (item) => {
      try {
        const result = await filesetApi.thumbnail(item.id)
        if (result.url) thumbnails[item.id] = result.url
      } catch {
        // 单张缩略图失败时保留占位图标，不影响其余条目。
      }
    })
  )
}

async function loadVideoPreview(item: FileSetItem): Promise<void> {
  if (item.kind !== 'video' || previews[item.id]) return
  try {
    const result = await filesetApi.resolve(item.id)
    previews[item.id] = result.url
  } catch {
    // 地址签发失败时保持占位，不打断页面。
  }
}

async function reload(): Promise<void> {
  loading.value = true
  try {
    items.value = await filesetApi.list()
    void loadThumbnails(items.value)
  } catch (error) {
    notice.value = error instanceof Error ? error.message : t('fileset.loadFailed')
  } finally {
    loading.value = false
  }
}

async function importMedia(): Promise<void> {
  importing.value = true
  try {
    const paths = await filesetApi.selectFiles()
    if (!paths.length) return
    const result = await filesetApi.importFiles(paths)
    notice.value = t('fileset.importResult', {
      imported: result.imported.length + result.duplicated.length,
      duplicated: result.duplicated.length,
      failed: result.failed.length,
    })
    await reload()
  } catch (error) {
    notice.value = error instanceof Error ? error.message : t('fileset.importFailed')
  } finally {
    importing.value = false
  }
}

function openRename(item: FileSetItem): void {
  renameTarget.value = item
  renameValue.value = item.name
  renameVisible.value = true
}

async function submitRename(): Promise<void> {
  const target = renameTarget.value
  const name = renameValue.value.trim()
  if (!target || !name) return
  renaming.value = true
  try {
    const updated = await filesetApi.rename(target.id, name)
    items.value = items.value.map((item) => (item.id === updated.id ? updated : item))
    renameVisible.value = false
  } catch (error) {
    notice.value = error instanceof Error ? error.message : t('fileset.renameFailed')
  } finally {
    renaming.value = false
  }
}

function askDelete(item: FileSetItem): void {
  deleteTarget.value = item
  deleteVisible.value = true
}

async function submitDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  try {
    const result = await filesetApi.remove([target.id])
    if (result.inUse.length) {
      notice.value = t('fileset.inUse', { count: result.inUse.length })
    }
    deleteVisible.value = false
    await reload()
  } catch (error) {
    notice.value = error instanceof Error ? error.message : t('fileset.deleteFailed')
  } finally {
    deleting.value = false
  }
}

onMounted(reload)
</script>

<style scoped>
.fileset-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.fileset-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.fileset-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ecl-text-primary);
  font-weight: 600;
}

.fileset-count {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--ecl-surface);
  color: var(--ecl-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.fileset-toolbar-actions {
  display: flex;
  gap: 8px;
}

.fileset-hint,
.fileset-notice {
  margin: 0;
  color: var(--ecl-text-secondary);
  font-size: 12px;
}

.fileset-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.fileset-grid {
  display: grid;
  width: 100%;
  align-content: start;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.fileset-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card, 8px);
  background: var(--ecl-surface);
}

.fileset-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 6px;
  background: var(--ecl-canvas);
  color: var(--ecl-text-secondary);
}

.fileset-preview img,
.fileset-preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fileset-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.fileset-name {
  overflow: hidden;
  color: var(--ecl-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fileset-detail {
  color: var(--ecl-text-secondary);
  font-size: 11px;
}

.fileset-card-actions {
  display: flex;
  gap: 4px;
}

.fileset-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
