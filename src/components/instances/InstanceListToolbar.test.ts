import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NPopover } from 'naive-ui'
import { afterEach, describe, expect, it } from 'vitest'
import UiIcon from '@/components/ui/Icon.vue'
import { i18n, supportedLocales } from '@/i18n'
import InstanceListToolbar from './InstanceListToolbar.vue'

enableAutoUnmount(afterEach)

function mountToolbar() {
  return mount(InstanceListToolbar, {
    attachTo: document.body,
    global: { plugins: [i18n], components: { UiIcon } },
    props: {
      pathName: '默认路径',
      totalCount: 3,
      filteredCount: 3,
      categories: [{ id: 'modded', name: '模组', color: '#abc', order: 0, builtin: false }],
      refreshLoading: false,
      viewMode: 'list',
      sortKey: 'name',
      sortDirection: 'asc',
      searchQuery: '',
      favoritesOnly: false,
      pinnedOnly: false,
      showHidden: false,
      categoryId: '',
    },
  })
}

function control(selector: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Missing control: ${selector}`)
  return new DOMWrapper(element)
}

async function openFilter(wrapper: ReturnType<typeof mountToolbar>) {
  await wrapper.get('.filter-toggle').trigger('click')
  await flushPromises()
}

describe('InstanceListToolbar', () => {
  it('组合筛选显示计数，清除仅重置筛选条件', async () => {
    const wrapper = mountToolbar()
    await wrapper.setProps({ searchQuery: 'fabric' })
    await openFilter(wrapper)
    for (let index = 1; index <= 3; index++) {
      await control(`.filter-panel .filter-options label:nth-child(${index}) input`).setValue(true)
    }
    await control('.category-options input[value="modded"]').setValue()
    expect(wrapper.get('.filter-count').text()).toBe('4')
    expect(wrapper.get('.filter-toggle').attributes('aria-expanded')).toBe('true')
    const clear = [...document.querySelectorAll<HTMLButtonElement>('.toolbar-popover-footer button')].find((button) =>
      button.textContent?.includes('清除筛选')
    )!
    await new DOMWrapper(clear).trigger('click')
    expect(wrapper.find('.filter-count').exists()).toBe(false)
    expect(wrapper.emitted('update:favoritesOnly')).toEqual([[true], [false]])
    expect(wrapper.emitted('update:categoryId')).toEqual([['modded'], ['']])
    expect(wrapper.emitted('update:searchQuery')).toBeUndefined()
    expect(wrapper.emitted('sort')).toBeUndefined()
    expect(wrapper.emitted('update:viewMode')).toBeUndefined()
  })

  it('排序和筛选互斥，Escape 关闭并恢复焦点', async () => {
    const wrapper = mountToolbar()
    await openFilter(wrapper)
    await wrapper.get('.sort-toggle').trigger('click')
    await flushPromises()
    expect(wrapper.findAllComponents(NPopover).map((popover) => popover.props('show'))).toEqual([false, true])
    await control('.sort-panel').trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('.sort-toggle').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('.sort-toggle').element)
  })

  it('管理分类先关闭弹层，再发出原管理事件', async () => {
    const wrapper = mountToolbar()
    await openFilter(wrapper)
    await control('.toolbar-popover-footer button').trigger('click')
    expect(wrapper.emitted('manageCategories')).toEqual([[]])
    expect(wrapper.get('.filter-toggle').attributes('aria-expanded')).toBe('false')
  })

  it('五种排序选择与方向向父组件传递完整排序设置', async () => {
    const wrapper = mountToolbar()
    await wrapper.get('.sort-toggle').trigger('click')
    await flushPromises()
    const keys = ['lastLaunchedAt', 'totalRunDurationSeconds', 'launchCount', 'name', 'gameVersion']
    for (const key of keys) await control(`.sort-panel input[value="${key}"]`).setValue()
    await control('.sort-directions button:last-child').trigger('click')
    expect(wrapper.emitted('sort')).toEqual([...keys.map((key) => [key, 'asc']), ['name', 'desc']])
  })

  it('搜索清除和刷新禁用保持原行为', async () => {
    const wrapper = mountToolbar()
    await wrapper.get('.search-input').setValue('fabric')
    expect(wrapper.emitted('update:searchQuery')).toEqual([['fabric']])
    await wrapper.get('.search-clear').trigger('click')
    expect(wrapper.emitted('update:searchQuery')?.at(-1)).toEqual([''])
    await wrapper.setProps({ refreshLoading: true })
    expect(wrapper.get('.refresh-button').attributes('disabled')).toBeDefined()
    await wrapper.get('.refresh-button').trigger('click')
    expect(wrapper.emitted('refresh')).toBeUndefined()
    await wrapper.setProps({ refreshLoading: false })
    await wrapper.get('.refresh-button').trigger('click')
    await wrapper.get('.install-button').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[]])
    expect(wrapper.emitted('install')).toEqual([[]])
  })

  it.each(supportedLocales)('$code 工具栏文案完整', ({ code }) => {
    const messages = i18n.global.getLocaleMessage(code)
    expect(Object.keys(messages.versions.manage.toolbar)).toHaveLength(22)
    expect(
      Object.values(messages.versions.manage.toolbar).every((value) => typeof value === 'string' && value.length > 0)
    ).toBe(true)
  })
})
