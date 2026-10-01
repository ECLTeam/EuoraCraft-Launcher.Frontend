<template>
  <Modal
    :visible="visible"
    type="confirm"
    :title="title"
    :danger="danger"
    :closable="!loading"
    :showCloseBtn="!loading"
    :priority="priority"
    :parentId="parentId"
    @update:visible="updateVisible"
  >
    <slot>
      <p class="confirm-dialog-content">{{ content }}</p>
    </slot>

    <template #footer>
      <NButton :disabled="loading" @click="cancel">
        {{ cancelText || t('modal.cancel') }}
      </NButton>
      <NButton
        :type="danger ? 'error' : 'primary'"
        :loading="loading"
        :disabled="loading || confirmDisabled"
        @click="confirm"
      >
        {{ confirmText || t('modal.confirm') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title: string
    content?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
    loading?: boolean
    confirmDisabled?: boolean
    closeOnConfirm?: boolean
    priority?: number
    parentId?: string | null
  }>(),
  {
    content: '',
    confirmText: '',
    cancelText: '',
    danger: false,
    loading: false,
    confirmDisabled: false,
    closeOnConfirm: true,
    priority: undefined,
    parentId: undefined,
  }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
  cancel: []
}>()

const { t } = useI18n()

function updateVisible(value: boolean) {
  if (!props.loading) emit('update:visible', value)
}

function cancel() {
  if (props.loading) return
  emit('cancel')
  emit('update:visible', false)
}

function confirm() {
  if (props.loading || props.confirmDisabled) return
  emit('confirm')
  if (props.closeOnConfirm) emit('update:visible', false)
}
</script>

<style scoped>
.confirm-dialog-content {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
</style>
