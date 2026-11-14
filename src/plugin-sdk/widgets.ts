/**
 * plugin-sdk 预置 UI 组件
 * 提供卡片、按钮、输入框、列表等常用组件的快捷创建函数
 *
 * 使用方式：
 *   const { widgets } = window.__plugin_sdk__
 *   const card = widgets.card({ title: '标题', body: '内容' })
 *   container.appendChild(card)
 */

import { createElement } from './dom'

// ---- 工厂 ----

interface WidgetOptions {
  class?: string
  onClick?: (e: MouseEvent) => void
}

function defineWidget<K extends keyof HTMLElementTagNameMap = 'div'>(
  name: string,
  defaultClass: string | string[],
  render: (el: HTMLElementTagNameMap[K]) => void,
  options: WidgetOptions & { tag?: K } = {}
): HTMLElementTagNameMap[K] {
  const tag = (options.tag || 'div') as K
  const baseClasses = Array.isArray(defaultClass) ? [...defaultClass] : [defaultClass]
  if (options.class) baseClasses.push(options.class)

  // createElement 内部通过 wrapPluginData + getActiveContext 标记 data-plugin
  const el = createElement(tag, {
    class: baseClasses.filter(Boolean),
  })
  el.setAttribute('data-widget', name)

  if (options.onClick) {
    el.style.cursor = 'pointer'
    el.addEventListener('click', options.onClick as EventListener)
  }

  render(el)
  return el
}

// ---- 卡片 ----

interface CardOptions {
  title?: string
  subtitle?: string
  body?: string | HTMLElement
  footer?: string | HTMLElement
  class?: string
  onClick?: () => void
}

export function card(options: CardOptions = {}): HTMLElement {
  return defineWidget(
    'card',
    'plugin-card',
    (el) => {
      if (options.title || options.subtitle) {
        const header = createElement('div', { class: 'plugin-card-header' })
        if (options.title) header.appendChild(createElement('span', { text: options.title }))
        if (options.subtitle) {
          header.appendChild(
            createElement('span', {
              class: 'plugin-text-sm plugin-text-secondary',
              text: options.subtitle,
            })
          )
        }
        el.appendChild(header)
      }

      if (options.body) {
        const body = createElement('div', { class: 'plugin-card-body' })
        if (typeof options.body === 'string') body.textContent = options.body
        else body.appendChild(options.body)
        el.appendChild(body)
      }

      if (options.footer) {
        const footer = createElement('div', { class: 'plugin-card-footer' })
        if (typeof options.footer === 'string') footer.textContent = options.footer
        else footer.appendChild(options.footer)
        el.appendChild(footer)
      }
    },
    { class: options.class, onClick: options.onClick }
  )
}

// ---- 按钮 ----

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

interface ButtonOptions {
  text?: string
  icon?: string
  variant?: BtnVariant
  size?: BtnSize
  disabled?: boolean
  loading?: boolean
  onClick?: (e: MouseEvent) => void
  class?: string
}

export function button(options: ButtonOptions = {}): HTMLButtonElement {
  const { variant = 'primary', size = 'md', disabled = false, loading = false } = options
  const classes = ['plugin-btn', `plugin-btn-${variant}`]
  if (size !== 'md') classes.push(`plugin-btn-${size}`)

  return defineWidget(
    'button',
    classes,
    (el) => {
      const btn = el as HTMLButtonElement
      if (disabled) btn.disabled = true
      if (loading) btn.appendChild(createElement('span', { class: 'plugin-spinner', text: '⟳' }))
      if (options.icon) btn.appendChild(createElement('span', { class: 'plugin-btn-icon', text: options.icon }))
      if (options.text) btn.appendChild(createElement('span', { text: options.text }))
    },
    {
      tag: 'button',
      class: options.class,
      onClick: disabled ? undefined : options.onClick,
    }
  ) as HTMLButtonElement
}

// ---- 输入框 ----

interface InputOptions {
  type?: string
  placeholder?: string
  value?: string
  disabled?: boolean
  onChange?: (value: string) => void
  class?: string
}

export function input(options: InputOptions = {}): HTMLInputElement {
  return defineWidget(
    'input',
    'plugin-input',
    (el) => {
      const inputEl = el as HTMLInputElement
      inputEl.type = options.type || 'text'
      inputEl.placeholder = options.placeholder || ''
      inputEl.value = options.value || ''
      if (options.disabled) inputEl.disabled = true
      if (options.onChange) {
        inputEl.addEventListener('input', () => options.onChange!(inputEl.value))
      }
    },
    {
      tag: 'input',
      class: options.class,
    }
  ) as HTMLInputElement
}

// ---- 文本域 ----

interface TextareaOptions {
  placeholder?: string
  value?: string
  rows?: number
  onChange?: (value: string) => void
}

export function textarea(options: TextareaOptions = {}): HTMLTextAreaElement {
  return defineWidget(
    'textarea',
    'plugin-input',
    (el) => {
      const ta = el as HTMLTextAreaElement
      ta.placeholder = options.placeholder || ''
      ta.rows = options.rows || 3
      if (options.value) ta.value = options.value
      if (options.onChange) {
        ta.addEventListener('input', () => options.onChange!(ta.value))
      }
    },
    { tag: 'textarea' }
  ) as HTMLTextAreaElement
}

// ---- 标签/徽章 ----

type BadgeVariant = 'default' | 'success' | 'warning' | 'error'

interface BadgeOptions {
  text: string
  variant?: BadgeVariant
}

export function badge(options: BadgeOptions): HTMLElement {
  const cls =
    options.variant && options.variant !== 'default' ? `plugin-badge plugin-badge-${options.variant}` : 'plugin-badge'
  return defineWidget(
    'badge',
    cls,
    (el) => {
      el.textContent = options.text
    },
    { tag: 'span' }
  )
}

// ---- 列表项 ----

interface ListItemOptions {
  label: string
  description?: string
  icon?: string
  badge?: string
  badgeVariant?: BadgeVariant
  onClick?: () => void
}

export function listItem(options: ListItemOptions): HTMLElement {
  return defineWidget(
    'listItem',
    'plugin-list-item',
    (el) => {
      if (options.icon) {
        el.appendChild(createElement('span', { class: 'plugin-text-secondary', text: options.icon }))
      }
      const info = createElement('div', { class: 'plugin-flex-1' })
      info.appendChild(createElement('div', { text: options.label }))
      if (options.description) {
        info.appendChild(
          createElement('div', {
            class: 'plugin-text-sm plugin-text-secondary',
            text: options.description,
          })
        )
      }
      el.appendChild(info)
      if (options.badge) {
        el.appendChild(badge({ text: options.badge, variant: options.badgeVariant }))
      }
    },
    { onClick: options.onClick }
  )
}

// ---- 列表容器 ----

interface ListOptions {
  items: (ListItemOptions | HTMLElement)[]
  emptyText?: string
}

export function list(options: ListOptions): HTMLElement {
  return defineWidget('list', 'plugin-list', (el) => {
    if (options.items.length === 0) {
      el.appendChild(emptyState({ text: options.emptyText || '暂无数据' }))
      return
    }
    for (const item of options.items) {
      if (item instanceof HTMLElement) {
        el.appendChild(item)
      } else {
        el.appendChild(listItem(item))
      }
    }
  })
}

// ---- 空状态 ----

interface EmptyStateOptions {
  text?: string
  icon?: string
}

export function emptyState(options: EmptyStateOptions = {}): HTMLElement {
  return defineWidget('emptyState', 'plugin-empty', (el) => {
    if (options.icon) {
      el.appendChild(createElement('div', { class: 'plugin-empty-icon', text: options.icon }))
    }
    if (options.text) {
      el.appendChild(createElement('div', { text: options.text }))
    }
  })
}

// ---- 开关 ----

interface ToggleOptions {
  checked?: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
}

export function toggle(options: ToggleOptions = {}): HTMLElement {
  let checked = options.checked || false

  return defineWidget('toggle', 'plugin-toggle', (el) => {
    if (checked) el.classList.add('plugin-toggle--checked')
    if (options.disabled) el.classList.add('plugin-toggle--disabled')

    const track = createElement('div', { class: 'plugin-toggle-track' })
    const knob = createElement('div', { class: 'plugin-toggle-knob' })
    track.appendChild(knob)
    el.appendChild(track)

    el.addEventListener('click', () => {
      if (options.disabled) return
      checked = !checked
      el.classList.toggle('plugin-toggle--checked', checked)
      options.onChange?.(checked)
    })
  })
}

// ---- 进度条 ----

interface ProgressOptions {
  percent?: number
  label?: string
  showPercent?: boolean
  class?: string
}

export function progress(options: ProgressOptions = {}): HTMLElement {
  const pct = Math.max(0, Math.min(100, options.percent || 0))

  return defineWidget(
    'progress',
    'plugin-progress',
    (el) => {
      if (options.label || options.showPercent) {
        const header = createElement('div', {
          class: 'plugin-flex plugin-flex-between plugin-mb',
        })
        if (options.label) header.appendChild(createElement('span', { text: options.label }))
        if (options.showPercent !== false) {
          header.appendChild(
            createElement('span', {
              class: 'plugin-text-sm plugin-text-secondary',
              text: `${Math.round(pct)}%`,
            })
          )
        }
        el.appendChild(header)
      }

      const track = createElement('div', { class: 'plugin-progress-track' })
      const fill = createElement('div', {
        class: 'plugin-progress-fill',
        style: { width: `${pct}%` },
      })
      track.appendChild(fill)
      el.appendChild(track)
    },
    { class: options.class }
  )
}

// ---- 分组 ----

interface GroupOptions {
  title?: string
  children?: (HTMLElement | string)[]
  collapsible?: boolean
  defaultExpanded?: boolean
}

export function group(options: GroupOptions = {}): HTMLElement {
  return defineWidget('group', 'plugin-group', (el) => {
    if (!options.title) {
      if (options.children) {
        for (const child of options.children) {
          if (typeof child === 'string') el.appendChild(document.createTextNode(child))
          else el.appendChild(child)
        }
      }
      return
    }

    const header = createElement('div', { class: 'plugin-group-header' })
    header.appendChild(createElement('span', { text: options.title }))

    if (options.collapsible) {
      let expanded = options.defaultExpanded !== false
      const arrow = createElement('span', {
        class: 'plugin-group-header-arrow',
        text: expanded ? '▾' : '▸',
      })
      header.appendChild(arrow)
      header.style.cursor = 'pointer'

      const body = createElement('div', { class: 'plugin-group-body' })
      if (options.children) {
        for (const child of options.children) {
          if (typeof child === 'string') body.appendChild(document.createTextNode(child))
          else body.appendChild(child)
        }
      }
      if (!expanded) body.style.display = 'none'

      header.addEventListener('click', () => {
        expanded = !expanded
        arrow.textContent = expanded ? '▾' : '▸'
        body.style.display = expanded ? '' : 'none'
      })

      el.appendChild(header)
      el.appendChild(body)
    } else {
      el.appendChild(header)
      if (options.children) {
        for (const child of options.children) {
          if (typeof child === 'string') el.appendChild(document.createTextNode(child))
          else el.appendChild(child)
        }
      }
    }
  })
}

// ---- 指标卡 ----

interface MetricOptions {
  label: string
  value: string
  hint?: string
  variant?: BadgeVariant
  class?: string
}

export function metric(options: MetricOptions): HTMLElement {
  return defineWidget(
    'metric',
    'plugin-metric',
    (el) => {
      el.appendChild(createElement('div', { class: 'plugin-metric-value', text: options.value }))
      el.appendChild(createElement('div', { class: 'plugin-metric-label plugin-text-secondary', text: options.label }))
      if (options.hint) {
        el.appendChild(createElement('div', { class: 'plugin-text-sm plugin-text-secondary', text: options.hint }))
      }
      if (options.variant && options.variant !== 'default') {
        el.classList.add(`plugin-metric-${options.variant}`)
      }
    },
    { class: options.class }
  )
}

// ---- 表格 ----

interface TableOptions {
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, string>>
  emptyText?: string
  class?: string
}

export function table(options: TableOptions): HTMLElement {
  return defineWidget(
    'table',
    'plugin-table-wrap',
    (el) => {
      if (options.rows.length === 0) {
        el.appendChild(emptyState({ text: options.emptyText || '暂无数据' }))
        return
      }
      const tableEl = createElement('table', { class: 'plugin-table' })
      const thead = createElement('thead')
      const headerRow = createElement('tr')
      for (const column of options.columns) {
        headerRow.appendChild(createElement('th', { text: column.label }))
      }
      thead.appendChild(headerRow)
      const tbody = createElement('tbody')
      for (const row of options.rows) {
        const tr = createElement('tr')
        for (const column of options.columns) {
          tr.appendChild(createElement('td', { text: row[column.key] ?? '' }))
        }
        tbody.appendChild(tr)
      }
      tableEl.appendChild(thead)
      tableEl.appendChild(tbody)
      el.appendChild(tableEl)
    },
    { class: options.class }
  )
}
