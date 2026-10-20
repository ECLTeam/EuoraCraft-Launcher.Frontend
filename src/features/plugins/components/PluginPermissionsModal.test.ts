import { flushPromises, mount } from '@vue/test-utils'
import { NCheckbox } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginInfo, PluginPermissions } from '@/types/plugins'
import PluginPermissionsModal from './PluginPermissionsModal.vue'

const mocks = vi.hoisted(() => ({ permissions: vi.fn(), updatePermissions: vi.fn() }))
vi.mock('@/features/plugins/api/pluginManagementApi', () => ({ pluginManagementApi: mocks }))

const plugin: PluginInfo = {
  name: 'demo',
  title: 'Demo',
  version: '1',
  description: '',
  author: '',
  icon: '',
  status: 'disabled',
  error: null,
  dependencies: {},
  services: [],
  is_system: false,
  installation_id: 'a'.repeat(32),
}
const view: PluginPermissions = {
  installation_id: 'a'.repeat(32),
  content_digest: 'b'.repeat(64),
  revision: 0,
  grant_epoch: 1,
  error_code: null,
  required_satisfied: false,
  items: [
    {
      capability: 'settings.read',
      required: true,
      decision: 'deny',
      implemented: true,
      resource_refs: [],
      selected_resource_refs: [],
      expires_at: null,
      grant_epoch: 1,
    },
  ],
}

function open() {
  return mount(PluginPermissionsModal, {
    props: { visible: true, plugin },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
}

describe('plugin permission review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions.mockResolvedValue(view)
  })

  it('includes the capability in the checkbox accessible name', async () => {
    const wrapper = open()
    try {
      await flushPromises()
      const checkbox = wrapper.get('[role="checkbox"]')
      const labelId = checkbox.attributes('aria-labelledby')
      expect(wrapper.get(`[id="${labelId}"]`).text()).toContain(i18n.global.t('plugins.capabilities.settings_read'))
    } finally {
      wrapper.unmount()
    }
  })

  it('defaults to deny and submits only once while saving', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.updatePermissions.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const wrapper = open()
    try {
      await flushPromises()
      expect(wrapper.getComponent(NCheckbox).props('checked')).toBe(false)
      await wrapper.getComponent(NCheckbox).vm.$emit('update:checked', true)
      const button = wrapper.findAll('button').find((item) => item.text() === i18n.global.t('plugins.permissionsSave'))!
      await button.trigger('click')
      await button.trigger('click')
      expect(mocks.updatePermissions).toHaveBeenCalledTimes(1)
      expect(mocks.updatePermissions.mock.calls[0]?.[1]).toEqual([
        { capability: 'settings.read', resource_refs: [], decision: 'allow', lifetime: 'permanent' },
      ])
      expect(wrapper.emitted('saved')).toBeUndefined()
      finish?.({ revision: 1, grant_epoch: 2, persisted: true, required_satisfied: true, cleanup_state: 'not_needed' })
      await flushPromises()
      expect(wrapper.emitted('saved')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('ignores a response for a previous installation', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.permissions.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const wrapper = open()
    try {
      await wrapper.setProps({ plugin: { ...plugin, installation_id: 'c'.repeat(32) } })
      await flushPromises()
      finish?.({ ...view, items: [{ ...view.items[0], capability: 'old.installation' }] })
      await flushPromises()
      expect(wrapper.text()).not.toContain('old.installation')
    } finally {
      wrapper.unmount()
    }
  })

  it('reports save failure without emitting a success event and allows reload', async () => {
    mocks.updatePermissions.mockRejectedValue(new Error('disk failure'))
    const wrapper = open()
    try {
      await flushPromises()
      await wrapper
        .findAll('button')
        .find((item) => item.text() === i18n.global.t('plugins.permissionsSave'))!
        .trigger('click')
      await flushPromises()
      expect(wrapper.emitted('saved')).toBeUndefined()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.permissionsSaveFailed'))
      await wrapper
        .findAll('button')
        .find((item) => item.text() === i18n.global.t('common.retry'))!
        .trigger('click')
      await flushPromises()
      expect(mocks.permissions).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })
})
