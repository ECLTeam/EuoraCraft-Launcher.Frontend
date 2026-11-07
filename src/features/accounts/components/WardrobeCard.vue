<template>
  <div class="wardrobe-card" :class="{ selected }">
    <button
      class="wardrobe-card-preview"
      type="button"
      :title="name"
      :aria-label="name"
      :aria-describedby="detail || $slots.status ? detailId : undefined"
      :aria-pressed="selected"
      :disabled="disabled"
      @click="emit('select')"
    >
      <img v-if="imageUrl && !imageFailed" :src="imageUrl" alt="" @error="imageFailed = true" />
      <span v-else class="wardrobe-card-placeholder"><UiIcon :name="placeholder" :size="28" /></span>
      <strong>{{ name }}</strong>
      <span v-if="detail || $slots.status" :id="detailId" class="wardrobe-card-detail"
        ><slot name="status">{{ detail }}</slot></span
      >
    </button>
    <slot name="accessory" />
    <div class="wardrobe-card-actions"><slot name="actions" /></div>
  </div>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import UiIcon from '@/components/ui/Icon.vue'

const props = defineProps<{
  name: string
  imageUrl?: string
  placeholder: string
  detail?: string
  selected: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const detailId = useId()
const imageFailed = ref(false)
watch(
  () => props.imageUrl,
  () => (imageFailed.value = false)
)
</script>

<style scoped>
.wardrobe-card {
  position: relative;
  min-width: 0;
  border: 1px solid var(--divider);
  border-radius: var(--r-md);
  color: var(--text-primary);
  background: var(--bg-card);
}

.wardrobe-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.wardrobe-card-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-xs);
  width: 100%;
  height: 100%;
  padding: var(--s-sm) var(--s-sm) 34px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.wardrobe-card-preview:focus-visible {
  outline: 2px solid var(--ecl-primary);
  outline-offset: -2px;
}

.wardrobe-card-preview:disabled {
  cursor: default;
}

.wardrobe-card-actions {
  position: absolute;
  right: 6px;
  bottom: 5px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.wardrobe-card img,
.wardrobe-card-placeholder {
  width: 88px;
  height: 88px;
  max-width: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.wardrobe-card-placeholder {
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.wardrobe-card strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wardrobe-card-detail {
  display: flex;
  align-items: center;
  min-height: var(--s-xl);
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
