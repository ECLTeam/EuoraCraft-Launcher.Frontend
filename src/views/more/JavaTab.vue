<template>
  <div class="java-page ecl-page">
    <section class="java-panel ecl-surface ecl-page__body">
      <JavaManagerPanel />
    </section>
  </div>
</template>

<script setup lang="ts">
import JavaManagerPanel from '@/features/java/components/JavaManagerPanel.vue'
</script>

<style scoped src="@/styles/views/JavaTab.css"></style>
