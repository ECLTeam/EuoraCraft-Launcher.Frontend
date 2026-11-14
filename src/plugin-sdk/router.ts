/**
 * plugin-sdk 路由导航与监听
 * 让插件能够感知路由变化并执行编程式导航。
 * 按用户决策（2026-11-15 边界开放），导航不再限制在插件自身前缀内，
 * 可跳转任意宿主路由；路由监听同时消费宿主 page-changed 通知。
 */

// ── 路由信息 ──

export interface RouteInfo {
  path: string
  fullPath: string
  name?: string
  params: Record<string, string>
  query: Record<string, string>
  hash: string
}

function parseRoute(): RouteInfo {
  const loc = window.location
  const params: Record<string, string> = {}
  const query: Record<string, string> = {}
  const hashRoute = loc.hash.startsWith('#') ? loc.hash.slice(1) : loc.hash
  const routeWithQuery = hashRoute || '/'
  const anchorIndex = routeWithQuery.indexOf('#')
  const routeHash = anchorIndex >= 0 ? routeWithQuery.slice(anchorIndex) : ''
  const pathWithQuery = anchorIndex >= 0 ? routeWithQuery.slice(0, anchorIndex) : routeWithQuery
  const queryIndex = pathWithQuery.indexOf('?')
  const path = queryIndex >= 0 ? pathWithQuery.slice(0, queryIndex) : pathWithQuery
  const search = queryIndex >= 0 ? pathWithQuery.slice(queryIndex + 1) : ''

  for (const [key, value] of new URLSearchParams(search)) {
    query[key] = value
  }

  return {
    path: path || '/',
    fullPath: `${path || '/'}${search ? `?${search}` : ''}${routeHash}`,
    params,
    query,
    hash: routeHash,
  }
}

function updateHashRoute(fullPath: string, replace = false): void {
  const normalized = fullPath.startsWith('/') ? fullPath : `/${fullPath}`
  const url = `${window.location.pathname}${window.location.search}#${normalized}`
  if (replace) {
    window.location.replace(url)
  } else {
    window.location.hash = normalized
  }
}

// ── 导航 ──

export function navigateTo(path: string, query?: Record<string, string>): void {
  let fullPath: string
  if (path.startsWith('/')) {
    fullPath = path
  } else {
    const current = parseRoute().path
    fullPath = current.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
  }

  if (query) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    if (qs) fullPath += '?' + qs
  }

  updateHashRoute(fullPath)
}

export function replaceTo(path: string, query?: Record<string, string>): void {
  let fullPath: string
  if (path.startsWith('/')) {
    fullPath = path
  } else {
    const current = parseRoute().path
    fullPath = current.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
  }

  if (query) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    if (qs) fullPath += '?' + qs
  }

  updateHashRoute(fullPath, true)
}

export function goBack(): void {
  window.history.back()
}

export function goForward(): void {
  window.history.forward()
}

// ── 路由监听 ──

type RouteChangeHandler = (route: RouteInfo, prev: RouteInfo) => void | Promise<void>

const routeListeners: Set<RouteChangeHandler> = new Set()
let prevRoute = parseRoute()
let popstateBound = false

function bindPopstate() {
  if (popstateBound) return
  popstateBound = true
  const handleRouteChange = () => {
    const current = parseRoute()
    if (current.fullPath === prevRoute.fullPath) return
    const previous = prevRoute
    prevRoute = current
    for (const handler of routeListeners) {
      try {
        Promise.resolve(handler(current, previous)).catch((e) => {
          console.error('[PluginSDK] 路由监听回调失败:', e)
        })
      } catch (e) {
        console.error('[PluginSDK] 路由监听回调失败:', e)
      }
    }
  }
  window.addEventListener('popstate', handleRouteChange)
  window.addEventListener('hashchange', handleRouteChange)
}

export function onRouteChange(handler: RouteChangeHandler): () => void {
  bindPopstate()
  routeListeners.add(handler)
  return () => {
    routeListeners.delete(handler)
  }
}

export function getCurrentRoute(): RouteInfo {
  return parseRoute()
}

// ── 路由守卫 ──

export function beforeRouteLeave(handler: () => boolean | Promise<boolean>): () => void {
  const wrapper = async (_current: RouteInfo, _prev: RouteInfo) => {
    const ok = await handler()
    if (!ok) {
      prevRoute = _prev
      updateHashRoute(_prev.fullPath, true)
    }
  }
  return onRouteChange(wrapper)
}

// ── 插件路由匹配 ──

export function matchPluginRoute(): { plugin: string; subPath: string } | null {
  const path = parseRoute().path
  const match = path.match(/^\/plugin\/([^/]+)(\/.*)?$/)
  if (!match) return null
  return {
    plugin: match[1]!,
    subPath: match[2] || '/',
  }
}

export function isPluginRoute(pluginName?: string): boolean {
  const match = matchPluginRoute()
  if (!match) return false
  if (pluginName) return match.plugin === pluginName
  return true
}
