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
    <nav class="sidebar-nav">
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

    <!-- 底部 -->
    <div class="sidebar-footer">
      <button
        v-if="isDevMode"
        class="sidebar-item"
        :class="{ active: route.path === '/dev' }"
        :title="isCollapsed ? t('sidebar.debug') : t('sidebar.debugTitle')"
        @click.prevent="handleItemClick({ path: '/dev' })"
      >
        <span class="sidebar-item-icon">
          <UiIcon name="bug" :size="20" />
        </span>
        <span class="sidebar-item-text">{{ t('sidebar.debug') }}</span>
      </button>
      <button
        class="sidebar-item"
        :title="isCollapsed ? t('sidebar.help') : undefined"
        @click.prevent="handleHelpClick"
      >
        <span class="sidebar-item-icon">
          <UiIcon name="file-text" :size="20" />
        </span>
        <span class="sidebar-item-text">{{ t('sidebar.help') }}</span>
      </button>
    </div>
  </aside>

  <!-- 移动端遮罩 -->
  <div class="sidebar-overlay" @click="isExpanded = false"></div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import UiIcon from '@/components/ui/Icon.vue'
import { useFullscreenModal } from '@/composables/useFullscreenModal'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { pluginRoutes } from '@/composables/usePluginBridge'
import { useTheme } from '@/composables/useTheme'
import { useTopNav } from '@/composables/useTopNav'
import { URLS } from '@/config/urls'
import { MENU_ITEMS } from '@/constants/menu'
import { pluginHostApi } from '@/features/plugins/api/pluginHostApi'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { setSidebarState } from '@/plugin-sdk/state'
import { openExternalUrl } from '@/utils/openExternal'

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

const indicatorRef = ref<HTMLElement | null>(null)
const activeBgRef = ref<HTMLElement | null>(null)

const agreementAccepted = inject(
  'agreementAccepted',
  computed(() => true)
)
const injectedDevMode = inject<Readonly<Ref<boolean>>>('devMode')
const isDevMode = computed(() => injectedDevMode?.value ?? false)

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

const handleHelpClick = () => {
  if (!canNavigate()) return
  openExternalUrl(URLS.docs)
}

/** 通过实际 DOM 测量获取目标菜单项位置并更新指示器 */
const updateActivePosition = (targetPath: string) => {
  // 折叠态同样定位这个胶囊：两态共用同一个元素，位置始终由激活项决定。
  nextTick(() => {
    const navEl = indicatorRef.value?.parentElement
    const targetEl = navEl?.querySelector(`.sidebar-item[data-path="${targetPath}"]`) as HTMLElement | null
    if (!targetEl || !indicatorRef.value || !activeBgRef.value) return
    const top = targetEl.offsetTop
    const height = targetEl.offsetHeight
    // 激活背景块：隐藏状态先无过渡定位到目标再显示，避免从旧位置滑过来
    const hidden = !activeBgRef.value.style.opacity || activeBgRef.value.style.opacity === '0'
    if (hidden) {
      activeBgRef.value.style.transition = 'none'
      activeBgRef.value.style.top = `${top}px`
      activeBgRef.value.style.height = `${height}px`
      void activeBgRef.value.offsetHeight
      activeBgRef.value.style.transition = ''
      activeBgRef.value.style.opacity = '1'
    } else {
      activeBgRef.value.style.top = `${top}px`
      activeBgRef.value.style.height = `${height}px`
      activeBgRef.value.style.opacity = '1'
    }
    indicatorRef.value.style.top = `${top + 9}px`
    indicatorRef.value.style.height = `${height - 18}px`
    indicatorRef.value.style.opacity = '1'
  })
}

const updateIndicator = (targetPath: string) => updateActivePosition(targetPath)
const updateActiveBg = (targetPath: string) => updateActivePosition(targetPath)

const getActivePath = (): string => {
  const path = route.path
  // 子菜单项命中 → 返回父菜单 path（父项始终可见，激活胶囊定位到父项）
  for (const parentPath of Object.keys(subItemsMap.value)) {
    const sub = subItemsMap.value[parentPath]?.find((s) => s.path === path)
    if (sub) return parentPath
  }
  // 精确匹配父菜单项
  const exact = menuItems.value.find((item) => item.path === path)
  if (exact) return exact.path
  // 前缀匹配父菜单项
  if (path !== '/') {
    const prefix = menuItems.value.find((item) => item.path !== '/' && path.startsWith(item.path))
    if (prefix) return prefix.path
  }
  return ''
}

watch(
  () => route.path,
  () => {
    nextTick(() => {
      const activePath = getActivePath()
      if (activePath) {
        updateIndicator(activePath)
        updateActiveBg(activePath)
      } else {
        if (indicatorRef.value) indicatorRef.value.style.opacity = '0'
        if (activeBgRef.value) activeBgRef.value.style.opacity = '0'
      }
    })
  },
  { immediate: true }
)

// 子菜单展开/折叠时重新计算指示器位置
watch(
  () => [...expandedMenus.value],
  () => {
    nextTick(() => {
      const activePath = getActivePath()
      if (activePath) {
        updateIndicator(activePath)
        updateActiveBg(activePath)
      }
    })
  },
  { deep: true }
)

/**
 * 折叠与展开切换后重新定位胶囊。
 *
 * 折叠态与展开态共用同一个浮动胶囊；切换时菜单项的文字、插件项与子菜单会增减，
 * 激活项自身的 offsetTop/offsetHeight 随之变化。展开态还要等文字宽度过渡结束再测量，
 * 否则会按过渡中的中间值定位。
 */
watch(isCollapsed, (collapsed) => {
  const activePath = getActivePath()
  if (!activePath) return
  updateIndicator(activePath)
  updateActiveBg(activePath)
  if (!collapsed) {
    // 文字与插件项在宽度过渡结束后才回到最终布局，过渡完成后补一次精确定位。
    window.setTimeout(() => {
      updateIndicator(activePath)
      updateActiveBg(activePath)
    }, 200)
  }
})

onMounted(() => {
  const activePath = getActivePath()
  if (activePath) {
    setTimeout(() => {
      updateIndicator(activePath)
      updateActiveBg(activePath)
    }, 100)
  }
})
</script>

<style scoped src="@/styles/components/layout/SideBar.css"></style>
