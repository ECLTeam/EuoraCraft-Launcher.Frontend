<template>
  <Teleport :to="host ?? 'body'">
    <section
      v-show="!isBlocked"
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
import { computed, nextTick, onMounted, onUnmounted, provide, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { modalParentKey } from '@/composables/useModalInteraction'
import { debugToolsHosts } from '@/features/debug/model/debugToolsHosts'
import { useDebugToolsWindowStore } from '@/features/debug/stores/debugToolsWindowStore'
import DevToolsPanel from './DevToolsPanel.vue'

const { t } = useI18n()
const store = useDebugToolsWindowStore()
const stack = useGlobalModalStack()
provide(
  modalParentKey,
  computed(() => stack.currentFullscreenId.value)
)
const windowRef = ref<HTMLElement | null>(null)
const titleId = `debug-tools-${useId()}`
const host = computed(() => {
  if (!stack.hasActiveOverlay.value) return debugToolsHosts.get('page') ?? null
  const id = stack.currentFullscreenId.value
  return id && stack.interactiveModalId.value === id ? (debugToolsHosts.get(id) ?? null) : null
})
const isBlocked = computed(() => host.value === null)
const hostPosition = ref({ left: 0, top: 0, width: 260 })
const windowStyle = computed(() => ({
  left: `${store.mode === 'minimized' ? 0 : store.layout.x - hostPosition.value.left}px`,
  top: `${store.mode === 'minimized' ? 0 : store.layout.y - hostPosition.value.top}px`,
  width: `${store.mode === 'minimized' ? Math.min(260, hostPosition.value.width) : store.layout.width}px`,
  height: store.mode === 'minimized' ? '44px' : `${store.layout.height}px`,
}))

let resizeObserver: ResizeObserver | null = null
let measureFrame = 0
let disposed = false
function measureHost(): void {
  const element = host.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  if (!rect.width) return
  hostPosition.value = { left: rect.left, top: rect.top, width: rect.width }
  const parent = element.parentElement?.getBoundingClientRect()
  store.setBounds({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: (parent?.bottom ?? window.innerHeight) - 16,
  })
}
function scheduleMeasure(): void {
  if (disposed || measureFrame) return
  measureFrame = requestAnimationFrame(() => {
    measureFrame = 0
    measureHost()
  })
}
function observeHost(): void {
  stopGesture()
  resizeObserver?.disconnect()
  void nextTick(() => {
    if (disposed) return
    measureHost()
    if (host.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure)
      resizeObserver.observe(host.value)
    }
  })
}
watch(host, observeHost, { flush: 'post' })

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
  if (kind === 'move' && (store.mode !== 'floating' || (event.target as Element).closest('button'))) return
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
    if (isBlocked.value || store.restoreFocus()) return
    const modal = windowRef.value?.closest<HTMLElement>('[data-modal-id]')
    if (modal) modal.querySelector<HTMLElement>('.fullscreen-modal-wrapper')?.focus()
    else windowRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
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
  observeHost()
  store.constrain()
  window.addEventListener('resize', scheduleMeasure)
  window.addEventListener('scroll', scheduleMeasure, true)
  void nextTick(() => {
    if (!isBlocked.value && store.mode === 'floating') windowRef.value?.focus()
  })
})
onUnmounted(() => {
  disposed = true
  stopGesture()
  resizeObserver?.disconnect()
  cancelAnimationFrame(measureFrame)
  window.removeEventListener('resize', scheduleMeasure)
  window.removeEventListener('scroll', scheduleMeasure, true)
})
</script>

<style scoped src="@/styles/features/debug/DebugToolsWindow.css"></style>
