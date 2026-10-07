<template>
  <header
    class="titlebar"
    :class="{ 'titlebar--native': nativeChrome }"
    data-theme-component="titlebar"
    data-theme-node="shell.titlebar"
    @mousedown="handleDragStart"
  >
    <!-- 左侧 -->
    <div class="titlebar-left">
      <template v-if="isFullscreenModalVisible">
        <button
          class="titlebar-back-btn"
          :title="t('common.back')"
          :disabled="!fullscreenModal.canClose.value"
          @click="handleClose"
        >
          <UiIcon name="arrow-left" :size="18" />
        </button>
        <span class="titlebar-modal-title">{{ fullscreenModalTitle }}</span>
      </template>
      <template v-else>
        <div class="titlebar-brand">
          <img v-if="!nativeChrome" src="/favicon.ico" alt="Logo" class="titlebar-logo" />
          <span v-if="!nativeChrome" class="titlebar-app-name">{{
            topNavEnabled ? 'ECL' : 'EuoraCraft Launcher'
          }}</span>
          <span
            v-if="isDevMode"
            class="titlebar-mode-badge titlebar-mode-badge--dev"
            title="开发模式：Vite 开发构建"
            aria-label="开发模式"
          >
            DEV
          </span>
          <span
            v-if="isDebugMode"
            class="titlebar-mode-badge titlebar-mode-badge--debug"
            title="调试模式：启动器已开启调试"
            aria-label="调试模式"
          >
            DEBUG
          </span>
          <span
            v-if="isShowcaseMode"
            class="titlebar-mode-badge"
            title="展示模式使用本地演示数据，不连接后端"
            aria-label="展示模式：使用本地演示数据，不连接后端"
          >
            SHOWCASE
          </span>
          <span
            v-if="releaseChannelLabel"
            class="titlebar-mode-badge"
            :class="`titlebar-mode-badge--${releaseChannelType}`"
            :title="`${releaseChannelLabel} 预发布版本`"
            :aria-label="`${releaseChannelLabel} 预发布版本`"
          >
            {{ releaseChannelLabel }}
          </span>
        </div>
        <PluginSlotHost slotId="plugin-slot-titlebar-left" class="plugin-slot-container" />
      </template>
    </div>

    <!-- 中间拖拽区 -->
    <div class="titlebar-center"></div>

    <!-- 顶部导航菜单（横向标题栏模式，绝对定位居中）：所有皮肤统一 NTabs 分段控件，对齐参考项目 TitleBar -->
    <nav v-if="topNavEnabled && !isFullscreenModalVisible" class="titlebar-nav">
      <NTabs :value="activeNavPath" type="segment" size="small" @update:value="handleNavTabChange">
        <NTab v-for="item in menuItems" :key="item.path" :name="item.path">
          <UiIcon :name="item.iconName" :size="16" />
          <span>{{ item.label }}</span>
        </NTab>
      </NTabs>
    </nav>

    <!-- 右侧窗口控制 -->
    <div class="titlebar-right">
      <PluginSlotHost slotId="plugin-slot-titlebar-right" class="plugin-slot-container" />
      <TitleBarTray />
      <button class="titlebar-btn titlebar-btn-task" :title="t('task.title')" @click="toggleTaskPanel">
        <UiIcon name="download" :size="16" />
        <span v-if="activeTaskCount > 0" class="task-badge">{{ activeTaskCount > 99 ? '99+' : activeTaskCount }}</span>
      </button>
      <button
        class="titlebar-btn"
        :title="isDark ? t('settings.themeLight') : t('settings.themeDark')"
        @click="toggleTheme"
      >
        <UiIcon :name="isDark ? 'moon' : 'sun'" :size="16" />
      </button>
      <button
        v-if="isDesktopMode && !nativeChrome"
        class="titlebar-btn"
        :title="t('common.minimize')"
        @click="minimize"
      >
        <UiIcon name="minimize" :size="16" />
      </button>
      <button
        v-if="isDesktopMode && !nativeChrome"
        class="titlebar-btn titlebar-btn-close"
        :title="t('common.close')"
        @click="close"
      >
        <UiIcon name="close" :size="16" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { NTab, NTabs } from 'naive-ui'
import { computed, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import backend from '@/api/client'
import { desktopWindow } from '@/app/runtime/desktopWindow'
import TitleBarTray from '@/components/layout/TitleBarTray.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useFullscreenModal } from '@/composables/useFullscreenModal'
import { globalTaskQueue } from '@/composables/useTaskQueue'
import { useTheme } from '@/composables/useTheme'
import { useTopNav } from '@/composables/useTopNav'
import { MENU_ITEMS } from '@/constants/menu'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { titlebarVersionChannelLabel } from './titlebarVersionChannel'

defineOptions({ name: 'TitleBar' })
const { nativeChrome = false } = defineProps<{ nativeChrome?: boolean }>()

const { t } = useI18n()
const { isDark, toggleTheme } = useTheme()
const { topNavEnabled } = useTopNav()
const fullscreenModal = useFullscreenModal()
const route = useRoute()
const router = useRouter()

const { activeCount: activeTaskCount, togglePanel: toggleTaskPanel } = globalTaskQueue

const isFullscreenModalVisible = computed(() => fullscreenModal.isVisible.value)
const fullscreenModalTitle = computed(() => fullscreenModal.title.value)
const isDesktopMode = backend.runtime.isDesktop
const isShowcaseMode = backend.runtime.isShowcase
const isDevMode = import.meta.env.DEV
const injectedDevMode = inject<Readonly<Ref<boolean>>>('devMode')
const injectedLauncherVersionType = inject<Readonly<Ref<'alpha' | 'beta' | 'rc' | 'release'>>>('launcherVersionType')
const isDebugMode = computed(() => injectedDevMode?.value ?? false)
const releaseChannelType = computed(() => injectedLauncherVersionType?.value ?? 'release')
const releaseChannelLabel = computed(() => titlebarVersionChannelLabel(releaseChannelType.value))

const menuItems = computed(() =>
  MENU_ITEMS.map((item) => ({
    path: item.path,
    label: t(item.labelKey),
    iconName: item.iconName,
  }))
)

const activeNavPath = computed(() => {
  const path = route.path
  const item = menuItems.value.find(
    (candidate) => path === candidate.path || (candidate.path !== '/' && path.startsWith(candidate.path))
  )
  return item?.path ?? (path === '/' ? '/' : '')
})

const handleNavTabChange = (path: string) => {
  router.push(path)
}

const minimize = async () => {
  await desktopWindow.minimize()
}
const close = async () => {
  await desktopWindow.close()
}
const handleClose = () => fullscreenModal.close()

/** 仅使用 Tauri 原生 startDragging API，避免平台特定的 CSS 拖拽区域冲突。 */
const handleDragStart = (e: MouseEvent) => {
  if (nativeChrome) return
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (
    target.closest(
      '.titlebar-nav, [data-no-drag], button, a, input, textarea, select, [contenteditable="true"], [role="button"]'
    )
  ) {
    return
  }
  if (
    target.closest('.vue-devtools__anchor') ||
    target.closest('.vue-devtools__anchor-btn') ||
    target.closest('.vue-inspector-container') ||
    target.closest('.VueDevTools__toggle-button')
  )
    return
  desktopWindow.startDragging()
}
</script>

<style scoped src="@/styles/components/layout/TitleBar.css"></style>
