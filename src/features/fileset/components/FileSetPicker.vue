<template>
  <Modal
    :visible="visible"
    :title="title"
    width="760px"
    :showFooter="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="loading" class="fileset-picker-state"><UiLoading /></div>
    <UiEmptyState
      v-else-if="!visibleItems.length"
      icon="photo"
      :title="t('fileset.emptyTitle')"
      :description="t('fileset.pickerEmpty')"
    />
    <div v-else class="fileset-picker-grid">
      <button
        v-for="item in visibleItems"
        :key="item.id"
        type="button"
        class="fileset-picker-item"
        :title="item.name"
        @click="select(item)"
      >
        <span class="fileset-picker-preview">
          <img v-if="item.kind === 'image' && thumbnails[item.id]" :src="thumbnails[item.id]" alt="" loading="lazy" />
          <UiIcon v-else :name="item.kind === 'video' ? 'movie' : 'photo'" :size="22" />
        </span>
        <span class="fileset-picker-name">{{ item.name }}</span>
      </button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import { UiEmptyState, UiIcon, UiLoading } from '@/components/ui'
import { filesetApi } from '@/features/fileset/api/filesetApi'
import type { FileSetItem } from '@/types/fileset'

const props = withDefaults(
  defineProps<{
    visible: boolean
    /** 只展示某类媒体；`all` 表示图片与视频都可选。 */
    kind?: 'image' | 'video' | 'all'
  }>(),
  { kind: 'all' }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [item: FileSetItem]
}>()

const { t } = useI18n()

const items = ref<FileSetItem[]>([])
const loading = ref(false)
const thumbnails = reactive<Record<string, string>>({})

const title = computed(() =>
  props.kind === 'image' ? t('fileset.pickerImageTitle') : props.kind === 'video' ? t('fileset.pickerVideoTitle') : t('fileset.title')
)

const visibleItems = computed(() =>
  props.kind === 'all' ? items.value : items.value.filter((item) => item.kind === props.kind)
)

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await filesetApi.list()
    await Promise.all(
      items.value
        .filter((item) => item.kind === 'image' && !thumbnails[item.id])
        .map(async (item) => {
          try {
            const result = await filesetApi.thumbnail(item.id)
            if (result.url) thumbnails[item.id] = result.url
          } catch {
            // 单张缩略图失败时保留占位图标。
          }
        })
    )
  } finally {
    loading.value = false
  }
}

function select(item: FileSetItem): void {
  emit('select', item)
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void load()
  }
)
</script>

<style scoped>
.fileset-picker-state {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
}

.fileset-picker-grid {
  display: grid;
  max-height: 60vh;
  overflow: auto;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.fileset-picker-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card, 8px);
  background: var(--ecl-surface);
  color: var(--ecl-text-primary);
  cursor: pointer;
  text-align: left;
}

.fileset-picker-item:hover {
  border-color: var(--ecl-primary, var(--ecl-text-secondary));
}

.fileset-picker-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 6px;
  background: var(--ecl-canvas);
  color: var(--ecl-text-secondary);
}

.fileset-picker-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fileset-picker-name {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
