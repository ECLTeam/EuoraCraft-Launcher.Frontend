<template>
  <div
    class="ui-card"
    :class="{ hoverable: hoverable, interactive: isInteractive }"
    :role="isInteractive ? 'button' : undefined"
    :tabindex="isInteractive ? 0 : undefined"
    data-theme-component="card"
    :data-theme-node="themeNode"
    :data-theme-instance="themeInstance"
    @keydown="handleKeydown"
  >
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <div class="header-content">
          <UiIcon v-if="icon" :name="icon.replace('icon-', '')" :size="16" />
          <span class="title-text">{{ title }}</span>
        </div>
        <div v-if="$slots.actions" class="header-actions">
          <slot name="actions" />
        </div>
      </slot>
    </div>

    <div class="card-body" :class="bodyClass">
      <slot />
    </div>

    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from '@/components/ui/Icon.vue'

defineOptions({ name: 'UiCard' })

const props = withDefaults(
  defineProps<{
    title?: string
    icon?: string
    hoverable?: boolean
    interactive?: boolean
    bodyClass?: string
    /** 设计器使用的稳定页面节点 ID。 */
    themeNode?: string
    /** 数据实例本机覆盖使用的稳定散列 key。 */
    themeInstance?: string
  }>(),
  { title: '', icon: 'cube', bodyClass: '', themeNode: undefined, themeInstance: undefined }
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const isInteractive = computed(() => props.interactive || false)

const handleKeydown = (event: KeyboardEvent) => {
  if (!isInteractive.value) return

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('click', event as unknown as MouseEvent)
  }
}
</script>

<style scoped src="@/styles/components/ui/Card.css"></style>
