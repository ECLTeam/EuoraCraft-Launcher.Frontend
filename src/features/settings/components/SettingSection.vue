<template>
  <section class="settings-section ecl-surface" data-theme-component="settings-section">
    <div class="settings-section__header">
      <UiIcon :name="icon" :size="16" />
      <span>{{ title }}</span>
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
import UiIcon from '@/components/ui/Icon.vue'

withDefaults(
  defineProps<{
    title: string
    icon?: string
  }>(),
  { icon: 'settings' }
)
</script>

<style scoped>
.settings-section {
  overflow: hidden;
  margin-bottom: 16px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section__header {
  display: flex;
  align-items: center;
  gap: var(--s-sm);
  padding: 13px 16px;
  border-bottom: 1px solid var(--ecl-border);
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 650;
}

.settings-section__header .icon {
  flex-shrink: 0;
  color: var(--primary);
}
</style>
