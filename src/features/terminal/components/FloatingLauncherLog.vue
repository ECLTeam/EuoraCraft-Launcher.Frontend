<template>
  <Teleport to="body">
    <template v-if="launcherLogWindowEnabled">
      <!-- 最小化：可拖动的圆形按钮 -->
      <button
        v-if="launcherLogWindowMode === 'minimized'"
        class="fll-dot"
        :style="dotStyle"
        :title="t('dev.log.title')"
        @pointerdown="startDotDrag($event)"
        @click="onDotClick"
      >
        <UiIcon name="terminal" :size="22" />
        <span class="fll-dot-label">{{ t('dev.log.title') }}</span>
        <span v-if="launcherLogUnread > 0" class="fll-dot-badge">{{ cappedUnread }}</span>
      </button>

      <!-- 窗口化 / 最大化 -->
      <div
        v-else
        class="fll-window"
        :class="{ 'fll-window--max': launcherLogWindowMode === 'maximized' }"
        :style="panelStyle"
      >
        <div class="fll-titlebar" @pointerdown="onTitlebarDown">
          <UiIcon name="terminal" :size="15" />
          <span class="fll-title">{{ t('dev.log.title') }}</span>
          <span class="fll-title-grip" />

          <div class="fll-controls" @pointerdown.stop>
            <button class="fll-btn" :title="t('dev.log.minimize')" @click="minimize">
              <UiIcon name="minimize" :size="15" />
            </button>
            <button
              v-if="launcherLogWindowMode === 'floating'"
              class="fll-btn"
              :title="t('dev.log.maximize')"
              @click="maximize"
            >
              <UiIcon name="maximize" :size="14" />
            </button>
            <button v-else class="fll-btn" :title="t('dev.log.restore')" @click="restore">
              <UiIcon name="restore" :size="14" />
            </button>
          </div>
        </div>

        <LauncherLogView class="fll-body" />

        <!-- 右下角缩放手柄 -->
        <div v-if="launcherLogWindowMode === 'floating'" class="fll-resizer" @pointerdown="startResize($event)" />
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiIcon } from '@/components/ui'
import { launcherLogs } from '../composables/useLauncherLog'
import {
  persistLauncherLogLayout,
  readLauncherLogLayout,
  useLauncherLogWindow,
} from '../composables/useLauncherLogWindow'
import LauncherLogView from './LauncherLogView.vue'

defineOptions({ name: 'FloatingLauncherLog' })

const { t } = useI18n()
const {
  launcherLogWindowEnabled,
  launcherLogWindowMode,
  launcherLogUnread,
  launcherLogLayout,
  openLauncherLogWindow,
  minimizeLauncherLogWindow: minimize,
  maximizeLauncherLogWindow: maximize,
  restoreLauncherLogWindow: restore,
} = useLauncherLogWindow()

onMounted(readLauncherLogLayout)

// ── 窗口布局 ─────────────────────────────────────────────────────────
const viewportW = () => window.innerWidth
const viewportH = () => window.innerHeight

const panelStyle = computed(() =>
  launcherLogWindowMode.value === 'maximized'
    ? {}
    : {
        left: `${launcherLogLayout.x}px`,
        top: `${launcherLogLayout.y}px`,
        width: `${launcherLogLayout.width}px`,
        height: `${launcherLogLayout.height}px`,
      }
)

const dotStyle = computed(() => ({
  left: `${launcherLogLayout.bx}px`,
  top: `${launcherLogLayout.by}px`,
}))

const cappedUnread = computed(() => (launcherLogUnread.value > 99 ? '99+' : String(launcherLogUnread.value)))

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ── 拖动 / 缩放 ───────────────────────────────────────────────────────
let suppressClick = false

function startDrag(getPos: () => { x: number; y: number }, setPos: (x: number, y: number) => void) {
  return (event: PointerEvent) => {
    if (event.button !== 0) return
    suppressClick = false
    const startX = event.clientX
    const startY = event.clientY
    const origin = getPos()
    const onMove = (ev: PointerEvent) => {
      const nextX = clamp(origin.x + ev.clientX - startX, -40, viewportW() - 40)
      const nextY = clamp(origin.y + ev.clientY - startY, -40, viewportH() - 40)
      setPos(nextX, nextY)
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) suppressClick = true
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      persistLauncherLogLayout()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
}

const onTitlebarDown = startDrag(
  () => ({ x: launcherLogLayout.x, y: launcherLogLayout.y }),
  (x, y) => {
    launcherLogLayout.x = x
    launcherLogLayout.y = y
  }
)

const startDotDrag = startDrag(
  () => ({ x: launcherLogLayout.bx, y: launcherLogLayout.by }),
  (x, y) => {
    launcherLogLayout.bx = x
    launcherLogLayout.by = y
  }
)

function startResize(event: PointerEvent): void {
  if (launcherLogWindowMode.value !== 'floating') return
  event.stopPropagation()
  const startX = event.clientX
  const startY = event.clientY
  const originW = launcherLogLayout.width
  const originH = launcherLogLayout.height
  const onMove = (ev: PointerEvent) => {
    launcherLogLayout.width = clamp(originW + ev.clientX - startX, 320, viewportW() - launcherLogLayout.x)
    launcherLogLayout.height = clamp(originH + ev.clientY - startY, 220, viewportH() - launcherLogLayout.y)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    persistLauncherLogLayout()
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

// ── 交互 ─────────────────────────────────────────────────────────────
function onDotClick(): void {
  if (suppressClick) return
  openLauncherLogWindow()
}

// ── 最小化期间累计未读 ───────────────────────────────────────────────
// 日志由 LauncherLogView 内部订阅写入，这里仅依据缓冲长度差累计未读数
let prevLogsLength = launcherLogs.value.length
watch(
  () => launcherLogs.value.length,
  (length) => {
    if (launcherLogWindowMode.value === 'minimized') {
      launcherLogUnread.value += Math.max(0, length - prevLogsLength)
    }
    prevLogsLength = length
  }
)
</script>

<style src="@/styles/components/panels/FloatingLauncherLog.css"></style>
