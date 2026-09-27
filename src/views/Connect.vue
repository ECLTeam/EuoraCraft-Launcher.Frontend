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
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useConnector } from '@/features/connect/composables/useConnector'
import { provideConnector } from '@/features/connect/connectorContext'

const { t } = useI18n()
const message = useLauncherMessage()

// 连接状态由外壳持有：子页切换时外壳不重挂，轮询与房间状态才能延续
provideConnector(useConnector({ onError: (error) => message.error(error) }))

const navItems = computed(() => [
  { path: '/more/room', icon: 'wifi', label: t('connect.nav.room') },
  { path: '/more/plugins', icon: 'puzzle', label: t('connect.nav.plugins') },
  { path: '/more/tools', icon: 'activity', label: t('connect.nav.tools') },
])
</script>
