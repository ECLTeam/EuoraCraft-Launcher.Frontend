import { flushPromises, mount } from '@vue/test-utils'
import { NRadioGroup } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { PluginInfo, PluginPermissions } from '@/types/plugins'
import PluginPermissionsModal from './PluginPermissionsModal.vue'
import PluginResourceSelector from './PluginResourceSelector.vue'
const mocks = vi.hoisted(() => ({
  permissions: vi.fn(),
  updatePermissions: vi.fn(),
  permissionResources: vi.fn(),
  enableReviewed: vi.fn(),
}))
vi.mock('@/features/plugins/api/pluginManagementApi', () => ({ pluginManagementApi: mocks }))
vi.mock('@/features/plugins/stores/pluginStore', () => ({
  usePluginStore: () => ({ enableReviewed: mocks.enableReviewed }),
}))
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
const item = {
  required: false,
  decision: 'deny' as const,
  implemented: true,
  resource_refs: [],
  selected_resource_refs: [],
  requested_resource_refs: [],
  expires_at: null,
  grant_epoch: 1,
}
const view: PluginPermissions = {
  installation_id: plugin.installation_id!,
  content_digest: 'b'.repeat(64),
  revision: 0,
  grant_epoch: 1,
  error_code: null,
  required_satisfied: false,
  items: [
    { ...item, capability: 'instances.read', required: true },
    { ...item, capability: 'instances.manage' },
  ],
}
const rootId = 'c'.repeat(32)
const result = { revision: 1, grant_epoch: 2, persisted: true, required_satisfied: true, cleanup_state: 'complete' }
function open(target = plugin) {
  return mount(PluginPermissionsModal, {
    props: { visible: true, plugin: target },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
}
function primary(wrapper: ReturnType<typeof open>) {
  return wrapper
    .findAll('button')
    .find((button) =>
      [
        i18n.global.t('plugins.agreeAndEnable'),
        i18n.global.t('plugins.retryEnable'),
        i18n.global.t('plugins.permissionsSave'),
      ].includes(button.text())
    )!
}
describe('simplified plugin permission review', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.permissions.mockResolvedValue(view)
    mocks.updatePermissions.mockResolvedValue(result)
    mocks.enableReviewed.mockResolvedValue({ status: 'success', value: undefined })
    mocks.permissionResources.mockResolvedValue({
      catalog_revision: 2,
      items: [
        {
          resource_id: rootId,
          kind: 'instance_root',
          label: 'Games',
          parent_ref: null,
          version_id: null,
          available: true,
          selected: false,
          is_default: true,
        },
      ],
      next_cursor: null,
    })
  })
  it('shares one game selector and saves before enabling with the original reviewed identity', async () => {
    const wrapper = open()
    try {
      await flushPromises()
      expect(wrapper.findAllComponents(PluginResourceSelector)).toHaveLength(1)
      await wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'manage')
      await flushPromises()
      await primary(wrapper).trigger('click')
      await flushPromises()
      const choices = mocks.updatePermissions.mock.calls[0]![1]
      expect(choices).toEqual([
        { capability: 'instances.read', decision: 'allow', resource_refs: [rootId], lifetime: 'permanent' },
        { capability: 'instances.manage', decision: 'allow', resource_refs: [rootId], lifetime: 'permanent' },
      ])
      expect(mocks.enableReviewed).toHaveBeenCalledWith(
        plugin,
        expect.objectContaining({ installation_id: plugin.installation_id, revision: 1, required_satisfied: true })
      )
      expect(mocks.updatePermissions.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.enableReviewed.mock.invocationCallOrder[0]!
      )
      expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  })
  it('uses one action while saving and never enables if saving fails', async () => {
    let reject!: (reason: Error) => void
    mocks.updatePermissions.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail
        })
    )
    const wrapper = open()
    try {
      await flushPromises()
      await primary(wrapper).trigger('click')
      await primary(wrapper).trigger('click')
      expect(mocks.updatePermissions).toHaveBeenCalledTimes(1)
      reject(new Error('save failed'))
      await flushPromises()
      expect(mocks.enableReviewed).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.permissionsSaveFailed'))
    } finally {
      wrapper.unmount()
    }
  })
  it('retains saved permission and retries enabling without resubmitting unchanged choices', async () => {
    mocks.enableReviewed.mockRejectedValueOnce(new Error('startup failed'))
    const wrapper = open()
    try {
      await flushPromises()
      await primary(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.savedButEnableFailed'))
      expect(wrapper.findAllComponents(PluginResourceSelector)).toHaveLength(1)
      await primary(wrapper).trigger('click')
      await flushPromises()
      expect(mocks.updatePermissions).toHaveBeenCalledTimes(1)
      expect(mocks.enableReviewed).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })
  it('saves an enabled plugin without trying to enable or restart it', async () => {
    const wrapper = open({ ...plugin, status: 'enabled' })
    try {
      await flushPromises()
      await primary(wrapper).trigger('click')
      await flushPromises()
      expect(mocks.updatePermissions).toHaveBeenCalledOnce()
      expect(mocks.enableReviewed).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
  it('keeps pending cleanup visible after access is revoked', async () => {
    mocks.permissions.mockResolvedValue({ ...view, revision: 1 })
    mocks.updatePermissions.mockResolvedValue({ ...result, cleanup_state: 'pending' })
    const wrapper = open({ ...plugin, status: 'enabled' })
    try {
      await flushPromises()
      const revoke = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.permissionsRevoke'))!
      await revoke.trigger('click')
      await flushPromises()
      expect(mocks.updatePermissions).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ capability: 'instances.manage', decision: 'deny', resource_refs: [] }),
        ]),
        expect.anything()
      )
      expect(wrapper.text()).toContain(i18n.global.t('plugins.permissionsCleanupPending'))
      expect(mocks.enableReviewed).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
  it('does not submit game access without an explicitly displayed valid directory', async () => {
    mocks.permissionResources.mockResolvedValue({ catalog_revision: 2, items: [], next_cursor: null })
    const wrapper = open()
    try {
      await flushPromises()
      expect(primary(wrapper).attributes('disabled')).toBeDefined()
      await primary(wrapper).trigger('click')
      expect(mocks.updatePermissions).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
  it('does not enable a replacement plugin after an old save completes', async () => {
    let finish!: (value: typeof result) => void
    mocks.updatePermissions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const wrapper = open()
    try {
      await flushPromises()
      await primary(wrapper).trigger('click')
      const next = { ...plugin, name: 'other', installation_id: 'd'.repeat(32) }
      mocks.permissions.mockResolvedValue({ ...view, installation_id: next.installation_id })
      await wrapper.setProps({ plugin: next })
      await flushPromises()
      finish(result)
      await flushPromises()
      expect(mocks.enableReviewed).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
  it.each(['zh-CN', 'zh-TW', 'en-US', 'de-DE', 'ja-JP', 'ru-RU'] as const)(
    'shows understandable game management in %s',
    async (locale) => {
      const previous = i18n.global.locale.value
      i18n.global.locale.value = locale
      const wrapper = open()
      try {
        await flushPromises()
        await wrapper.getComponent(NRadioGroup).vm.$emit('update:value', 'manage')
        await flushPromises()
        expect(wrapper.text()).toContain(i18n.global.t('plugins.capabilities.instances_manage'))
        expect(wrapper.text()).toContain(i18n.global.t('plugins.manageAccessNote'))
        expect(wrapper.text()).not.toContain('instances.manage')
      } finally {
        wrapper.unmount()
        i18n.global.locale.value = previous
      }
    }
  )
})
