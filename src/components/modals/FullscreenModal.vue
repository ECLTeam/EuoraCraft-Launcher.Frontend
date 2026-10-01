<template>
  <Teleport to="body">
    <Transition name="fullscreen-modal" @afterEnter="onAfterEnter" @afterLeave="onAfterLeave">
      <div
        v-show="isVisible"
        class="fullscreen-modal"
        :data-modal-id="modalId"
        :inert="!isInteractive || undefined"
        role="dialog"
        :aria-modal="isInteractive"
        :aria-labelledby="titleId"
      >
        <div
          ref="modalRef"
          class="fullscreen-modal-wrapper"
          :class="[props.wrapperClass, props.bodyClass]"
          tabindex="-1"
          @click.stop
        >
          <main class="fullscreen-modal-body">
            <slot />
          </main>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, useId, watch } from 'vue'
import { pinia } from '@/app/stores'
import { useLayoutStore } from '@/app/stores/layoutStore'
import { useFullscreenModal } from '@/composables/useFullscreenModal'
import { useGlobalModalStack } from '@/composables/useGlobalModalStack'
import { useModalInteraction, useModalParent } from '@/composables/useModalInteraction'

defineOptions({ name: 'FullscreenModal' })

const props = withDefaults(defineProps<Props>(), {
  title: '',
  showFooter: true,
  bodyClass: '',
  wrapperClass: '',
  lockScroll: true,
  closable: true,
})

const emit = defineEmits<Emits>()

interface Props {
  visible: boolean
  title?: string
  showFooter?: boolean
  bodyClass?: string
  wrapperClass?: string
  lockScroll?: boolean
  closable?: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'open'): void
  (e: 'opened'): void
  (e: 'closed'): void
}

const fullscreenModal = useFullscreenModal()
const globalModalStack = useGlobalModalStack()
const layoutStore = useLayoutStore(pinia)
const modalRef = ref<HTMLElement | null>(null)
const instanceId = useId()
const modalId = `fullscreen-modal-${instanceId}`
const titleId = `fullscreen-modal-title-${instanceId}`
const isActive = computed(() => fullscreenModal.currentId.value === modalId)
const isVisible = computed(() => props.visible && isActive.value)
const isInteractive = computed(() => isVisible.value && globalModalStack.interactiveModalId.value === modalId)
useModalParent(modalId)

const requestClose = () => {
  emit('update:visible', false)
  emit('close')
}

const close = () => {
  if (!isInteractive.value) return
  fullscreenModal.unregister(modalId)
  requestClose()
}

const open = () => {
  emit('update:visible', true)
  emit('open')
}

const { restoreFocus } = useModalInteraction({
  modalId,
  container: modalRef,
  interactive: isInteractive,
  closable: () => props.closable,
  close,
})

const onAfterEnter = () => {
  emit('opened')
}

const onAfterLeave = () => {
  if (!props.visible) restoreFocus()
  emit('closed')
}

const togglePageContent = (isOpen: boolean) => {
  layoutStore.setModalPageSlideOut(isOpen)
}

const toggleScrollLock = (isOpen: boolean) => {
  layoutStore.setMainContentScrollLocked(isOpen)
}

const releasePageLockIfUnused = () => {
  toggleScrollLock(globalModalStack.isScrollLocked.value)
  togglePageContent(globalModalStack.isFullscreenActive.value)
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      fullscreenModal.open(modalId, props.title, requestClose, props.lockScroll)
    } else {
      fullscreenModal.unregister(modalId)
    }
  },
  { immediate: true }
)

watch(
  globalModalStack.isScrollLocked,
  (locked) => {
    toggleScrollLock(locked)
  },
  { immediate: true }
)

watch(
  globalModalStack.isFullscreenActive,
  (visible) => {
    togglePageContent(visible)
  },
  { immediate: true }
)

watch(
  () => props.title,
  (title) => {
    if (props.visible && isActive.value) {
      fullscreenModal.open(modalId, title, requestClose, props.lockScroll)
    }
  }
)

onUnmounted(() => {
  fullscreenModal.unregister(modalId)
  releasePageLockIfUnused()
  restoreFocus()
})

defineExpose({ close, open, modalId })
</script>

<style scoped src="@/styles/components/modals/FullscreenModal.css"></style>
