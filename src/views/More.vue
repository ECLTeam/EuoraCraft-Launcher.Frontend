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
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import SectionLayout from '@/components/layout/SectionLayout.vue'
import { useConnector } from '@/features/connect/composables/useConnector'
import { provideConnector } from '@/features/connect/connectorContext'
import { isSimplifiedChinese } from '@/i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

// 外壳只提供应用会话，联机页首次进入时才初始化。
provideConnector(useConnector())

// 联机只面向简体中文用户，其他语言不展示该子页入口。
const isConnectorAvailable = computed(() => isSimplifiedChinese(locale.value))

const navItems = computed(() => [
  ...(isConnectorAvailable.value ? [{ path: '/more/room', icon: 'wifi', label: t('more.nav.room') }] : []),
  { path: '/more/plugins', icon: 'puzzle', label: t('more.nav.plugins') },
  { path: '/more/tools', icon: 'toolbox', label: t('more.nav.tools') },
])

// 在当前页切换语言时立即离开已隐藏的联机页。
watch(isConnectorAvailable, (available) => {
  if (available || !route.path.startsWith('/more/room')) return
  void router.replace('/more/plugins')
})
</script>
