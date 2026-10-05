<template>
  <div class="tools-page workspace-page">
    <section class="tools-workspace workspace-shell">
      <div class="tools-scroll-area workspace-scroll-area">
        <div class="tools-layout">
          <PageHeader :title="t('tools.title')" icon="toolbox" />
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
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/layout/PageHeader.vue'
import CustomDownloadCard from '@/components/tools/CustomDownloadCard.vue'
import NatToolCard from '@/components/tools/NatToolCard.vue'
import SkinAvatarToolCard from '@/components/tools/SkinAvatarToolCard.vue'

const { t } = useI18n()
</script>

<style scoped src="@/styles/views/Tools.css"></style>

<style scoped src="@/styles/views/Workspace.css"></style>
