/**
 * plugin-sdk 插槽上下文与宿主导航通知
 *
 * getSlotContext 读取插件内容所在插槽的结构化上下文（宿主通过
 * data-slot-context-data 下发）；onPageChanged 订阅宿主路由切换的
 * 只读通知（宿主 router afterEach 广播 ecl:page-changed）。
 */

import { pageForSlotId } from '@/features/plugins/slots/slotRegistry'

// ── 插槽上下文 ──

export interface PluginSlotContext {
  /** 插槽标识，如 plugin-slot-content-bottom */
  slotId: string
  /** 宿主组件传入的上下文键（如任务 id），无则缺省 */
  contextKey: string | null
  /** 宿主组件传入的结构化上下文对象，未提供时为 null */
  contextData: Record<string, unknown> | null
  /** 插槽所在页面的粗粒度归属（settings/instances/plugins/game 等） */
  page: string | null
}

function readContextData(el: Element): Record<string, unknown> | null {
  const raw = el.getAttribute('data-slot-context-data')
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * 读取元素所在插件插槽的结构化上下文。
 *
 * 未传元素时使用当前活跃插件脚本的最近宿主容器：从自身元素向上查找
 * `[data-plugin-slot]`。上下文对象只读，宿主在重新渲染时会更新。
 *
 * @param element - 插件内容中的任意元素；缺省时无法定位插槽返回 null
 * @return 插槽上下文；元素不在插槽容器内时为 null
 */
export function getSlotContext(element?: Element): PluginSlotContext | null {
  const host = element ? element.closest('[data-plugin-slot]') : null
  if (!host) return null
  const slotId = host.getAttribute('data-plugin-slot') ?? ''
  return {
    slotId,
    contextKey: host.getAttribute('data-slot-context'),
    contextData: readContextData(host),
    page: slotId ? pageForSlotId(slotId) : null,
  }
}

// ── 宿主导航通知 ──

export interface PluginPageChangedDetail {
  path: string
  name: string | null
}

type PageChangedHandler = (detail: PluginPageChangedDetail) => void

const pageChangedHandlers: Set<PageChangedHandler> = new Set()
let pageChangedBound = false

function bindPageChanged(): void {
  if (pageChangedBound) return
  pageChangedBound = true
  window.addEventListener('ecl:page-changed', (event) => {
    const detail = (event as CustomEvent<PluginPageChangedDetail>).detail
    for (const handler of [...pageChangedHandlers]) {
      try {
        handler(detail)
      } catch (e) {
        console.error('[PluginSDK] 页面切换回调失败:', e)
      }
    }
  })
}

/**
 * 订阅宿主页面切换通知。回调收到目标路由的 path 与名称，只读不控制。
 *
 * @param handler - 页面切换回调
 * @return 取消订阅函数
 */
export function onPageChanged(handler: PageChangedHandler): () => void {
  bindPageChanged()
  pageChangedHandlers.add(handler)
  return () => {
    pageChangedHandlers.delete(handler)
  }
}
