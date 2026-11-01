<template>
  <div class="collapsible-panel" :class="{ 'is-open': open }" :inert="!open || undefined">
    <div class="collapsible-panel__inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'CollapsiblePanel' })

defineProps<{ open: boolean }>()
</script>

<style src="@/styles/components/ui/CollapsiblePanel.css"></style>
