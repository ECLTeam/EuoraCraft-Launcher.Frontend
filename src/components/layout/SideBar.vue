<template>
  <aside
    class="sidebar"
    data-theme-component="navigation"
    data-theme-node="shell.sidebar"
    :class="{
      collapsed: isCollapsed,
      expanded: isExpanded,
      'modal-hidden': !agreementAccepted || topNavEnabled || isFullscreenModalVisible,
    }"
  >
    <!-- 折叠切换按钮 -->
    <button
      class="sidebar-toggle"
      :title="isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
      @click="toggleCollapse"
    >
      <UiIcon :name="isCollapsed ? 'menu' : 'arrow-left'" :size="18" />
    </button>

    <!-- 导航区域 -->
    <nav ref="navRef" class="sidebar-nav">
      <!-- 插件：侧边栏顶部插槽 -->
      <PluginSlotHost slotId="plugin-slot-sidebar-top" class="plugin-slot-container sidebar-plugin-slot" />
      <!-- 折叠时也保留在 DOM 中（不切换 display，否则会掐断过渡）：
           折叠态与展开态共用这一个胶囊，宽度由 .sidebar.collapsed 侧栏收窄带动。 -->
      <div ref="activeBgRef" class="sidebar-active-bg"></div>
      <div ref="indicatorRef" class="sidebar-active-indicator"></div>

      <template v-for="item in menuItems" :key="item.path">
        <button
          class="sidebar-item"
          :data-path="item.path"
          :class="{
            active: route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path)),
          }"
          :title="isCollapsed ? item.label : undefined"
          @click.prevent="handleItemClick(item)"
        >
          <span class="sidebar-item-icon">
            <UiIcon :name="item.iconName" :size="20" />
          </span>
          <span class="sidebar-item-text">{{ item.label }}</span>
          <span
            v-if="!isCollapsed && itemHasSubItems(item.path)"
            class="sidebar-item-chevron"
            :class="{ expanded: isMenuExpanded(item.path) }"
            @click.stop="toggleMenu(item.path)"
          >
            <UiIcon name="chevron-down" :size="14" />
          </span>
        </button>

        <!-- 子菜单项 -->
        <div
          v-if="!isCollapsed && itemHasSubItems(item.path)"
          :data-parent="item.path"
          class="sidebar-sub-items"
          :class="{ expanded: isMenuExpanded(item.path) }"
        >
          <button
            v-for="sub in getSubItems(item.path)"
            :key="sub.path"
            class="sidebar-item sidebar-sub-item"
            :data-path="sub.path"
            :class="{ active: route.path === sub.path }"
            @click.prevent="handleSubItemClick(sub.path)"
          >
            <span class="sidebar-item-icon">
              <UiIcon :name="sub.iconName" :size="16" />
            </span>
            <span class="sidebar-item-text">{{ sub.label }}</span>
          </button>
        </div>
      </template>

      <!-- 插件注册的导航项 -->
      <template v-if="!isCollapsed">
        <div v-if="pluginRoutesList.length" class="sidebar-plugin-divider"></div>
        <button
          v-for="pRoute in pluginRoutesList"
          :key="'btn-' + pRoute.path"
          class="sidebar-item"
          :data-path="`/plugin/${pRoute.plugin}${pRoute.path}`"
          :class="{ active: route.path === `/plugin/${pRoute.plugin}${pRoute.path}` }"
          @click.prevent="handleSubItemClick(`/plugin/${pRoute.plugin}${pRoute.path}`)"
        >
          <span class="sidebar-item-icon">
            <UiIcon :name="pRoute.icon || 'plugin'" :size="16" />
          </span>
          <span class="sidebar-item-text">{{ pRoute.title }}</span>
        </button>
      </template>
    </nav>

    <!-- 插件：侧边栏底部插槽 -->
    <PluginSlotHost slotId="plugin-slot-sidebar-bottom" class="plugin-slot-container sidebar-plugin-slot" />
  </aside>

  <!-- 移动端遮罩 -->
  <div class="sidebar-overlay" @click="isExpanded = false"></div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import UiIcon from '@/components/ui/Icon.vue'
import { useFullscreenModal } from '@/composables/useFullscreenModal'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { pluginRoutes } from '@/composables/usePluginBridge'
import { useTheme } from '@/composables/useTheme'
import { useTopNav } from '@/composables/useTopNav'
import { MENU_ITEMS } from '@/constants/menu'
import { pluginHostApi } from '@/features/plugins/api/pluginHostApi'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { setSidebarState } from '@/plugin-sdk/state'

defineOptions({ name: 'SideBar', inheritAttrs: false })

const { sidebarCollapsed, setSidebarCollapsed } = useTheme()
const { isVisible: isFullscreenModalVisible } = useFullscreenModal()
const isCollapsed = computed({
  get: () => sidebarCollapsed.value,
  set: (val) => setSidebarCollapsed(val),
})
const isExpanded = ref(false)
const pluginRoutesList = computed(() => pluginRoutes.value)
const route = useRoute()
const router = useRouter()
const message = useLauncherMessage()
const { t } = useI18n()
const { topNavEnabled } = useTopNav()

const navRef = ref<HTMLElement | null>(null)
const indicatorRef = ref<HTMLElement | null>(null)
const activeBgRef = ref<HTMLElement | null>(null)

const agreementAccepted = inject(
  'agreementAccepted',
  computed(() => true)
)

watch(
  isCollapsed,
  (collapsed) => {
    setSidebarState(collapsed)
    void pluginHostApi.notifySidebarState(collapsed).catch((error) => {
      console.error('[SideBar] 通知插件侧栏状态失败:', error)
    })
  },
  { immediate: true }
)

const menuItems = computed(() =>
  MENU_ITEMS.map((item) => ({
    path: item.path,
    label: t(item.labelKey),
    iconName: item.iconName,
  }))
)

// 子菜单定义
const settingsSubItems = computed(() => [
  { path: '/settings/launcher', label: t('settings.launcherSettings'), iconName: 'settings' },
  { path: '/settings/appearance', label: t('settings.appearance'), iconName: 'brush' },
  { path: '/settings/game', label: t('settings.gameSettings'), iconName: 'game' },
  { path: '/settings/about', label: t('settings.about'), iconName: 'info' },
])

interface SubMenuItem {
  path: string
  label: string
  iconName: string
}

const subItemsMap = computed<Record<string, SubMenuItem[]>>(() => ({
  '/settings': settingsSubItems.value,
}))

const itemHasSubItems = (path: string) => {
  return path in subItemsMap.value
}

const getSubItems = (path: string) => {
  return subItemsMap.value[path] || []
}

// 展开/折叠状态
const expandedMenus = ref<Set<string>>(new Set())

const isMenuExpanded = (path: string) => {
  return expandedMenus.value.has(path)
}

const toggleMenu = (path: string) => {
  const newSet = new Set(expandedMenus.value)
  if (newSet.has(path)) {
    newSet.delete(path)
  } else {
    newSet.add(path)
  }
  expandedMenus.value = newSet
}

const handleItemClick = (item: { path: string }) => {
  if (!canNavigate()) return
  if (itemHasSubItems(item.path)) {
    toggleMenu(item.path)
  }
  router.push(item.path).catch(() => {})
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

watch(
  isExpanded,
  (val) => {
    if (val) {
      document.body.classList.add('sidebar-expanded')
    } else {
      document.body.classList.remove('sidebar-expanded')
    }
  },
  { immediate: true }
)

const canNavigate = () => {
  if (!agreementAccepted.value) {
    message.warning(t('agreement.acceptRequired'))
    return false
  }
  return true
}

const handleSubItemClick = (path: string) => {
  if (!canNavigate()) return
  router.push(path)
}

/** 找到当前可见的导航项；子页面沿用其所属父项。 */
const getActivePath = (): string => {
  const path = route.path
  const exact = menuItems.value.find((item) => item.path === path)
  if (exact) return exact.path
  const parent = menuItems.value.find((item) => item.path !== '/' && path.startsWith(`${item.path}/`))
  if (parent) return parent.path
  if (!isCollapsed.value) {
    const plugin = pluginRoutesList.value.find((item) => path === `/plugin/${item.plugin}${item.path}`)
    if (plugin) return path
  }
  return ''
}

let resizeObserver: ResizeObserver | undefined
let mutationObserver: MutationObserver | undefined
let disposed = false

const updateActivePosition = () => {
  const nav = navRef.value
  const background = activeBgRef.value
  const indicator = indicatorRef.value
  if (!nav || !background || !indicator || disposed) return
  const path = getActivePath()
  const target = Array.from(nav.querySelectorAll<HTMLElement>('.sidebar-item[data-path]')).find(
    (item) => item.dataset.path === path
  )
  if (!target) {
    background.style.opacity = '0'
    indicator.style.opacity = '0'
    return
  }

  const hidden = background.style.opacity !== '1'
  if (hidden) {
    background.style.transition = 'none'
    indicator.style.transition = 'none'
  }
  background.style.top = `${target.offsetTop}px`
  background.style.height = `${target.offsetHeight}px`
  indicator.style.top = `${target.offsetTop + 9}px`
  indicator.style.height = `${Math.max(0, target.offsetHeight - 18)}px`
  if (hidden) {
    void background.offsetHeight
    background.style.transition = ''
    indicator.style.transition = ''
  }
  background.style.opacity = '1'
  indicator.style.opacity = '1'
}

const schedulePositionUpdate = () => {
  void nextTick(updateActivePosition)
}

watch([() => route.path, isCollapsed, pluginRoutesList, expandedMenus], schedulePositionUpdate, { flush: 'post' })

onMounted(() => {
  const nav = navRef.value
  if (!nav) return
  const observeLayout = () => {
    resizeObserver?.disconnect()
    resizeObserver?.observe(nav)
    for (const child of Array.from(nav.children)) {
      if (child !== activeBgRef.value && child !== indicatorRef.value) resizeObserver?.observe(child)
    }
    schedulePositionUpdate()
  }
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(schedulePositionUpdate)
  mutationObserver = new MutationObserver(observeLayout)
  mutationObserver.observe(nav, { childList: true, subtree: true, characterData: true })
  observeLayout()
  window.addEventListener('resize', schedulePositionUpdate)
})

onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  window.removeEventListener('resize', schedulePositionUpdate)
})
</script>

<style scoped src="@/styles/components/layout/SideBar.css"></style>
