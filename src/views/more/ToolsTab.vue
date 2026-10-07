<template>
  <div class="tools-page workspace-page">
    <section class="tools-workspace workspace-shell">
      <div class="tools-scroll-area workspace-scroll-area">
        <div class="tools-layout">
          <div class="tools-grid">
            <CustomDownloadCard />
            <SkinAvatarToolCard />
            <NatToolCard />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import CustomDownloadCard from '@/components/tools/CustomDownloadCard.vue'
import NatToolCard from '@/components/tools/NatToolCard.vue'
import SkinAvatarToolCard from '@/components/tools/SkinAvatarToolCard.vue'
</script>

<style scoped src="@/styles/views/Tools.css"></style>

<style scoped src="@/styles/views/Workspace.css"></style>
