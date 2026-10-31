/*
 * EuoraCraft Launcher
 * ECLTeam © 2026 GPL-3.0 License
 * https://github.com/ECLTeam/EuoraCraft-Launcher
 * 文件作用：初始化前端服务、主题和语言，并挂载启动器界面。
 */
import { VueQueryPlugin } from '@tanstack/vue-query'
import { create as createNaiveUI } from 'naive-ui'
import { createApp } from 'vue'
import AppProviders from '@/app/AppProviders.vue'
import { queryClient } from '@/app/queryClient'
import { detectActiveWindowChrome } from '@/app/runtime/windowChrome'
import { pinia } from '@/app/stores'
import { initTheme } from '@/composables/useTheme'
import { i18n, getCurrentLocale, loadLocaleFromBackend } from '@/i18n'
import router from '@/router'
import { installFrontendLogging } from '@/utils/frontendLogger'
import UiIcon from './components/ui/Icon.vue'
import '@/styles/main.css'
import '@/styles/components/ui/LauncherMessage.css'

// 尽早安装 console 拦截器，把前端运行日志通过 IPC 上报给后端统一归档
installFrontendLogging()

// 快速初始化主题（从本地存储），避免白屏闪烁
// 后端配置将在 App.vue 挂载后加载并覆盖
initTheme()
document.documentElement.setAttribute('lang', getCurrentLocale())

// 尝试从后端加载语言配置（非阻塞）
loadLocaleFromBackend().catch(() => {})

const naive = createNaiveUI()
const app = createApp(AppProviders)
app.use(pinia)
app.use(VueQueryPlugin, { queryClient })
app.use(router)
app.use(naive)
app.use(i18n)
app.component('UiIcon', UiIcon)
void detectActiveWindowChrome().then(() => app.mount('#app'))
