<template>
  <div ref="containerRef" class="skin-viewer-shell">
    <canvas ref="canvasRef" class="skin-viewer-canvas" />
    <div v-if="error" class="skin-viewer-error">{{ error }}</div>
    <NButtonGroup class="skin-viewer-actions" size="small">
      <NButton
        v-for="animation in visibleAnimations"
        :key="animation.key"
        quaternary
        :type="activeAnimation === animation.key ? 'primary' : 'default'"
        :data-testid="`animation-${animation.key}`"
        @click="setAnimation(animation.key)"
      >
        {{ animation.label }}
      </NButton>
    </NButtonGroup>
    <NButtonGroup class="skin-viewer-controls" size="small">
      <NButton quaternary :title="t('wardrobe.rotateLeft')" data-testid="rotate-left" @click="rotatePlayer(-1)">
        <template #icon><UiIcon name="rotate-left" :size="17" /></template>
      </NButton>
      <NButton
        quaternary
        :title="autoRotateEnabled ? t('wardrobe.pauseAutoRotate') : t('wardrobe.resumeAutoRotate')"
        data-testid="toggle-auto-rotate"
        @click="toggleAutoRotate"
      >
        <template #icon><UiIcon :name="autoRotateEnabled ? 'pause' : 'play'" :size="17" /></template>
      </NButton>
      <NButton quaternary :title="t('wardrobe.rotateRight')" data-testid="rotate-right" @click="rotatePlayer(1)">
        <template #icon><UiIcon name="rotate-right" :size="17" /></template>
      </NButton>
    </NButtonGroup>
  </div>
</template>

<script setup lang="ts">
import { NButton, NButtonGroup } from 'naive-ui'
import {
  CrouchAnimation,
  FlyingAnimation,
  IdleAnimation,
  RunningAnimation,
  SkinViewer,
  WalkingAnimation,
  WaveAnimation,
} from 'skinview3d'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import type { SkinModel } from '@/types/accounts'

const props = withDefaults(
  defineProps<{
    skinUrl?: string
    capeUrl?: string
    model?: SkinModel
    elytra?: boolean
    nameTag?: string
  }>(),
  { skinUrl: '', capeUrl: '', model: 'classic', elytra: false, nameTag: '' }
)

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref('')
const autoRotateEnabled = ref(false)
const activeAnimation = ref('')
const { t } = useI18n()
let viewer: SkinViewer | null = null
let resizeObserver: ResizeObserver | null = null

const ANIMATIONS = [
  { key: 'idle', label: t('wardrobe.animationIdle'), create: () => new IdleAnimation() },
  { key: 'walk', label: t('wardrobe.animationWalk'), create: () => new WalkingAnimation() },
  { key: 'run', label: t('wardrobe.animationRun'), create: () => new RunningAnimation() },
  { key: 'crouch', label: t('wardrobe.animationCrouch'), create: () => new CrouchAnimation() },
  { key: 'wave', label: t('wardrobe.animationWave'), create: () => new WaveAnimation() },
  {
    key: 'flying',
    label: t('wardrobe.animationFlying'),
    requiresElytra: true,
    create: () => new FlyingAnimation(),
  },
]

const visibleAnimations = computed(() => ANIMATIONS.filter((animation) => !animation.requiresElytra || props.elytra))

function setAnimation(key: string): void {
  if (!viewer) return
  const animation = ANIMATIONS.find((item) => item.key === key)
  if (!animation) return
  activeAnimation.value = key
  viewer.animation = animation.create()
}

function applyNameTag(): void {
  if (!viewer) return
  viewer.nameTag = props.nameTag || null
}

function rotatePlayer(direction: -1 | 1): void {
  if (!viewer) return
  viewer.playerObject.rotation.y += direction * (Math.PI / 8)
}

function toggleAutoRotate(): void {
  if (!viewer) return
  autoRotateEnabled.value = !autoRotateEnabled.value
  viewer.autoRotate = autoRotateEnabled.value
}

function resizeViewer(): void {
  if (!viewer || !containerRef.value) return
  viewer.width = Math.max(260, containerRef.value.clientWidth)
  viewer.height = Math.max(360, containerRef.value.clientHeight)
}

async function loadSkin(): Promise<void> {
  if (!viewer) return
  error.value = ''
  try {
    if (!props.skinUrl) {
      viewer.resetSkin()
      return
    }
    await viewer.loadSkin(props.skinUrl, { model: props.model === 'slim' ? 'slim' : 'default' })
  } catch {
    error.value = '皮肤纹理加载失败'
    viewer.resetSkin()
  }
}

async function loadCape(): Promise<void> {
  if (!viewer) return
  try {
    if (!props.capeUrl) {
      viewer.resetCape()
      return
    }
    await viewer.loadCape(props.capeUrl, { backEquipment: props.elytra ? 'elytra' : 'cape' })
  } catch {
    error.value = error.value || '披风纹理加载失败'
    viewer.resetCape()
  }
}

onMounted(async () => {
  await nextTick()
  if (!canvasRef.value) return
  try {
    viewer = new SkinViewer({ canvas: canvasRef.value, width: 360, height: 520, zoom: 0.78 })
    viewer.loadPanorama('/img/skinview3d.jpg')
    autoRotateEnabled.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    viewer.autoRotate = autoRotateEnabled.value
    viewer.autoRotateSpeed = 0.5
    resizeObserver = new ResizeObserver(resizeViewer)
    if (containerRef.value) resizeObserver.observe(containerRef.value)
    resizeViewer()
    applyNameTag()
    await Promise.all([loadSkin(), loadCape()])
  } catch {
    error.value = '当前设备无法初始化 3D 皮肤预览'
  }
})

watch(() => [props.skinUrl, props.model], loadSkin)
watch(() => [props.capeUrl, props.elytra], loadCape)
watch(() => props.nameTag, applyNameTag)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  // skinview3d 3.4.2 的 dispose() 仍按 three 0.156 的公开字段 fxaaPass.fsQuad 释放 FXAA，
  // 而项目使用的 three 0.186 已把它改成私有的 _fsQuad，直接释放会在最后一行抛 TypeError。
  // 这里把旧字段指向同一实例，让上游既能正常释放，也不至于把卸载流程炸掉。
  const fxaaPass = viewer?.fxaaPass as { fsQuad?: unknown; _fsQuad?: unknown } | undefined
  if (fxaaPass && !fxaaPass.fsQuad && fxaaPass._fsQuad) fxaaPass.fsQuad = fxaaPass._fsQuad
  try {
    viewer?.dispose()
  } catch (disposeError) {
    // 释放失败只影响显存回收，不应阻断组件卸载或触发 ErrorBoundary
    console.warn('[SkinViewer3D] 释放 3D 预览失败', disposeError)
  }
  viewer = null
})
</script>

<style scoped>
.skin-viewer-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  border-radius: var(--r-lg);
  background: var(--ecl-surface);
}

.skin-viewer-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.skin-viewer-error {
  position: absolute;
  inset: auto var(--s-md) var(--s-md);
  padding: var(--s-sm) var(--s-md);
  border-radius: var(--r-md);
  color: var(--error);
  background: var(--ecl-surface);
  text-align: center;
}

.skin-viewer-actions {
  position: absolute;
  left: var(--s-md);
  bottom: var(--s-md);
  z-index: 1;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);
  border-radius: var(--r-md);
  background: var(--ecl-surface);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(8px);
}

.skin-viewer-controls {
  position: absolute;
  right: var(--s-md);
  bottom: var(--s-md);
  z-index: 1;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);
  border-radius: var(--r-md);
  background: var(--ecl-surface);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(8px);
}
</style>
