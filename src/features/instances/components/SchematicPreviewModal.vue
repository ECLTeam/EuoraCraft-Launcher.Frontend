<template>
  <FullscreenModal
    :visible="visible"
    :title="title"
    wrapperClass="schematic-preview-fullscreen"
    @update:visible="emit('update:visible', $event)"
  >
    <section class="schematic-preview-layout">
      <main class="schematic-preview-content">
        <UiLoading :show="loading" mode="overlay" :label="loadingText" class="schematic-preview-stage">
          <div v-if="loading" class="schematic-preview-hint" aria-hidden="true" />
          <div v-else-if="error" class="schematic-preview-hint schematic-error">
            <UiIcon name="warning" :size="22" />
            <p>{{ error }}</p>
            <NButton size="small" @click="load">重试</NButton>
          </div>
          <SchematicViewer3D v-else-if="data" :data="data" :assets="assets" />
        </UiLoading>
        <aside v-if="data" class="schematic-preview-sidebar">
          <div class="schematic-material-heading">
            <div>
              <h4>方块清单</h4>
              <p>{{ materialCount }} 种方块 · {{ blockCount }} 个方块</p>
            </div>
            <div class="schematic-material-actions">
              <NButton quaternary size="tiny" :disabled="!assets" @click="auditVisible = true">
                <template #icon><UiIcon name="list" :size="15" /></template>
                材料审计
              </NButton>
              <span>数量</span>
            </div>
          </div>
          <div v-if="assets?.missingBlocks.length" class="schematic-missing">
            {{ assets.missingBlocks.length }} 种方块没有可用纹理，将显示缺失标记。
          </div>
          <NScrollbar class="schematic-material-scroll">
            <ul class="schematic-material-list">
              <li v-for="material in materials" :key="material.name" :title="material.name">
                <span
                  class="material-color"
                  :class="{ 'is-missing': !material.hasTexture }"
                  :style="{
                    backgroundImage: material.thumbnail ? `url('${material.thumbnail}')` : undefined,
                  }"
                >
                  <UiIcon v-if="!material.hasTexture" name="warning" :size="18" className="material-missing-icon" />
                </span>
                <span class="material-detail">
                  <strong>{{ assets?.blockNames?.[material.name] ?? material.name }}</strong>
                  <code>{{ material.name }}</code>
                </span>
                <b>{{ material.count.toLocaleString() }}</b>
              </li>
            </ul>
          </NScrollbar>
        </aside>
      </main>
    </section>
  </FullscreenModal>
  <SchematicMaterialAuditModal
    v-model:visible="auditVisible"
    :version="version"
    :sourceTitle="title"
    :sessionId="data?.sessionId ?? ''"
    :materials="materials"
  />
</template>

<script setup lang="ts">
import { NButton, NScrollbar } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import { UiIcon, UiLoading } from '@/components/ui'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import { SchematicMaterialThumbnailRenderer } from '@/features/instances/lib/schematicMaterialThumbnailRenderer'
import { buildSchematicMaterials } from '@/features/instances/model/schematicMaterials'
import type { SchematicAssetsBundle, SchematicSessionData } from '@/types/api'
import type { ScannedVersion } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'
import SchematicMaterialAuditModal from './SchematicMaterialAuditModal.vue'
import SchematicViewer3D from './SchematicViewer3D.vue'

interface Props {
  visible: boolean
  version?: ScannedVersion
  resourceId?: string
  resourceName?: string
}
const props = withDefaults(defineProps<Props>(), { version: undefined, resourceId: '', resourceName: '' })
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()
const { t, locale } = useI18n()
const message = useLauncherMessage()
const loading = ref(false)
const loadingText = ref('')
const error = ref('')
const data = ref<SchematicSessionData | null>(null)
const assets = ref<SchematicAssetsBundle | null>(null)
const thumbnailSources = ref<Record<string, string>>({})
const auditVisible = ref(false)
const title = computed(() => props.resourceName || t('schematic.title'))
const materials = computed(() =>
  buildSchematicMaterials(data.value, assets.value, thumbnailSources.value).sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label, undefined, { numeric: true })
  )
)
const materialCount = computed(() => materials.value.length)
const blockCount = computed(() => materials.value.reduce((total, item) => total + item.count, 0))
let loadEpoch = 0
let thumbnailRenderer: SchematicMaterialThumbnailRenderer | null = null

function disposeThumbnails(): void {
  thumbnailRenderer?.dispose()
  thumbnailRenderer = null
  thumbnailSources.value = {}
}

async function startThumbnails(
  bundle: SchematicAssetsBundle,
  entries: SchematicSessionData['palette'],
  epoch: number
): Promise<void> {
  disposeThumbnails()
  let renderer: SchematicMaterialThumbnailRenderer | null = null
  try {
    renderer = new SchematicMaterialThumbnailRenderer(bundle, (name, source) => {
      if (!source || thumbnailRenderer !== renderer || epoch !== loadEpoch) return
      thumbnailSources.value = { ...thumbnailSources.value, [name]: source }
    })
    thumbnailRenderer = renderer
    await renderer.start(entries)
  } catch {
    if (thumbnailRenderer === renderer) disposeThumbnails()
  }
}

async function load(): Promise<void> {
  if (!props.version || !props.resourceId) return
  const epoch = ++loadEpoch
  const previousSessionId = data.value?.sessionId
  if (previousSessionId) void instanceWorkspaceApi.schematicSessionClose(previousSessionId)
  disposeThumbnails()
  loading.value = true
  loadingText.value = t('schematic.loading')
  error.value = ''
  data.value = null
  assets.value = null
  try {
    const target = workspaceTarget(props.version)
    const opened = await instanceWorkspaceApi.schematicSessionOpen(target, props.resourceId)
    if (epoch !== loadEpoch) {
      void instanceWorkspaceApi.schematicSessionClose(opened.sessionId)
      return
    }
    data.value = opened
    loadingText.value = '正在读取游戏方块纹理…'
    const blocks = [
      ...new Set(
        opened.palette
          .map((item) => item.name)
          .filter((name) => !['air', 'cave_air', 'void_air'].includes(name.split(':').at(-1) ?? ''))
      ),
    ]
    if (blocks.length) {
      assets.value = await instanceWorkspaceApi.schematicAssets(target, blocks)
      if (epoch === loadEpoch && assets.value) void startThumbnails(assets.value, opened.palette, epoch)
    }
  } catch (cause) {
    if (epoch !== loadEpoch) return
    error.value = getErrorMessage(cause, t('schematic.parseFailed'))
    message.error(error.value)
  } finally {
    if (epoch === loadEpoch) loading.value = false
  }
}
watch(
  () => props.visible,
  (open) => {
    if (open) {
      void load()
    } else {
      resetPreview()
    }
  }
)
watch(locale, () => {
  if (!props.visible) return
  auditVisible.value = false
  void load()
})
function resetPreview(): void {
  loadEpoch += 1
  auditVisible.value = false
  disposeThumbnails()
  const sessionId = data.value?.sessionId
  if (sessionId) void instanceWorkspaceApi.schematicSessionClose(sessionId)
  data.value = null
  assets.value = null
  error.value = ''
}
onBeforeUnmount(resetPreview)
</script>

<style scoped>
.schematic-preview-layout {
  display: flex;
  height: 100%;
  flex-direction: column;
  background: var(--ecl-surface);
}
.schematic-preview-sidebar p {
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
.schematic-preview-content {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 340px;
}
.schematic-preview-stage {
  min-width: 0;
  height: 100%;
}
.schematic-preview-hint {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--ecl-text-secondary);
}
.schematic-error {
  color: var(--error);
}
.schematic-preview-sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  padding: 18px;
  border-left: 1px solid var(--border-color);
}
.schematic-material-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.schematic-material-heading h4 {
  margin: 0;
}
.schematic-material-heading > span {
  padding-bottom: 1px;
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
.schematic-material-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.schematic-material-actions > span {
  padding-bottom: 1px;
  color: var(--ecl-text-secondary);
  font-size: 12px;
}
.schematic-missing {
  margin: 14px 0;
  color: var(--warning);
  font-size: 12px;
}
.schematic-material-scroll {
  min-height: 0;
  flex: 1;
  margin: 12px -8px -8px;
  padding: 0 8px 8px;
}
.schematic-material-list {
  display: flex;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 3px;
  list-style: none;
}
.schematic-material-list li {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
}
.schematic-material-list li:hover {
  background: var(--ecl-surface-hover);
}
.material-color {
  position: relative;
  display: grid;
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  border-radius: 5px;
  background-color: transparent;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 112%;
  image-rendering: pixelated;
}
.material-color.is-missing {
  border-style: dashed;
  color: var(--ecl-text-secondary);
}
.schematic-material-list b {
  min-width: 46px;
  color: var(--ecl-text-secondary);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.material-detail {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.material-detail strong,
.material-detail code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.material-detail strong {
  font-weight: 600;
}
.material-detail code {
  color: var(--ecl-text-secondary);
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}
@media (max-width: 900px) {
  .schematic-preview-content {
    grid-template-columns: 1fr;
  }
  .schematic-preview-sidebar {
    display: none;
  }
}
</style>
