import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginPermissions } from '@/types/plugins'
import PluginLocalResourceSelector from './PluginLocalResourceSelector.vue'

const mocks = vi.hoisted(() => ({ permissionResources: vi.fn() }))
vi.mock('@/features/plugins/api/pluginManagementApi', () => ({ pluginManagementApi: mocks }))
const view: PluginPermissions = {
  installation_id: 'a'.repeat(32),
  content_digest: 'b'.repeat(64),
  revision: 0,
  grant_epoch: 1,
  required_satisfied: false,
  error_code: null,
  items: [],
}
const candidate = {
  resource_id: 'c'.repeat(32),
  kind: 'java_runtime',
  label: 'Temurin Java 21 x64',
  parent_ref: null,
  version_id: null,
  available: true,
  selected: false,
}
function open() {
  return mount(PluginLocalResourceSelector, {
    props: { view, capability: 'java.read', selected: [], disabled: false },
    global: { plugins: [i18n] },
  })
}

describe('Java permission selection', () => {
  it('lets users clear an unavailable old choice without granting it again', async () => {
    mocks.permissionResources.mockResolvedValue({
      catalog_revision: 8,
      items: [{ ...candidate, available: false, selected: true }],
      next_cursor: null,
    })
    const wrapper = mount(PluginLocalResourceSelector, {
      props: { view, capability: 'java.read', selected: [candidate.resource_id], disabled: false },
      global: { plugins: [i18n] },
    })
    try {
      await flushPromises()
      expect(wrapper.getComponent(NCheckbox).props('disabled')).toBe(true)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(wrapper.emitted('update:selected')).toBeUndefined()
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.resourcesClear'))!
        .trigger('click')
      expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[]])
    } finally {
      wrapper.unmount()
    }
  })
  it('offers explicit account selection without a Java management action', async () => {
    mocks.permissionResources.mockResolvedValue({ catalog_revision: 9, items: [], next_cursor: null })
    const wrapper = mount(PluginLocalResourceSelector, {
      props: { view, capability: 'accounts.read', selected: [], disabled: false },
      global: { plugins: [i18n] },
    })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.accountReadNote'))
      expect(wrapper.text()).toContain(i18n.global.t('plugins.accountResourcesEmpty'))
      expect(wrapper.text()).not.toContain(i18n.global.t('plugins.javaManage'))
      expect(mocks.permissionResources.mock.lastCall?.[0].capability).toBe('accounts.read')
      expect(wrapper.emitted('update:selected')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissionResources.mockResolvedValue({ catalog_revision: 7, items: [candidate], next_cursor: null })
  })
  it('starts unselected and only emits an explicit choice', async () => {
    const wrapper = open()
    try {
      await flushPromises()
      expect(wrapper.getComponent(NCheckbox).props('checked')).toBe(false)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(wrapper.emitted('update:selected')?.[0]).toEqual([[candidate.resource_id]])
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([7])
      expect(mocks.permissionResources.mock.lastCall?.[0].capability).toBe('java.read')
    } finally {
      wrapper.unmount()
    }
  })
  it('drops a late response from another installation', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.permissionResources.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const wrapper = open()
    try {
      await wrapper.setProps({ view: { ...view, installation_id: 'f'.repeat(32) } })
      await flushPromises()
      finish?.({ catalog_revision: 1, items: [{ ...candidate, label: 'stale' }], next_cursor: null })
      await flushPromises()
      expect(wrapper.text()).not.toContain('stale')
      expect(wrapper.emitted('busy')?.at(-1)).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  })
  it('invalidates the reviewed version on failure and allows retry', async () => {
    mocks.permissionResources.mockRejectedValueOnce(new Error('failed'))
    const wrapper = open()
    try {
      await flushPromises()
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([undefined])
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('common.retry'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([7])
    } finally {
      wrapper.unmount()
    }
  })
  it.each(['zh-CN', 'zh-TW', 'en-US', 'de-DE', 'ja-JP', 'ru-RU'] as const)(
    'offers the existing Java manager for an empty registry in %s',
    async (locale) => {
      const previous = i18n.global.locale.value
      i18n.global.locale.value = locale
      mocks.permissionResources.mockResolvedValue({ catalog_revision: 0, items: [], next_cursor: null })
      const wrapper = open()
      try {
        await flushPromises()
        expect(wrapper.text()).toContain(i18n.global.t('plugins.javaResourcesEmpty'))
        await wrapper
          .findAll('button')
          .find((button) => button.text() === i18n.global.t('plugins.javaManage'))!
          .trigger('click')
        expect(wrapper.emitted('manage')).toHaveLength(1)
      } finally {
        wrapper.unmount()
        i18n.global.locale.value = previous
      }
    }
  )
})
