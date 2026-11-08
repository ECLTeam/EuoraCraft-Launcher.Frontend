/**
 * plugin-sdk DOM 操作模块
 * 开放插件对前端 DOM 的查询与操作能力，通过代理层实现安全边界和可追踪性。
 * 所有查询限制在 #app 容器内，操作通过 SDK 代理可审计。
 */

import { getActiveContext } from './context'

// ── 安全边界 ──

const APP_SCOPE = '#app'

function resolveScope(scope?: string): string {
  return scope || APP_SCOPE
}

function assertInScope(el: Element): void {
  const appRoot = document.querySelector(APP_SCOPE)
  if (!appRoot) return
  if (!appRoot.contains(el)) {
    throw new Error(`[PluginSDK] DOM 操作超出允许范围: 元素不在 #app 容器内`)
  }
}

function wrapPluginData(el: HTMLElement): void {
  const ctx = getActiveContext()
  if (ctx) {
    el.setAttribute('data-plugin', ctx.plugin)
    el.setAttribute('data-plugin-dom', '')
  }
}

// ── 查询 ──

export function querySelector(selector: string, scope?: string): Element | null {
  const root = scope ? document.querySelector(resolveScope(scope)) : document.querySelector(APP_SCOPE)
  if (!root) return null
  return root.querySelector(selector)
}

export function querySelectorAll(selector: string, scope?: string): Element[] {
  const root = scope ? document.querySelector(resolveScope(scope)) : document.querySelector(APP_SCOPE)
  if (!root) return []
  return Array.from(root.querySelectorAll(selector))
}

export function getElementById(id: string): HTMLElement | null {
  const el = document.getElementById(id)
  if (!el) return null
  const appRoot = document.querySelector(APP_SCOPE)
  if (appRoot && !appRoot.contains(el)) return null
  return el
}

export function getElementsByClassName(className: string, scope?: string): Element[] {
  const root = scope ? document.querySelector(resolveScope(scope)) : document.querySelector(APP_SCOPE)
  if (!root) return []
  return Array.from(root.getElementsByClassName(className))
}

// ── 创建 ──

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    id?: string
    class?: string | string[]
    style?: Partial<CSSStyleDeclaration>
    attrs?: Record<string, string>
    text?: string
    html?: string
    children?: (HTMLElement | string)[]
    events?: Record<string, (e: Event) => void>
  } = {}
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  wrapPluginData(el)

  if (options.id) el.id = options.id
  if (options.class) {
    const classes = Array.isArray(options.class) ? options.class : options.class.split(/\s+/)
    el.classList.add(...classes.filter(Boolean))
  }
  if (options.text) el.textContent = options.text
  if (options.html) el.innerHTML = options.html
  if (options.style) {
    for (const [key, value] of Object.entries(options.style)) {
      if (typeof value === 'string') el.style.setProperty(key, value)
    }
  }
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      el.setAttribute(key, value)
    }
  }
  if (options.children) {
    for (const child of options.children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child))
      } else {
        el.appendChild(child)
      }
    }
  }
  if (options.events) {
    for (const [event, handler] of Object.entries(options.events)) {
      el.addEventListener(event, handler)
    }
  }

  return el
}

// ── 插入 ──

export type InsertPosition = 'before' | 'after' | 'prepend' | 'append'

export function insertElement(
  target: Element | string,
  element: HTMLElement,
  position: InsertPosition = 'append'
): void {
  const t = typeof target === 'string' ? querySelector(target) : target
  if (!t) throw new Error(`[PluginSDK] 目标元素不存在: ${target}`)
  assertInScope(t)
  wrapPluginData(element)

  switch (position) {
    case 'before':
      t.parentElement?.insertBefore(element, t)
      break
    case 'after':
      t.parentElement?.insertBefore(element, t.nextSibling)
      break
    case 'prepend':
      t.insertBefore(element, t.firstChild)
      break
    case 'append':
    default:
      t.appendChild(element)
      break
  }
}

export function removeElement(element: HTMLElement): void {
  element.remove()
}

export function clearElement(element: HTMLElement): void {
  element.innerHTML = ''
}

// ── 类操作 ──

export function addClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.add(...classes)
}

export function removeClass(element: HTMLElement, ...classes: string[]): void {
  element.classList.remove(...classes)
}

export function toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
  return element.classList.toggle(className, force)
}

export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className)
}

// ── 属性操作 ──

export function setAttr(element: HTMLElement, name: string, value: string): void {
  element.setAttribute(name, value)
}

export function getAttr(element: HTMLElement, name: string): string | null {
  return element.getAttribute(name)
}

export function removeAttr(element: HTMLElement, name: string): void {
  element.removeAttribute(name)
}

export function setStyle(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === 'string') element.style.setProperty(key, value)
  }
}

export function getStyle(element: HTMLElement, property: string): string {
  return getComputedStyle(element).getPropertyValue(property).trim()
}

// ── 样式注入 ──

export function injectStyle(css: string, scopeId?: string): HTMLStyleElement {
  const styleEl = document.createElement('style')
  const ctx = getActiveContext()
  const plugin = ctx?.plugin || 'unknown'
  styleEl.setAttribute('data-plugin', plugin)
  if (scopeId) styleEl.setAttribute('data-scope', scopeId)
  styleEl.textContent = css
  document.head.appendChild(styleEl)
  return styleEl
}

export function removeStyle(styleEl: HTMLStyleElement): void {
  styleEl.remove()
}

export function removeAllPluginStyles(pluginName: string): void {
  document.querySelectorAll(`style[data-plugin="${pluginName}"]`).forEach((el) => el.remove())
}

// ── DOM 监听 ──

export interface DomObserver {
  observe: (target: Element, options?: MutationObserverInit) => void
  disconnect: () => void
}

export function createMutationObserver(
  callback: (mutations: MutationRecord[], observer: MutationObserver) => void,
  options: MutationObserverInit = { childList: true, subtree: true, attributes: true }
): DomObserver {
  const observer = new MutationObserver(callback)
  return {
    observe: (target: Element, opts?: MutationObserverInit) => {
      observer.observe(target, opts || options)
    },
    disconnect: () => observer.disconnect(),
  }
}

export function onElementAppear(selector: string, callback: (el: Element) => void, timeout = 10000): () => void {
  const existing = querySelector(selector)
  if (existing) {
    callback(existing)
    return () => {}
  }

  const observer = new MutationObserver((_mutations, obs) => {
    const el = querySelector(selector)
    if (el) {
      obs.disconnect()
      callback(el)
    }
  })

  const appRoot = document.querySelector(APP_SCOPE)
  if (appRoot) {
    observer.observe(appRoot, { childList: true, subtree: true })
  }

  if (timeout > 0) {
    setTimeout(() => observer.disconnect(), timeout)
  }

  return () => observer.disconnect()
}

export function onElementRemoved(element: Element, callback: () => void): () => void {
  const parent = element.parentElement
  if (!parent) return () => {}

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === element || (node instanceof Element && node.contains(element))) {
          observer.disconnect()
          callback()
          return
        }
      }
    }
  })

  observer.observe(parent, { childList: true })
  return () => observer.disconnect()
}

// ── 事件代理 ──

export function delegateEvent(
  container: Element,
  eventType: string,
  selector: string,
  handler: (e: Event, target: Element) => void
): () => void {
  const listener = (e: Event) => {
    const target = (e.target as Element).closest(selector)
    if (target && container.contains(target)) {
      handler(e, target)
    }
  }
  container.addEventListener(eventType, listener)
  return () => container.removeEventListener(eventType, listener)
}

// ── 批量操作 ──

export function batch(operations: (() => void)[]): void {
  for (const op of operations) {
    try {
      op()
    } catch (e) {
      console.error('[PluginSDK] 批量操作失败:', e)
    }
  }
}

// ── 快捷创建 ──

export const $ = {
  el: <K extends keyof HTMLElementTagNameMap>(tag: K, opts?: Parameters<typeof createElement<K>>[1]) =>
    createElement(tag, opts),
  div: (opts?: Parameters<typeof createElement<'div'>>[1]) => createElement('div', opts),
  span: (opts?: Parameters<typeof createElement<'span'>>[1]) => createElement('span', opts),
  button: (opts?: Parameters<typeof createElement<'button'>>[1]) => createElement('button', opts),
  input: (opts?: Parameters<typeof createElement<'input'>>[1]) => createElement('input', opts),
  a: (opts?: Parameters<typeof createElement<'a'>>[1]) => createElement('a', opts),
  p: (opts?: Parameters<typeof createElement<'p'>>[1]) => createElement('p', opts),
  h2: (opts?: Parameters<typeof createElement<'h2'>>[1]) => createElement('h2', opts),
  h3: (opts?: Parameters<typeof createElement<'h3'>>[1]) => createElement('h3', opts),
  img: (opts?: Parameters<typeof createElement<'img'>>[1]) => createElement('img', opts),
  label: (opts?: Parameters<typeof createElement<'label'>>[1]) => createElement('label', opts),
  select: (opts?: Parameters<typeof createElement<'select'>>[1]) => createElement('select', opts),
  option: (opts?: Parameters<typeof createElement<'option'>>[1]) => createElement('option', opts),
  textarea: (opts?: Parameters<typeof createElement<'textarea'>>[1]) => createElement('textarea', opts),
  section: (opts?: Parameters<typeof createElement<'section'>>[1]) => createElement('section', opts),
  pre: (opts?: Parameters<typeof createElement<'pre'>>[1]) => createElement('pre', opts),
  code: (opts?: Parameters<typeof createElement<'code'>>[1]) => createElement('code', opts),
  fragment: () => document.createDocumentFragment(),
}
