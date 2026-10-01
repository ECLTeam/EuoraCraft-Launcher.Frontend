<template>
  <div class="ui-empty-state empty-state" role="status">
    <UiIcon :name="icon" :size="42" class="empty-icon" />
    <p class="empty-text">{{ title }}</p>
    <p v-if="description" class="empty-hint">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import UiIcon from './Icon.vue'
withDefaults(defineProps<{ icon?: string; title: string; description?: string }>(), { icon: 'cube', description: '' })
</script>

<style scoped>
.ui-empty-state {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  text-align: center;
  color: var(--ecl-text-secondary);
}
.ui-empty-state p {
  margin: 0;
}
.empty-icon {
  color: var(--ecl-text-tertiary);
}
.empty-text,
.empty-hint {
  margin: 0;
  font-size: 12px;
}
.empty-hint {
  color: var(--ecl-text-tertiary);
  font-size: 10px;
}
</style>
