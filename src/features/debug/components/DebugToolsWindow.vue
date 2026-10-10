<template>
  <Teleport to="body">
    <section
      ref="windowRef"
      class="debug-tools-window"
      :class="{ 'is-minimized': store.mode === 'minimized' }"
      :style="windowStyle"
      :inert="isBlocked || undefined"
      :aria-hidden="isBlocked || undefined"
      :aria-labelledby="titleId"
      role="region"
      tabindex="-1"
      @keydown.esc="onEscape"
    >
      <header class="debug-window-header" @pointerdown="startGesture($event, 'move')">
        <UiIcon name="bug" :size="16" />
        <span :id="titleId" class="debug-window-title">{{ t('dev.title') }}</span>
        <div class="debug-window-actions" @pointerdown.stop>
          <button
            v-if="store.mode === 'minimized'"
            :aria-label="t('dev.window.restore')"
            :title="t('dev.window.restore')"
            @click="restore"
          >
            <UiIcon name="restore" :size="16" />
          </button>
          <button v-else :aria-label="t('dev.window.minimize')" :title="t('dev.window.minimize')" @click="minimize">
            <UiIcon name="minimize" :size="16" />
          </button>
        </div>
      </header>
      <div v-show="store.mode === 'floating'" class="debug-window-body">
        <DevToolsPanel />
      </div>
      <button
        v-if="store.mode === 'floating'"
        class="debug-window-resizer"
        :aria-label="t('dev.window.resize')"
        :title="t('dev.window.resize')"
        @pointerdown="startGesture($event, 'resize')"
        @keydown="resizeWithKeyboard"
      >
        <UiIcon name="maximize" :size="16" />
      </button>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { useDebugToolsWindowStore } from '@/features/debug/stores/debugToolsWindowStore'
import DevToolsPanel from './DevToolsPanel.vue'

const { t } = useI18n()
const store = useDebugToolsWindowStore()
const stack = useGlobalModalStack()
const windowRef = ref<HTMLElement | null>(null)
const titleId = `debug-tools-${useId()}`
const isBlocked = stack.hasActiveOverlay
const windowStyle = computed(() => ({
  left: `${store.layout.x}px`,
  top: `${store.layout.y}px`,
  width: `${store.mode === 'minimized' ? Math.min(260, store.layout.width) : store.layout.width}px`,
  height: store.mode === 'minimized' ? '44px' : `${store.layout.height}px`,
}))

let gesture: {
  kind: 'move' | 'resize'
  pointerId: number
  element: HTMLElement
  clientX: number
  clientY: number
  x: number
  y: number
  width: number
  height: number
} | null = null

function stopGesture(): void {
  const previous = gesture
  gesture = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerEnd)
  window.removeEventListener('pointercancel', onPointerEnd)
  if (previous) {
    previous.element.removeEventListener('lostpointercapture', stopGesture)
    if (previous.element.hasPointerCapture(previous.pointerId))
      previous.element.releasePointerCapture(previous.pointerId)
  }
}

function startGesture(event: PointerEvent, kind: 'move' | 'resize'): void {
  if (isBlocked.value || event.button !== 0 || store.mode === 'closed') return
  if (kind === 'resize' && store.mode !== 'floating') return
  if (kind === 'move' && (event.target as Element).closest('button')) return
  stopGesture()
  event.preventDefault()
  const element = event.currentTarget as HTMLElement
  gesture = {
    kind,
    pointerId: event.pointerId,
    element,
    clientX: event.clientX,
    clientY: event.clientY,
    ...store.layout,
  }
  element.setPointerCapture(event.pointerId)
  element.addEventListener('lostpointercapture', stopGesture)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerEnd)
  window.addEventListener('pointercancel', onPointerEnd)
}

function onPointerMove(event: PointerEvent): void {
  if (!gesture || event.pointerId !== gesture.pointerId) return
  const dx = event.clientX - gesture.clientX
  const dy = event.clientY - gesture.clientY
  if (gesture.kind === 'move') store.move(gesture.x + dx, gesture.y + dy)
  else store.resize(gesture.width + dx, gesture.height + dy)
}

function onPointerEnd(event: PointerEvent): void {
  if (event.pointerId === gesture?.pointerId) stopGesture()
}

function resizeWithKeyboard(event: KeyboardEvent): void {
  if (isBlocked.value || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  store.resize(
    store.layout.width + (event.key === 'ArrowRight' ? 20 : event.key === 'ArrowLeft' ? -20 : 0),
    store.layout.height + (event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0)
  )
}

function minimize(): void {
  if (isBlocked.value) return
  stopGesture()
  store.minimize()
  void nextTick(() => {
    if (!isBlocked.value) store.restoreFocus()
  })
}

function restore(): void {
  if (isBlocked.value) return
  store.open()
  void nextTick(() => windowRef.value?.focus())
}

function onEscape(event: KeyboardEvent): void {
  if (isBlocked.value || event.defaultPrevented) return
  event.preventDefault()
  event.stopPropagation()
  minimize()
}

watch(isBlocked, (blocked) => {
  if (blocked) stopGesture()
})
watch(
  () => store.mode,
  (mode) => {
    stopGesture()
    if (mode === 'floating')
      void nextTick(() => {
        if (!isBlocked.value) windowRef.value?.focus()
      })
  }
)
onMounted(() => {
  store.constrain()
  window.addEventListener('resize', store.constrain)
  void nextTick(() => {
    if (!isBlocked.value && store.mode === 'floating') windowRef.value?.focus()
  })
})
onUnmounted(() => {
  stopGesture()
  window.removeEventListener('resize', store.constrain)
})
</script>

<style scoped src="@/styles/features/debug/DebugToolsWindow.css"></style>
