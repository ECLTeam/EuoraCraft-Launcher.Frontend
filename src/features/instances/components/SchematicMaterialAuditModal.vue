<template>
  <FullscreenModal
    :visible="visible"
    :title="`${sourceTitle} · 材料审计`"
    wrapperClass="schematic-audit-fullscreen"
    @update:visible="emit('update:visible', $event)"
  >
    <section class="schematic-audit">
      <header class="schematic-audit-summary">
        <div>
          <strong>{{ materials.length }}</strong
          ><span>种方块</span>
        </div>
        <div>
          <strong>{{ blockCount.toLocaleString() }}</strong
          ><span>个方块</span>
        </div>
        <div :class="{ warning: missingTextureCount > 0 }">
          <strong>{{ missingTextureCount }}</strong
          ><span>缺少纹理</span>
        </div>
        <div :class="{ warning: missingTranslationCount > 0 }">
          <strong>{{ missingTranslationCount }}</strong
          ><span>缺少翻译</span>
        </div>
      </header>

      <div class="schematic-audit-toolbar">
        <NInput v-model:value="query" clearable placeholder="搜索方块名称或 ID" class="schematic-audit-search">
          <template #prefix><UiIcon name="search" :size="16" /></template>
        </NInput>
        <NSelect v-model:value="filter" :options="filterOptions" class="schematic-audit-select" />
        <NSelect v-model:value="sort" :options="sortOptions" class="schematic-audit-select" />
        <NButton :loading="exporting" @click="exportManifest">
          <template #icon><UiIcon name="file-download" :size="16" /></template>
          导出清单
        </NButton>
      </div>

      <div class="schematic-audit-table-head"><span>方块</span><span>状态</span><span>数量</span></div>
      <NScrollbar class="schematic-audit-scroll">
        <ul class="schematic-audit-list">
          <li v-for="material in filteredMaterials" :key="material.name">
            <span
              class="schematic-audit-thumbnail"
              :class="{ 'is-missing': !material.hasTexture }"
              :style="{
                backgroundImage: material.thumbnail ? `url('${material.thumbnail}')` : undefined,
              }"
            >
              <UiIcon v-if="!material.hasTexture" name="warning" :size="20" className="audit-missing-icon" />
            </span>
            <span class="schematic-audit-material">
              <strong>{{ material.label }}</strong
              ><code>{{ material.name }}</code>
            </span>
            <span class="schematic-audit-status">
              <small v-if="!material.hasTexture" class="warning">无纹理</small>
              <small v-if="!material.hasTranslation" class="warning">无翻译</small>
              <small v-if="material.hasTexture && material.hasTranslation">正常</small>
            </span>
            <b>{{ material.count.toLocaleString() }}</b>
          </li>
          <li v-if="filteredMaterials.length === 0" class="schematic-audit-empty">没有匹配的方块</li>
        </ul>
      </NScrollbar>
    </section>
  </FullscreenModal>
</template>

<script setup lang="ts">
import { NButton, NInput, NScrollbar, NSelect } from 'naive-ui'
import { computed, ref } from 'vue'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import { UiIcon } from '@/components/ui'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import {
  filterSchematicMaterials,
  type SchematicMaterial,
  type SchematicMaterialFilter,
  type SchematicMaterialSort,
} from '@/features/instances/model/schematicMaterials'
import type { ScannedVersion } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'

interface Props {
  visible: boolean
  version?: ScannedVersion
  sourceTitle: string
  sessionId: string
  materials: SchematicMaterial[]
}

const props = withDefaults(defineProps<Props>(), { version: undefined })
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()
const message = useLauncherMessage()
const query = ref('')
const filter = ref<SchematicMaterialFilter>('all')
const sort = ref<SchematicMaterialSort>('count-desc')
const exporting = ref(false)
const filterOptions = [
  { label: '全部材料', value: 'all' },
  { label: '缺少纹理', value: 'missing-texture' },
  { label: '缺少翻译', value: 'missing-translation' },
]
const sortOptions = [
  { label: '数量：从多到少', value: 'count-desc' },
  { label: '数量：从少到多', value: 'count-asc' },
  { label: '名称：A 到 Z', value: 'name-asc' },
]
const filteredMaterials = computed(() =>
  filterSchematicMaterials(props.materials, query.value, filter.value, sort.value)
)
const blockCount = computed(() => props.materials.reduce((total, material) => total + material.count, 0))
const missingTextureCount = computed(() => props.materials.filter((material) => !material.hasTexture).length)
const missingTranslationCount = computed(() => props.materials.filter((material) => !material.hasTranslation).length)

async function exportManifest(): Promise<void> {
  if (!props.version || !props.sessionId || exporting.value) return
  exporting.value = true
  try {
    const selected = unwrapResponse(
      await backend.command('select_save_file', { purpose: 'schematic-material-manifest' }),
      '选择材料清单保存位置'
    )
    if (!selected.path) return
    const outputFormat = selected.path.toLocaleLowerCase().endsWith('.csv') ? 'csv' : 'json'
    const result = await instanceWorkspaceApi.exportSchematicMaterialManifest(
      workspaceTarget(props.version),
      props.sessionId,
      selected.path,
      outputFormat,
      props.materials.filter((material) => !material.hasTexture).map((material) => material.name)
    )
    message.success(`材料清单已导出至 ${result.path}`)
  } catch (cause) {
    message.error(getErrorMessage(cause, '导出材料清单失败'))
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.schematic-audit {
  display: flex;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  padding: 28px clamp(24px, 5vw, 88px);
  background: var(--ecl-surface);
}
.schematic-audit-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.schematic-audit-summary > div {
  display: flex;
  min-height: 88px;
  flex-direction: column;
  justify-content: center;
  padding: 16px 20px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--ecl-surface-secondary);
}
.schematic-audit-summary strong {
  font-size: 25px;
  font-variant-numeric: tabular-nums;
}
.schematic-audit-summary span,
.schematic-audit-status small {
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
.warning {
  color: var(--warning) !important;
}
.schematic-audit-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 22px 0 12px;
}
.schematic-audit-search {
  min-width: 220px;
  flex: 1;
}
.schematic-audit-select {
  width: 156px;
}
.schematic-audit-table-head,
.schematic-audit-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px 80px;
  align-items: center;
  gap: 16px;
}
.schematic-audit-table-head {
  padding: 8px 14px 8px 94px;
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
.schematic-audit-table-head span:last-child {
  text-align: right;
}
.schematic-audit-scroll {
  min-height: 0;
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}
.schematic-audit-list {
  margin: 0;
  padding: 6px;
  list-style: none;
}
.schematic-audit-list li {
  min-height: 82px;
  padding: 8px 12px;
  border-radius: 7px;
}
.schematic-audit-list li:hover {
  background: var(--ecl-surface-hover);
}
.schematic-audit-thumbnail {
  position: relative;
  display: grid;
  width: 64px;
  height: 64px;
  grid-row: 1;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  border-radius: 6px;
  background-color: transparent;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 112%;
  image-rendering: pixelated;
}
.schematic-audit-thumbnail.is-missing {
  border-style: dashed;
  color: var(--ecl-text-secondary);
}
.schematic-audit-material {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  grid-column: 1;
  padding-left: 76px;
}
.schematic-audit-material strong,
.schematic-audit-material code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.schematic-audit-material code {
  color: var(--ecl-text-secondary);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}
.schematic-audit-status {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.schematic-audit-list b {
  color: var(--ecl-text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.schematic-audit-empty {
  display: block !important;
  min-height: auto !important;
  padding: 40px !important;
  color: var(--ecl-text-secondary);
  text-align: center;
}
@media (max-width: 760px) {
  .schematic-audit {
    padding: 20px;
  }
  .schematic-audit-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .schematic-audit-toolbar {
    flex-wrap: wrap;
  }
  .schematic-audit-search {
    min-width: 100%;
    flex-basis: 100%;
  }
  .schematic-audit-table-head,
  .schematic-audit-list li {
    grid-template-columns: minmax(0, 1fr) 72px;
  }
  .schematic-audit-status,
  .schematic-audit-table-head span:nth-child(2) {
    display: none;
  }
}
</style>
