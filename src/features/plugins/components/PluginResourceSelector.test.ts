import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginPermissions, PluginResourceCandidate } from '@/types/plugins'
import PluginResourceSelector from './PluginResourceSelector.vue'
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
const root: PluginResourceCandidate = {
  resource_id: 'c'.repeat(32),
  kind: 'instance_root',
  label: 'Games',
  parent_ref: null,
  version_id: null,
  available: true,
  selected: false,
  is_default: true,
}
function open(revision = 0, selected: string[] = []) {
  return mount(PluginResourceSelector, {
    props: { view: { ...view, revision }, selected, disabled: false, capability: 'instances.manage' },
    global: { plugins: [i18n] },
  })
}
describe('game root selection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.permissionResources.mockResolvedValue({ catalog_revision: 2, items: [root], next_cursor: null })
  })
  it('displays and recommends the current root once on first review', async () => {
    const wrapper = open()
    try {
      await flushPromises()
      expect(wrapper.emitted('update:selected')?.[0]).toEqual([[root.resource_id]])
      expect(wrapper.text()).toContain(i18n.global.t('plugins.currentGameDirectory'))
      await wrapper
        .findAll('button')
        .find((b) => b.text() === i18n.global.t('common.refresh'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.emitted('update:selected')).toHaveLength(1)
      expect(mocks.permissionResources.mock.calls[0]![0]).not.toHaveProperty('parent_ref')
    } finally {
      wrapper.unmount()
    }
  })
  it('preserves an existing denial instead of reselecting the default directory', async () => {
    const wrapper = open(1)
    try {
      await flushPromises()
      expect(wrapper.emitted('update:selected')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
  it('selects a root once without offering separate instance browsing', async () => {
    const wrapper = open(1, ['d'.repeat(32)])
    try {
      await flushPromises()
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['d'.repeat(32), root.resource_id]])
      expect(wrapper.findAll('button').some((b) => b.text() === i18n.global.t('plugins.resourcesBrowse'))).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
  it('ignores a previous installation response and releases busy state', async () => {
    let finish!: (value: unknown) => void
    mocks.permissionResources.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const wrapper = open(1)
    try {
      await wrapper.setProps({ view: { ...view, installation_id: 'd'.repeat(32), revision: 1 } })
      await flushPromises()
      finish({ catalog_revision: 1, items: [{ ...root, label: 'Old' }], next_cursor: null })
      await flushPromises()
      expect(wrapper.text()).not.toContain('Old')
      expect(wrapper.emitted('busy')?.at(-1)).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  })
  it('retains the error and provides a retry without granting anything', async () => {
    mocks.permissionResources.mockRejectedValueOnce(new Error('read failed'))
    const wrapper = open(1)
    try {
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.resourcesLoadFailed'))
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([undefined])
      await wrapper
        .findAll('button')
        .find((b) => b.text() === i18n.global.t('common.retry'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([2])
    } finally {
      wrapper.unmount()
    }
  })
})
