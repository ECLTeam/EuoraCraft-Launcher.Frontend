<template>
  <div class="tab-pane java-settings">
    <UiCard class="java-settings-card" bodyClass="java-settings-card-body">
      <JavaManagerPanel />
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import UiCard from '@/components/ui/Card.vue'
import JavaManagerPanel from '@/features/java/components/JavaManagerPanel.vue'
</script>

<style scoped src="@/styles/views/settings/JavaTab.css"></style>
