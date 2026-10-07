/* eslint-disable vue/one-component-per-file -- 动态工厂按需 createApp 生成组件，单文件多组件属必要设计 */
import DOMPurify from 'dompurify'
import { compile, createApp, defineComponent, h, ref } from 'vue'
import { invalidatePluginRegistry, pluginRegistryQuery } from '@/app/data'
import { pluginHostApi } from '@/features/plugins/api/pluginHostApi'
import * as api from '@/plugin-sdk/api'
import * as component from '@/plugin-sdk/component'
import '@/plugin-sdk/styles/plugin-base.css'
import { setActiveContext } from '@/plugin-sdk/context'
import * as dom from '@/plugin-sdk/dom'
import { listen, unlisten, cleanup as cleanupEvents, once, Events } from '@/plugin-sdk/events'
import { createHooks, runPluginCleanup } from '@/plugin-sdk/hooks'
import * as router from '@/plugin-sdk/router'
import {
  initPluginState,
  getThemeState,
  getLauncherState,
  getAccountState,
  getSidebarState,
  refreshTheme,
  refreshLauncher,
  refreshAccounts,
  watchTheme,
  watchLauncher,
  watchAccount,
  watchSidebar,
} from '@/plugin-sdk/state'
import { getToken, watchToken, getMode, watchMode } from '@/plugin-sdk/theme'
import { transpileTS } from '@/plugin-sdk/transpile'
import type { PluginSdkContext } from '@/plugin-sdk/types'
import * as ui from '@/plugin-sdk/ui'
import * as widgets from '@/plugin-sdk/widgets'
import type { PluginRoute, PluginSlotItem, VueComponentDef, VueSlotItem } from '@/types/plugins'
import type { useRouter } from 'vue-router'

interface PluginSdkGlobal {
  __plugin_sdk__?: PluginSdkInstance
}

interface PluginSdkInstance {
  plugin: PluginSdkContext
  api: typeof api
  ui: typeof ui
  widgets: typeof widgets
  dom: typeof dom
  component: typeof component
  router: typeof router
  events: {
    listen: typeof listen
    unlisten: typeof unlisten
    once: typeof once
    cleanup: typeof cleanupEvents
    Events: typeof Events
  }
  state: {
    theme: ReturnType<typeof getThemeState>
    launcher: ReturnType<typeof getLauncherState>
    account: ReturnType<typeof getAccountState>
    sidebar: ReturnType<typeof getSidebarState>
    watchTheme: typeof watchTheme
    watchLauncher: typeof watchLauncher
    watchAccount: typeof watchAccount
    watchSidebar: typeof watchSidebar
    refreshTheme: typeof refreshTheme
    refreshLauncher: typeof refreshLauncher
    refreshAccounts: typeof refreshAccounts
  }
  theme: {
    getToken: typeof getToken
    watchToken: typeof watchToken
    getMode: typeof getMode
    watchMode: typeof watchMode
  }
  hooks: ReturnType<typeof createHooks>
  transpileTS: typeof transpileTS
  createIframeBridge: typeof ui.createIframeBridge
  _reportError: (err: unknown) => void
}

const sdkCache = new Map<string, PluginSdkInstance>()

export function scopePluginCss(plugin: string, css: string): string {
  const escapedPlugin = plugin.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `@scope ([data-plugin="${escapedPlugin}"]) {\n${css}\n}`
}

function reportPluginError(plugin: string, err: unknown): void {
  console.error(`[PluginBridge] 插件执行失败 [${plugin}]:`, err)
}

function createPluginSdk(pluginName: string, version = ''): PluginSdkInstance {
  const ctx: PluginSdkContext = { plugin: pluginName, version }
  return {
    plugin: ctx,
    api,
    ui,
    widgets,
    dom,
    component,
    router,
    events: { listen, unlisten, once, cleanup: cleanupEvents, Events },
    state: {
      theme: getThemeState(),
      launcher: getLauncherState(),
      account: getAccountState(),
      sidebar: getSidebarState(),
      watchTheme,
      watchLauncher,
      watchAccount,
      watchSidebar,
      refreshTheme,
      refreshLauncher,
      refreshAccounts,
    },
    theme: { getToken, watchToken, getMode, watchMode },
    hooks: createHooks(pluginName),
    transpileTS,
    createIframeBridge: ui.createIframeBridge,
    _reportError: (err) => reportPluginError(pluginName, err),
  }
}

function getPluginSdk(pluginName: string): PluginSdkInstance {
  let sdk = sdkCache.get(pluginName)
  if (!sdk) {
    sdk = createPluginSdk(pluginName)
    sdkCache.set(pluginName, sdk)
  }
  return sdk
}

;(window as unknown as PluginSdkGlobal).__plugin_sdk__ = createPluginSdk('__global__')

const pluginRoutes = ref<PluginRoute[]>([])
const pluginSlots = ref<Record<string, PluginSlotItem[]>>({})
const pluginVueSlots = ref<Record<string, VueSlotItem[]>>({})
const vueComponentRegistry = ref<Record<string, VueComponentDef>>({})

// 已挂载的 Vue 插槽应用，用于禁用/重载时清理
interface VueSlotApp {
  slotId: string
  hostKey: string
  plugin: string
  componentName: string
  app: ReturnType<typeof createApp>
}
const vueSlotApps: VueSlotApp[] = []

// ── SlotRegistry ──

interface SlotEntry {
  plugin: string
  html: string
  priority: number
}

function findSlotContainers(slot: string): HTMLElement[] {
  const id = slot.startsWith('plugin-slot-') ? slot : `plugin-slot-${slot}`
  const escapedId = id.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  const matches = Array.from(document.querySelectorAll<HTMLElement>(`[data-plugin-slot="${escapedId}"]`))
  const legacy = document.getElementById(id)
  if (legacy && !matches.includes(legacy)) matches.push(legacy)
  return matches
}

interface DynamicSlot {
  id: string
  plugin: string
  target: string
  position: 'before' | 'after' | 'prepend' | 'append'
  container: HTMLElement | null
}

const dynamicSlots = new Map<string, DynamicSlot>()

function sanitizeHtml(html: string): string {
  // 使用 DOMPurify 替代手写正则：正则无法覆盖属性分隔符变体（如 <img/src=x/onerror=…>）、
  // HTML 实体编码的 javascript: URL、formaction/meta 等注入手法。
  // 保留 <style> 标签，兼容插件在插槽内注入样式的既有能力。
  return DOMPurify.sanitize(html, { ADD_TAGS: ['style'] })
}

function renderSlot(slot: string) {
  const containers = findSlotContainers(slot)
  if (!containers.length) return
  const entries = (pluginSlots.value[slot] || []).slice().sort((a, b) => {
    const aPriority = (a as unknown as SlotEntry).priority ?? 0
    const bPriority = (b as unknown as SlotEntry).priority ?? 0
    return bPriority - aPriority
  })
  for (const container of containers) {
    container.innerHTML = ''
    const contextKey = container.dataset.slotContext
    for (const entry of entries) {
      if (entry.contextKey && entry.contextKey !== contextKey) continue
      const wrapper = document.createElement('div')
      wrapper.className = 'plugin-slot-item'
      wrapper.setAttribute('data-plugin', entry.plugin)
      if (entry.key !== undefined) wrapper.setAttribute('data-injection-key', entry.key)
      wrapper.innerHTML = sanitizeHtml(entry.html)
      container.appendChild(wrapper)
    }
  }
}

function createDynamicSlot(
  slotId: string,
  plugin: string,
  targetSelector: string,
  position: 'before' | 'after' | 'prepend' | 'append'
): boolean {
  const target = document.querySelector(targetSelector)
  if (!target) return false

  const container = document.createElement('div')
  container.id = `plugin-slot-${slotId}`
  container.setAttribute('data-plugin-slot', `plugin-slot-${slotId}`)
  container.className = 'plugin-slot-container plugin-dynamic-slot'
  container.setAttribute('data-plugin', plugin)

  switch (position) {
    case 'before':
      target.parentElement?.insertBefore(container, target)
      break
    case 'after':
      target.parentElement?.insertBefore(container, target.nextSibling)
      break
    case 'prepend':
      target.insertBefore(container, target.firstChild)
      break
    case 'append':
    default:
      target.appendChild(container)
      break
  }

  dynamicSlots.set(slotId, {
    id: slotId,
    plugin,
    target: targetSelector,
    position,
    container,
  })

  return true
}

function removeDynamicSlot(slotId: string) {
  const slot = dynamicSlots.get(slotId)
  if (!slot) return
  if (slot.container) {
    slot.container.remove()
  }
  dynamicSlots.delete(slotId)
}

function clearSlotElements() {
  document.querySelectorAll('[id^="plugin-slot-"]').forEach((el) => {
    const id = el.id.replace('plugin-slot-', '')
    if (!dynamicSlots.has(id)) {
      el.innerHTML = ''
    }
  })
}

function clearPluginSlots(pluginName: string) {
  for (const slot of Object.keys(pluginSlots.value)) {
    const entries = pluginSlots.value[slot] ?? []
    pluginSlots.value[slot] = entries.filter((e) => e.plugin !== pluginName)
    if (pluginSlots.value[slot]?.length === 0) {
      delete pluginSlots.value[slot]
    }
    renderSlot(slot)
  }

  for (const [slotId, slot] of dynamicSlots) {
    if (slot.plugin === pluginName) {
      removeDynamicSlot(slotId)
    }
  }
}

const _injectedScripts = new Set<string>()

function wrapScript(plugin: string, script: string): string {
  return `
try {
  ${script}
} catch (__e) {
  if (window.__plugin_sdk__ && window.__plugin_sdk__._reportError) {
    window.__plugin_sdk__._reportError(__e)
  } else {
    console.error('[PluginBridge] 插件脚本执行失败 [${plugin}]:', __e)
  }
}
`
}

function executeScript(plugin: string, script: string) {
  const id = `plugin-script-${plugin}`
  const old = document.getElementById(id)
  if (old) old.remove()

  const sdk = getPluginSdk(plugin)
  setActiveContext({ plugin, version: '' })
  ;(window as unknown as PluginSdkGlobal).__plugin_sdk__ = sdk

  const el = document.createElement('script')
  el.id = id
  el.setAttribute('data-plugin', plugin)
  el.textContent = wrapScript(plugin, script)
  document.head.appendChild(el)
  _injectedScripts.add(plugin)

  setActiveContext(null)
}

function cleanupScripts() {
  document.querySelectorAll('script[data-plugin]').forEach((el) => el.remove())
  _injectedScripts.clear()
}

// ── Vue SFC 动态编译 ──

function looksLikeTypeScript(script: string): boolean {
  return (
    /<script\s+[^>]*\blang\s*=\s*["']ts["'][^>]*>/i.test(script) ||
    /:\s*(string|number|boolean|any|unknown)\b/.test(script)
  )
}

function evaluateVueScript(script: string, plugin: string): Record<string, unknown> {
  if (!script.trim()) return {}
  let code = script
  if (looksLikeTypeScript(code)) {
    try {
      code = transpileTS(code)
    } catch (e) {
      console.error(`[PluginBridge] Vue 组件 TS 转译失败 [${plugin}]:`, e)
      return {}
    }
  }
  // 用 module shim 执行 export default / CommonJS，返回组件选项对象
  const wrapped = `
    var exports = {};
    var module = { exports: exports };
    ${code};
    return module.exports.default || module.exports;
  `
  try {
    const fn = new Function(wrapped)
    const result = fn()
    return result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  } catch (e) {
    console.error(`[PluginBridge] Vue 组件脚本执行失败 [${plugin}]:`, e)
    return {}
  }
}

function compileVueTemplate(template: string, plugin: string) {
  try {
    return compile(template)
  } catch (e) {
    console.error(`[PluginBridge] Vue 模板编译失败 [${plugin}]:`, e)
    return () => h('div', { class: 'plugin-vue-error' }, 'Vue 组件渲染失败')
  }
}

function createVueComponent(componentName: string, def: VueComponentDef, plugin: string) {
  const options = evaluateVueScript(def.script, plugin)
  const render = compileVueTemplate(def.template, plugin)
  return defineComponent({
    ...options,
    name: componentName,
    render,
  })
}

function injectComponentStyle(componentName: string, plugin: string, style: string) {
  if (!style.trim()) return
  const id = `plugin-vue-style-${componentName}`
  let styleEl = document.getElementById(id)
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = id
    styleEl.setAttribute('data-plugin-vue-style', componentName)
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = scopePluginCss(plugin, style)
}

function removeComponentStyle(componentName: string) {
  const id = `plugin-vue-style-${componentName}`
  const styleEl = document.getElementById(id)
  if (styleEl) styleEl.remove()
}

function createVueRouteComponent(componentName: string, def: VueComponentDef, plugin: string) {
  const baseComponent = createVueComponent(componentName, def, plugin)
  return defineComponent({
    name: `${componentName}-route`,
    render() {
      return h('div', { class: 'plugin-vue-route', 'data-plugin': plugin }, [h(baseComponent)])
    },
    mounted() {
      injectComponentStyle(componentName, plugin, def.style || '')
    },
    unmounted() {
      removeComponentStyle(componentName)
    },
  })
}

function renderVueSlot(slotId: string) {
  const containers = findSlotContainers(slotId)
  if (!containers.length) return
  // 清理该插槽已挂载的 Vue 应用
  const toRemove = vueSlotApps.filter((a) => a.slotId === slotId)
  for (const item of toRemove) {
    try {
      item.app.unmount()
    } catch {
      /* ignore */
    }
    removeComponentStyle(item.componentName)
  }
  const remaining = vueSlotApps.filter((a) => a.slotId !== slotId)
  vueSlotApps.length = 0
  vueSlotApps.push(...remaining)

  const entries = pluginVueSlots.value[slotId] || []
  for (const [hostIndex, container] of containers.entries()) {
    container.innerHTML = ''
    const contextKey = container.dataset.slotContext
    for (const entry of entries) {
      if (entry.contextKey && entry.contextKey !== contextKey) continue
      const def = vueComponentRegistry.value[entry.component_name] || entry
      if (!def || !def.template) continue
      const el = document.createElement('div')
      el.className = 'plugin-vue-slot-item'
      el.setAttribute('data-plugin', entry.plugin)
      container.appendChild(el)
      try {
        const component = createVueComponent(entry.component_name, def as VueComponentDef, entry.plugin)
        const app = createApp(component)
        app.mount(el)
        injectComponentStyle(entry.component_name, entry.plugin, def.style || '')
        vueSlotApps.push({
          slotId,
          hostKey: `${slotId}:${contextKey || hostIndex}`,
          plugin: entry.plugin,
          componentName: entry.component_name,
          app,
        })
      } catch (e) {
        console.error(`[PluginBridge] Vue 插槽组件挂载失败 [${entry.plugin}]:`, e)
      }
    }
  }
}

function clearPluginVueSlots(pluginName: string) {
  for (const [slotId, entries] of Object.entries(pluginVueSlots.value)) {
    if (!entries.some((entry) => entry.plugin === pluginName)) continue

    const remaining = entries.filter((entry) => entry.plugin !== pluginName)
    if (remaining.length) {
      pluginVueSlots.value[slotId] = remaining
    } else {
      delete pluginVueSlots.value[slotId]
    }
    renderVueSlot(slotId)
  }
}

function clearVueSlots() {
  for (const item of vueSlotApps) {
    try {
      item.app.unmount()
    } catch {
      /* ignore */
    }
    removeComponentStyle(item.componentName)
  }
  vueSlotApps.length = 0
}

function setupRoutes(router: ReturnType<typeof useRouter>) {
  const existing = router.getRoutes().filter((r) => r.meta?.pluginRoute)
  for (const route of existing) {
    router.removeRoute(route.name!)
  }

  for (const route of pluginRoutes.value) {
    const pluginName = route.plugin
    const path = `/plugin/${pluginName}${route.path}`
    const routeMeta = route as unknown as Record<string, unknown>
    const isVueRoute = routeMeta.type === 'vue'
    const componentName = typeof routeMeta.component === 'string' ? routeMeta.component : undefined

    let routeComponent
    if (isVueRoute && componentName && vueComponentRegistry.value[componentName]) {
      const def = vueComponentRegistry.value[componentName]
      routeComponent = createVueRouteComponent(componentName, def, pluginName)
    } else {
      routeComponent = {
        template: `<div class="plugin-page" data-plugin="${pluginName}"><div id="plugin-slot-plugin-${pluginName}"></div></div>`,
        mounted() {
          setTimeout(() => renderSlot(`plugin-${pluginName}`), 50)
        },
      }
    }

    router.addRoute({
      path,
      name: `plugin-${pluginName}-${route.path}`,
      component: routeComponent,
      meta: { pluginRoute: true, pluginName, title: route.title },
    })
  }
}

function cleanupPlugin(pluginName: string) {
  const scriptEl = document.getElementById(`plugin-script-${pluginName}`)
  if (scriptEl) scriptEl.remove()
  _injectedScripts.delete(pluginName)

  const styleEl = document.getElementById(`plugin-css-${pluginName}`)
  if (styleEl) styleEl.remove()

  document.querySelectorAll(`style[data-plugin="${pluginName}"]`).forEach((el) => el.remove())
  document.querySelectorAll(`style[data-plugin-vue-style]`).forEach((el) => {
    const componentName = el.getAttribute('data-plugin-vue-style')
    if (componentName && vueComponentRegistry.value[componentName]?.plugin === pluginName) {
      el.remove()
    }
  })
  document.querySelectorAll(`[data-plugin="${pluginName}"]`).forEach((el) => {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return
    if (el.id && el.id.startsWith('plugin-slot-')) return
    el.remove()
  })

  runPluginCleanup(pluginName)
}

async function fullCleanupPlugin(pluginName: string, appRouter: ReturnType<typeof useRouter>) {
  const wasViewingPlugin = appRouter.currentRoute.value.meta?.pluginName === pluginName
  cleanupPlugin(pluginName)
  clearPluginSlots(pluginName)
  clearPluginVueSlots(pluginName)
  sdkCache.delete(pluginName)
  // 移除组件注册表中属于该插件的条目，避免重载后使用旧定义
  for (const [name, def] of Object.entries(vueComponentRegistry.value)) {
    if (def.plugin === pluginName) {
      delete vueComponentRegistry.value[name]
    }
  }

  pluginRoutes.value = pluginRoutes.value.filter((route) => route.plugin !== pluginName)
  for (const route of appRouter.getRoutes()) {
    if (route.meta?.pluginName === pluginName && route.name) {
      appRouter.removeRoute(route.name)
    }
  }
  if (wasViewingPlugin) {
    await appRouter.replace('/')
  }
}

async function refreshRoutes(router: ReturnType<typeof useRouter>) {
  try {
    const currentRoute = router.currentRoute.value
    pluginRoutes.value = await pluginHostApi.getRoutes()
    setupRoutes(router)
    if (currentRoute.meta.pluginRoute) {
      await router.replace({ path: currentRoute.fullPath, force: true })
    }
  } catch {
    pluginRoutes.value = []
  }
}

const unlistenFns: Array<() => void> = []
let cleanupState: (() => void) | null = null

export function initPluginBridge(router: ReturnType<typeof useRouter>) {
  cleanupState = initPluginState()

  // 插槽容器挂载后补渲染已注册的 HTML/Vue 内容（插件可能在容器出现前就完成注册）。
  const onSlotHostMounted = (event: Event) => {
    const slotId = (event as CustomEvent).detail?.slotId as string | undefined
    if (!slotId) return
    renderSlot(slotId)
    renderVueSlot(slotId)
  }
  window.addEventListener('ecl:slot-host-mounted', onSlotHostMounted)
  unlistenFns.push(() => window.removeEventListener('ecl:slot-host-mounted', onSlotHostMounted))

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:html_injected', (payload) => {
      const slot = payload.slot
      const priority = payload.priority ?? 0
      const entries = [...(pluginSlots.value[slot] || [])]
      const entry: PluginSlotItem = {
        plugin: payload.plugin,
        html: payload.html,
        priority,
        ...(payload.key !== null && payload.key !== undefined ? { key: payload.key } : {}),
        ...(payload.contextKey ? { contextKey: payload.contextKey } : {}),
      }
      const index =
        payload.key !== null && payload.key !== undefined
          ? entries.findIndex(
              (item) =>
                item.plugin === payload.plugin && item.key === payload.key && item.contextKey === payload.contextKey
            )
          : -1
      if (index === -1) entries.push(entry)
      else entries[index] = entry
      pluginSlots.value[slot] = entries
      renderSlot(slot)
      void invalidatePluginRegistry()
    })
  )

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:route_registered', () => {
      void invalidatePluginRegistry()
      void refreshRoutes(router)
    })
  )

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:vue_route_registered', (payload) => {
      vueComponentRegistry.value[payload.component_name] = {
        plugin: payload.plugin,
        template: payload.template,
        script: payload.script,
        style: payload.style,
      }
      void invalidatePluginRegistry()
      void refreshRoutes(router)
    })
  )

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:vue_slot_registered', (payload) => {
      vueComponentRegistry.value[payload.component_name] = {
        plugin: payload.plugin,
        template: payload.template,
        script: payload.script,
        style: payload.style,
      }
      const entries = [...(pluginVueSlots.value[payload.slot] || [])]
      const index = entries.findIndex(
        (entry) =>
          entry.plugin === payload.plugin &&
          entry.component_name === payload.component_name &&
          entry.contextKey === payload.contextKey
      )
      const newEntry: VueSlotItem = {
        plugin: payload.plugin,
        component_name: payload.component_name,
        template: payload.template,
        script: payload.script,
        style: payload.style,
        ...(payload.contextKey ? { contextKey: payload.contextKey } : {}),
      }
      if (index === -1) entries.push(newEntry)
      else entries[index] = newEntry
      pluginVueSlots.value[payload.slot] = entries
      renderVueSlot(payload.slot)
      void invalidatePluginRegistry()
    })
  )

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:script_injected', (payload) => {
      executeScript(payload.plugin, payload.script)
    })
  )

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:typescript_injected', (payload) => {
      try {
        const js = transpileTS(payload.script || '')
        executeScript(payload.plugin, js)
      } catch (e) {
        console.error(`[PluginBridge] TS 转译失败 [${payload.plugin}]:`, e)
      }
    })
  )

  unlistenFns.push(
    pluginHostApi.subscribe('plugin:status_changed', (payload) => {
      if (payload.action === 'disabled' || payload.action === 'unloaded') {
        void invalidatePluginRegistry()
        void fullCleanupPlugin(payload.name, router)
      }
    })
  )

  pluginRegistryQuery()
    .then(({ routes, slots, vueSlots, vueComponents }) => {
      pluginRoutes.value = routes
      pluginSlots.value = slots
      pluginVueSlots.value = vueSlots
      vueComponentRegistry.value = vueComponents
      setupRoutes(router)
      for (const slot of Object.keys(slots)) {
        renderSlot(slot)
      }
      for (const slotId of Object.keys(vueSlots)) {
        renderVueSlot(slotId)
      }
    })
    .catch(() => {})
}

export function destroyPluginBridge() {
  for (const fn of unlistenFns) {
    try {
      fn()
    } catch {
      /* 清理时忽略错误 */
    }
  }
  unlistenFns.length = 0
  cleanupScripts()
  clearSlotElements()
  clearVueSlots()
  for (const [slotId] of dynamicSlots) {
    removeDynamicSlot(slotId)
  }
  dynamicSlots.clear()
  for (const plugin of sdkCache.keys()) {
    runPluginCleanup(plugin)
  }
  sdkCache.clear()
  vueComponentRegistry.value = {}
  pluginVueSlots.value = {}
  cleanupState?.()
  cleanupState = null
}

export function callPluginCommand(command: string, params?: Record<string, unknown>) {
  return pluginHostApi.callCommand(command, params)
}

export {
  pluginRoutes,
  pluginSlots,
  pluginVueSlots,
  renderSlot,
  clearPluginVueSlots,
  fullCleanupPlugin,
  cleanupScripts,
  clearSlotElements,
  clearPluginSlots,
  createDynamicSlot,
  removeDynamicSlot,
  dynamicSlots,
}
