<template>
  <SectionLayout :title="t('sidebar.more')" icon="more" :items="navItems">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </SectionLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionLayout from '@/components/layout/SectionLayout.vue'
import { useConnector } from '@/features/connect/composables/useConnector'
import { provideConnector } from '@/features/connect/connectorContext'

const { t } = useI18n()

// 外壳只提供应用会话，联机页首次进入时才初始化。
provideConnector(useConnector())

const navItems = computed(() => [
  { path: '/more/room', icon: 'wifi', label: t('more.nav.room') },
  { path: '/more/plugins', icon: 'puzzle', label: t('more.nav.plugins') },
  { path: '/more/tools', icon: 'toolbox', label: t('more.nav.tools') },
])
</script>
