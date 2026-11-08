<template>
  <Modal
    :visible="visible && popup !== null"
    :type="modalType"
    :title="popup?.title ?? ''"
    :closable="popup?.dismissible ?? true"
    :showCloseBtn="popup?.dismissible ?? true"
    :maskClosable="popup?.dismissible ?? true"
    :priority="popup?.priority"
    width="560px"
    wrapperClass="launcher-popup-modal"
    transitionName="launcher-popup"
    @update:visible="handleVisibilityChange"
  >
    <MarkdownContent v-if="popup" :content="popup.content" />
    <template #footer>
      <div class="launcher-popup-footer">
        <NCheckbox v-if="popup?.cacheable" v-model:checked="doNotShowAgain">
          {{ t('launcherPopup.doNotShowAgain') }}
        </NCheckbox>
        <span v-else />
        <NButton :type="popup?.level === 'info' ? 'primary' : 'error'" @click="confirmDismiss">
          {{ t('modal.ok') }}
        </NButton>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton, NCheckbox } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LauncherPopup } from '@/app/runtime/useLauncherPopupQueue'
import Modal, { type ModalType } from '@/components/modals/Modal.vue'
import { MarkdownContent } from '@/components/ui'

defineOptions({ name: 'LauncherPopupModal' })

const props = defineProps<{
  visible: boolean
  popup: LauncherPopup | null
}>()

const emit = defineEmits<{
  (event: 'dismiss', remember: boolean): void
}>()

const { t } = useI18n()
const doNotShowAgain = ref(false)
const modalType = computed<ModalType>(() => (props.popup?.level === 'info' ? 'alert' : 'warning'))

function handleVisibilityChange(visible: boolean): void {
  if (!visible) emit('dismiss', false)
}

function confirmDismiss(): void {
  emit('dismiss', props.popup?.cacheable === true && doNotShowAgain.value)
}

watch(
  () => props.popup?.id,
  () => {
    doNotShowAgain.value = false
  }
)
</script>

<style scoped>
.launcher-popup-footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
</style>
