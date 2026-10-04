<template>
  <div class="connect-page connect-tools-page">
    <section class="connect-workspace">
      <div class="connect-scroll-area">
        <div class="connect-tools-layout">
          <PageHeader :title="t('connect.nav.tools')" icon="toolbox" />
          <div class="connect-tools-grid">
            <CustomDownloadCard />
            <NatToolCard />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CustomDownloadCard from '@/components/connect/CustomDownloadCard.vue'
import NatToolCard from '@/components/connect/NatToolCard.vue'
import PageHeader from '@/components/layout/PageHeader.vue'

const { t } = useI18n()
</script>

<style scoped src="@/styles/views/Connect.css"></style>
