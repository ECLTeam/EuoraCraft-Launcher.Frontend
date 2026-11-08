<template>
  <div ref="shellRef" class="schematic-viewer-shell">
    <canvas ref="canvasRef" class="schematic-viewer-canvas" />
    <div v-if="renderError" class="schematic-viewer-empty">{{ renderError }}</div>
    <div v-else-if="building" class="schematic-viewer-empty">{{ t('schematic.loading') }}</div>
    <div v-else-if="noBlocks" class="schematic-viewer-empty">{{ t('schematic.empty') }}</div>
    <div v-else class="schematic-viewer-info">{{ t('schematic.size', { x: size[0], y: size[1], z: size[2] }) }}</div>
    <div v-if="loadedChunks && loadedChunks < totalChunks" class="schematic-viewer-progress">
      {{ loadedChunks }} / {{ totalChunks }} 区块
    </div>
    <div v-if="!noBlocks" class="schematic-viewer-toolbar">
      <NButtonGroup size="small">
        <NButton quaternary :title="t('schematic.rotateLeft')" @click="rotateModel(-1)"
          ><template #icon><UiIcon name="rotate-left" :size="17" /></template
        ></NButton>
        <NButton quaternary :title="t('schematic.rotateRight')" @click="rotateModel(1)"
          ><template #icon><UiIcon name="rotate-right" :size="17" /></template
        ></NButton>
        <NButton quaternary :title="t('schematic.resetView')" @click="resetView"
          ><template #icon><UiIcon name="refresh" :size="16" /></template
        ></NButton>
      </NButtonGroup>
      <div class="slice-control">
        <span>{{ t('schematic.sliceY') }}</span
        ><NSlider v-model:value="visibleLayers" :min="1" :max="Math.max(1, size[1] ?? 1)" :tooltip="false" /><NButton
          quaternary
          circle
          size="tiny"
          :title="t('schematic.showAll')"
          @click="showAll"
          ><template #icon><UiIcon name="layers" :size="15" /></template
        ></NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NButtonGroup, NSlider } from 'naive-ui'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiIcon } from '@/components/ui'
import { SchematicSessionViewer } from '@/features/instances/lib/schematicSessionViewer'
import { buildSchematicAtlas } from '@/features/instances/lib/schematicStructureRenderer'
import type { SchematicAssetsBundle, SchematicSessionData } from '@/types/api'

const props = defineProps<{ data: SchematicSessionData; assets: SchematicAssetsBundle | null }>()
const { t } = useI18n()
const shellRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const size = ref(props.data.size)
const visibleLayers = ref(Math.max(1, props.data.size[1] ?? 1))
const noBlocks = ref(props.data.chunks.length === 0)
const renderError = ref('')
const building = ref(props.data.chunks.length > 0)
const loadedChunks = ref(0)
const totalChunks = ref(props.data.chunks.length)
let viewer: SchematicSessionViewer | null = null
let resizeObserver: ResizeObserver | null = null
let disposed = false
let initializationFrame = 0
let rebuildFrame = 0

function rotateModel(direction: -1 | 1): void {
  viewer?.rotate(direction)
}
function resetView(): void {
  viewer?.resetView()
}
function showAll(): void {
  visibleLayers.value = Math.max(1, size.value[1] ?? 1)
}
function rebuildVisibleLayers(value: number): void {
  cancelAnimationFrame(rebuildFrame)
  building.value = true
  rebuildFrame = requestAnimationFrame(() => {
    viewer?.setVisibleLayers(value)
    building.value = false
  })
}

watch(visibleLayers, rebuildVisibleLayers)

function initializeViewer(): void {
  const canvas = canvasRef.value
  const assets = props.assets
  if (!canvas || !assets || viewer || initializationFrame) return
  const bounds = canvas.getBoundingClientRect()
  if (bounds.width < 2 || bounds.height < 2) return
  initializationFrame = requestAnimationFrame(async () => {
    initializationFrame = 0
    try {
      const atlas = await buildSchematicAtlas(assets)
      if (disposed) return
      viewer = new SchematicSessionViewer(
        canvas,
        props.data,
        assets,
        atlas,
        (loaded, total) => {
          loadedChunks.value = loaded
          totalChunks.value = total
        },
        (message) => {
          renderError.value = message
        }
      )
      noBlocks.value = props.data.chunks.length === 0
    } catch (cause) {
      renderError.value = cause instanceof Error ? cause.message : t('schematic.parseFailed')
    } finally {
      building.value = false
    }
  })
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (viewer) viewer.resize()
    else initializeViewer()
  })
  if (shellRef.value) resizeObserver.observe(shellRef.value)
  initializeViewer()
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(initializationFrame)
  cancelAnimationFrame(rebuildFrame)
  resizeObserver?.disconnect()
  viewer?.dispose()
})
</script>

<style scoped>
.schematic-viewer-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
  background: var(--ecl-surface);
}
.schematic-viewer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.schematic-viewer-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--ecl-text-secondary, #999);
}
.schematic-viewer-progress,
.schematic-viewer-info,
.schematic-viewer-toolbar {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--border-color, #333) 75%, transparent);
  background: color-mix(in srgb, var(--ecl-surface) 88%, transparent);
  backdrop-filter: blur(10px);
}
.schematic-viewer-info {
  top: 16px;
  left: 16px;
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--ecl-text-secondary, #999);
  font-size: 12px;
}
.schematic-viewer-progress {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--ecl-text-secondary, #999);
  font-size: 12px;
}
.schematic-viewer-toolbar {
  right: 16px;
  bottom: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  border-radius: 12px;
}
.slice-control {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  color: var(--ecl-text-secondary, #999);
  font-size: 12px;
}
.slice-control > span {
  flex-shrink: 0;
  white-space: nowrap;
}
.slice-control :deep(.n-slider) {
  min-width: 0;
}
</style>
