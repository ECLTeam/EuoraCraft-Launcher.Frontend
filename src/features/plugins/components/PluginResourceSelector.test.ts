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
  revision: 1,
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
}
const child: PluginResourceCandidate = {
  resource_id: 'd'.repeat(32),
  kind: 'instance',
  label: 'One',
  parent_ref: root.resource_id,
  version_id: 'One',
  available: true,
  selected: false,
}
function open(selected: string[] = []) {
  return mount(PluginResourceSelector, {
    props: { view, selected, disabled: false, capability: 'instances.read' },
    global: { plugins: [i18n] },
  })
}

describe('instance resource selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissionResources.mockResolvedValue({ catalog_revision: 2, items: [root], next_cursor: null })
  })

  it('installation selects only a game root and does not offer browsing or implied read scope', async () => {
    const wrapper = mount(PluginResourceSelector, {
      props: { view, selected: [], disabled: false, capability: 'instances.install' },
      global: { plugins: [i18n] },
    })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.installResourcesNote'))
      expect(wrapper.text()).toContain(i18n.global.t('plugins.installResourcesRootLabel', { name: root.label }))
      expect(
        wrapper.findAll('button').some((button) => button.text() === i18n.global.t('plugins.resourcesBrowse'))
      ).toBe(false)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(wrapper.emitted('update:selected')?.[0]).toEqual([[root.resource_id]])
      expect(mocks.permissionResources.mock.calls[0]?.[0].capability).toBe('instances.install')
    } finally {
      wrapper.unmount()
    }
  })

  it.each(['instances.write', 'instances.launch', 'instances.stop'] as const)(
    '%s requires an explicit instance and cannot select the parent folder',
    async (capability) => {
      const wrapper = mount(PluginResourceSelector, {
        props: { view, selected: [], disabled: false, capability },
        global: { plugins: [i18n] },
      })
      try {
        await flushPromises()
        expect(wrapper.findAllComponents(NCheckbox)).toHaveLength(0)
        mocks.permissionResources.mockResolvedValue({ catalog_revision: 3, items: [child], next_cursor: null })
        await wrapper
          .findAll('button')
          .find((button) => button.text() === i18n.global.t('plugins.resourcesBrowse'))!
          .trigger('click')
        await flushPromises()
        expect(wrapper.findAllComponents(NCheckbox)).toHaveLength(1)
        const hintByCapability = {
          'instances.write': 'plugins.writeResourcesInstanceHint',
          'instances.launch': 'plugins.launchResourcesInstanceHint',
          'instances.stop': 'plugins.stopResourcesInstanceHint',
        }
        expect(wrapper.text()).toContain(i18n.global.t(hintByCapability[capability]))
        expect(wrapper.text()).not.toContain(i18n.global.t('plugins.resourcesInstanceHint'))
        await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
        expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[child.resource_id]])
      } finally {
        wrapper.unmount()
      }
    }
  )

  it('starts unselected and choosing one item preserves choices on other pages', async () => {
    const wrapper = open(['e'.repeat(32)])
    try {
      await flushPromises()
      expect(wrapper.getComponent(NCheckbox).props('checked')).toBe(false)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(wrapper.emitted('update:selected')?.[0]).toEqual([['e'.repeat(32), root.resource_id]])
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([2])
    } finally {
      wrapper.unmount()
    }
  })

  it('distinguishes directory scope and disables covered child choices', async () => {
    const wrapper = open([root.resource_id])
    try {
      await flushPromises()
      mocks.permissionResources.mockResolvedValue({ catalog_revision: 3, items: [child], next_cursor: null })
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.resourcesBrowse'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.resourcesCovered'))
      expect(wrapper.findAllComponents(NCheckbox).at(-1)?.props('disabled')).toBe(true)
      expect(mocks.permissionResources.mock.calls.at(-1)?.[0].parent_ref).toBe(root.resource_id)
    } finally {
      wrapper.unmount()
    }
  })

  it('ignores an old installation response and releases its busy state', async () => {
    let finish: ((page: unknown) => void) | undefined
    mocks.permissionResources.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const wrapper = open()
    try {
      await wrapper.setProps({ view: { ...view, installation_id: 'f'.repeat(32) } })
      await flushPromises()
      finish?.({ catalog_revision: 1, items: [{ ...root, label: 'stale' }], next_cursor: null })
      await flushPromises()
      expect(wrapper.text()).not.toContain('stale')
      expect(wrapper.emitted('busy')?.at(-1)).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  })

  it('failure invalidates the reviewed resource version and permits retry', async () => {
    mocks.permissionResources.mockRejectedValueOnce(new Error('changed'))
    const wrapper = open()
    try {
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.resourcesLoadFailed'))
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([undefined])
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('common.retry'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(root.label)
      expect(wrapper.emitted('revision')?.at(-1)).toEqual([2])
    } finally {
      wrapper.unmount()
    }
  })

  it('does not reselect an unavailable resource and clears all hidden choices', async () => {
    mocks.permissionResources.mockResolvedValue({
      catalog_revision: 2,
      items: [{ ...root, available: false }],
      next_cursor: null,
    })
    const wrapper = open([root.resource_id, child.resource_id])
    try {
      await flushPromises()
      expect(wrapper.getComponent(NCheckbox).props('disabled')).toBe(true)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.resourcesClear'))!
        .trigger('click')
      expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[]])
    } finally {
      wrapper.unmount()
    }
  })
  it('allows browsing a write directory but only selects concrete instances', async () => {
    const wrapper = mount(PluginResourceSelector, {
      props: { view, selected: [], disabled: false, capability: 'instances.write' },
      global: { plugins: [i18n] },
    })
    try {
      await flushPromises()
      expect(wrapper.findAllComponents(NCheckbox)).toHaveLength(0)
      expect(mocks.permissionResources.mock.calls[0]?.[0].capability).toBe('instances.write')
      mocks.permissionResources.mockResolvedValue({ catalog_revision: 3, items: [child], next_cursor: null })
      await wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.resourcesBrowse'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.findAllComponents(NCheckbox)).toHaveLength(1)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([[child.resource_id]])
    } finally {
      wrapper.unmount()
    }
  })
})
