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
import { pluginNavItems } from '@/composables/usePluginBridge'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const navItems = computed(() => [
  ...pluginNavItems.value,
  { path: '/more/plugins', icon: 'puzzle', label: t('more.nav.plugins') },
  { path: '/more/tools', icon: 'toolbox', label: t('more.nav.tools') },
])

// 语言切换或插件撤销后，当前插件页若已不在可见入口内，回到插件管理页。
watch(pluginNavItems, (items) => {
  if (!route.meta?.pluginRoute) return
  if (!items.some((item) => item.path === route.path)) {
    void router.replace('/more/plugins')
  }
})
</script>
