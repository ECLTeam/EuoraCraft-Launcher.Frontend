<template>
  <Teleport :to="host ?? 'body'">
    <section
      v-show="!isBlocked"
      ref="windowRef"
      class="debug-tools-window"
      :class="{ 'is-minimized': store.mode === 'minimized', 'is-circle': isCircle }"
      :style="windowStyle"
      :inert="isBlocked || undefined"
      :aria-hidden="isBlocked || undefined"
      :aria-labelledby="isCircle ? undefined : titleId"
      :aria-label="isCircle ? t('dev.title') : undefined"
      role="region"
      tabindex="-1"
      @keydown.esc="onEscape"
    >
      <button
        v-if="isCircle"
        type="button"
        class="debug-circle-button"
        :aria-label="t('dev.window.restore')"
        :title="t('dev.window.restore')"
        @pointerdown="startGesture($event, 'move')"
        @click="restoreCircle"
      >
        <UiIcon name="bug" :size="20" />
      </button>
      <header v-else class="debug-window-header" @pointerdown="startGesture($event, 'move')">
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
          <button
            :aria-label="t('dev.window.close')"
            :title="t('dev.window.close')"
            :disabled="store.isSavingPreferences"
            @click="close"
          >
            <UiIcon name="close" :size="16" />
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
import { computed, nextTick, onMounted, onUnmounted, provide, ref, shallowRef, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { modalParentKey } from '@/composables/useModalInteraction'
import { useDebugToolsWindowStore } from '@/features/debug/stores/debugToolsWindowStore'
import DevToolsPanel from './DevToolsPanel.vue'

const { t } = useI18n()
const store = useDebugToolsWindowStore()
const { run } = useAsyncAction({ showSuccess: false, showError: true })
const isCircle = computed(() => store.mode === 'minimized' && store.minimizedShape === 'circle')
const stack = useGlobalModalStack()
provide(
  modalParentKey,
  computed(() => stack.currentFullscreenId.value)
)
const windowRef = ref<HTMLElement | null>(null)
const titleId = `debug-tools-${useId()}`
const host = shallowRef<HTMLElement | null>(null)
function resolveHost(): void {
  if (!stack.hasActiveOverlay.value) host.value = document.querySelector<HTMLElement>('#main-content')
  else {
    const id = stack.currentFullscreenId.value
    const modal =
      id && stack.interactiveModalId.value === id
        ? [...document.querySelectorAll<HTMLElement>('[data-modal-id]')].find(
            (element) => element.dataset.modalId === id
          )
        : null
    host.value = modal?.querySelector<HTMLElement>('.fullscreen-modal-wrapper') ?? null
  }
}
watch([stack.hasActiveOverlay, stack.currentFullscreenId, stack.interactiveModalId], resolveHost, { flush: 'post' })
const isBlocked = computed(() => host.value === null)
const hostPosition = ref({ left: 0, top: 0, width: 260, insetX: 0, insetY: 0, scrollX: 0, scrollY: 0 })
const windowStyle = computed(() => ({
  left: `${(store.mode === 'minimized' ? hostPosition.value.insetX + store.minimizedPosition.x : store.layout.x - hostPosition.value.left) + hostPosition.value.scrollX}px`,
  top: `${(store.mode === 'minimized' ? hostPosition.value.insetY + store.minimizedPosition.y : store.layout.y - hostPosition.value.top) + hostPosition.value.scrollY}px`,
  width: `${store.mode === 'minimized' ? Math.min(store.minimizedWidth, hostPosition.value.width) : store.layout.width}px`,
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
  const style = getComputedStyle(element)
  const gutter = Number.parseFloat(style.getPropertyValue('--page-gutter')) || 16
  const insetX = Number.parseFloat(style.paddingLeft) || gutter
  const insetY = Number.parseFloat(style.paddingTop) || gutter
  hostPosition.value = {
    left: rect.left,
    top: rect.top,
    width: rect.width - 2 * insetX,
    insetX,
    insetY,
    scrollX: element.scrollLeft,
    scrollY: element.scrollTop,
  }
  store.setBounds({
    left: rect.left + insetX,
    top: rect.top + insetY,
    right: rect.right - insetX,
    bottom: rect.bottom - insetY,
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
  moved: boolean
} | null = null
let suppressCircleClick = false

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
  if (kind === 'move' && !isCircle.value && (event.target as Element).closest('button')) return
  stopGesture()
  if (!isCircle.value) event.preventDefault()
  suppressCircleClick = false
  const element = event.currentTarget as HTMLElement
  gesture = {
    kind,
    pointerId: event.pointerId,
    element,
    clientX: event.clientX,
    clientY: event.clientY,
    ...store.layout,
    ...(store.mode === 'minimized' ? store.minimizedPosition : {}),
    moved: false,
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
  if (isCircle.value && !gesture.moved && Math.hypot(dx, dy) < 4) return
  gesture.moved = true
  if (gesture.kind === 'move') store.move(gesture.x + dx, gesture.y + dy)
  else store.resize(gesture.width + dx, gesture.height + dy)
}

function onPointerEnd(event: PointerEvent): void {
  if (event.pointerId !== gesture?.pointerId) return
  suppressCircleClick = isCircle.value && gesture.moved && event.type === 'pointerup'
  stopGesture()
}

function restoreCircle(event: MouseEvent): void {
  // 拖动结束后浏览器仍会派发 click；键盘 click 的 detail 为 0，不受上次拖动影响。
  if (suppressCircleClick && event.detail !== 0) {
    suppressCircleClick = false
    return
  }
  suppressCircleClick = false
  restore()
}

async function close(): Promise<void> {
  if (isBlocked.value) return
  stopGesture()
  await run(async () => {
    if (!(await store.savePreferences({ visible: false }))) return
    if (!store.restoreFocus()) {
      host.value?.querySelector<HTMLElement>('button, a[href], input, [tabindex="0"]')?.focus()
    }
  })
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
watch(() => store.minimizedShape, stopGesture)
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
  resolveHost()
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
