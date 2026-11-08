import { h, type Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router'
import { recallSectionPath, rememberSectionPath } from '@/app/runtime/sectionMemory'
import { pinia } from '@/app/stores'
import { useLayoutStore } from '@/app/stores/layoutStore'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

type LazyComponent = () => Promise<{ default: Component }>

/**
 * 解析更多页的默认子页，供 /more 重定向使用。
 * @returns 进入插件管理页
 */
export function moreDefaultPath(): string {
  return '/more/plugins'
}

/**
 * 解析更多页的入口子页面：优先回到上次停留的子页面。
 * @returns 记忆中的子页面，未记录时为该语言下的默认子页面
 */
export function moreEntryPath(): string {
  return recallSectionPath('/more', moreDefaultPath())
}

/**
 * 解析设置页的入口子页面：优先回到上次停留的子页面。
 * @returns 记忆中的子页面，未记录时为启动器设置
 */
export function settingsEntryPath(): string {
  return recallSectionPath('/settings', '/settings/launcher')
}

// 用错误边界包裹懒加载页面，页面渲染出错时显示降级提示而非白屏
function withErrorBoundary(loader: LazyComponent): () => Promise<RouteComponent> {
  return async () => {
    const mod = await loader()
    return {
      render: () => h(ErrorBoundary, null, { default: () => h(mod.default) }),
    }
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'game', component: withErrorBoundary(() => import('@/views/Game.vue')) },
  {
    path: '/versions',
    name: 'versions-manage',
    component: withErrorBoundary(() => import('@/views/Instances.vue')),
  },
  {
    path: '/more',
    name: 'more',
    component: withErrorBoundary(() => import('@/views/More.vue')),
    redirect: () => moreEntryPath(),
    children: [
      { path: 'plugins', name: 'more-plugins', component: withErrorBoundary(() => import('@/views/Plugins.vue')) },
      { path: 'tools', name: 'more-tools', component: () => import('@/views/more/ToolsTab.vue') },
    ],
  },
  { path: '/download', name: 'download', component: withErrorBoundary(() => import('@/views/Download.vue')) },
  {
    path: '/settings',
    component: withErrorBoundary(() => import('@/views/Settings.vue')),
    redirect: () => settingsEntryPath(),
    children: [
      { path: 'general', name: 'settings-general', redirect: '/settings/launcher' },
      {
        path: 'appearance',
        name: 'settings-appearance',
        component: () => import('@/views/settings/AppearanceTab.vue'),
      },
      {
        path: 'launcher',
        name: 'settings-launcher',
        component: () => import('@/views/settings/LauncherTab.vue'),
      },
      { path: 'game', name: 'settings-game', component: () => import('@/views/settings/GameTab.vue') },
      { path: 'java', name: 'settings-java', component: () => import('@/views/settings/JavaTab.vue') },
      { path: 'about', name: 'settings-about', component: () => import('@/views/settings/AboutTab.vue') },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({ history: createWebHashHistory(), routes })

// 路由切换前重置弹窗遗留的页面过渡状态（通过 layoutStore 状态驱动，不直接操作 DOM）
router.beforeEach(() => {
  useLayoutStore(pinia).resetTransientState()
})

// 记录分区最近停留的子页面：再次点击「设置」「更多」时回到该子页面
router.afterEach((to) => {
  const sectionRecord = to.matched[0]
  if (!sectionRecord || to.matched.length < 2) return
  rememberSectionPath(sectionRecord.path, to.path)
})

export default router
