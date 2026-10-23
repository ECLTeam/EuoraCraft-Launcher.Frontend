import { h, type Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router'
import { pinia } from '@/app/stores'
import { useLayoutStore } from '@/app/stores/layoutStore'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import { i18n, isSimplifiedChinese } from '@/i18n'

type LazyComponent = () => Promise<{ default: Component }>

// 联机只面向简体中文用户：其他语言进入更多页时落到插件页，并拒绝直达房间页。
const connectorFallbackPath = '/more/plugins'

/**
 * 判断当前界面语言是否提供联机入口。
 * @returns 简体中文界面为 true
 */
export function isConnectorRouteAvailable(): boolean {
  return isSimplifiedChinese(i18n.global.locale.value)
}

/**
 * 解析更多页的默认子页，供 /more 重定向使用。
 * @returns 简体中文进入联机页，其他语言进入插件页
 */
export function moreDefaultPath(): string {
  return isConnectorRouteAvailable() ? '/more/room' : connectorFallbackPath
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
    component: withErrorBoundary(() => import('@/views/More.vue')),
    redirect: () => moreDefaultPath(),
    children: [
      {
        path: 'room',
        name: 'more-room',
        component: () => import('@/views/connect/ConnectRoomTab.vue'),
        beforeEnter: () => isConnectorRouteAvailable() || connectorFallbackPath,
      },
      { path: 'plugins', name: 'more-plugins', component: withErrorBoundary(() => import('@/views/Plugins.vue')) },
      { path: 'tools', name: 'more-tools', component: () => import('@/views/more/ToolsTab.vue') },
    ],
  },
  { path: '/download', name: 'download', component: withErrorBoundary(() => import('@/views/Download.vue')) },
  {
    path: '/settings',
    component: withErrorBoundary(() => import('@/views/Settings.vue')),
    redirect: '/settings/launcher',
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

export default router
