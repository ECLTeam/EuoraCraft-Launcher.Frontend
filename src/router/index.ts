import { h, type Component } from 'vue'
import { createRouter, createWebHashHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router'
import { pinia } from '@/app/stores'
import { useLayoutStore } from '@/app/stores/layoutStore'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

type LazyComponent = () => Promise<{ default: Component }>

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
    component: withErrorBoundary(() => import('@/views/Connect.vue')),
    redirect: '/more/room',
    children: [
      { path: 'room', name: 'more-room', component: () => import('@/views/connect/ConnectRoomTab.vue') },
      { path: 'tools', name: 'more-tools', component: () => import('@/views/connect/ConnectToolsTab.vue') },
    ],
  },
  { path: '/download', name: 'download', component: withErrorBoundary(() => import('@/views/Download.vue')) },
  { path: '/plugins', name: 'plugins', component: withErrorBoundary(() => import('@/views/Plugins.vue')) },
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
      { path: 'about', name: 'settings-about', component: () => import('@/views/settings/AboutTab.vue') },
    ],
  },
  {
    path: '/dev',
    name: 'dev',
    component: withErrorBoundary(() => import('@/views/DevTools.vue')),
    meta: { devOnly: true },
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
