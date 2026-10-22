import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { i18n } from '@/i18n'
import type { ApplicationOperation } from '@/types/operations'
import PluginFileRecoveryModal from './PluginFileRecoveryModal.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  resolve: vi.fn(),
  track: vi.fn(),
  store: { operations: {} as Record<string, ApplicationOperation> },
}))
vi.mock('@/features/plugins/api/pluginManagementApi', () => ({
  pluginManagementApi: { fileRecoveries: mocks.list, resolveFileRecovery: mocks.resolve },
}))
vi.mock('@/features/operations/stores/applicationOperationStore', () => ({
  useApplicationOperationStore: () => ({ operations: mocks.store.operations, track: mocks.track }),
}))
const row = {
  recovery_ref: 'a'.repeat(32),
  name: 'target.bin',
  revision: 1,
  etag: 'b'.repeat(64),
  state: 'conflict',
  actions: ['save_as', 'discard'],
}

function open() {
  return mount(PluginFileRecoveryModal, {
    props: { visible: true },
    global: { plugins: [i18n], stubs: { Teleport: true } },
  })
}

describe('file recovery dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue({ items: [row], next_cursor: null })
    mocks.store.operations = reactive<Record<string, ApplicationOperation>>({})
    mocks.track.mockResolvedValue(undefined)
  })
  it('ignores a stale response after closing and reopening', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const wrapper = open()
    try {
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })
      await flushPromises()
      finish?.({ items: [{ ...row, name: 'stale.bin' }], next_cursor: null })
      await flushPromises()
      expect(wrapper.text()).toContain('target.bin')
      expect(wrapper.text()).not.toContain('stale.bin')
    } finally {
      wrapper.unmount()
    }
  })
  it('submits only once, tracks application work, and waits for its actual result', async () => {
    let accept: ((value: unknown) => void) | undefined
    mocks.resolve.mockReturnValue(
      new Promise((resolve) => {
        accept = resolve
      })
    )
    const wrapper = open()
    try {
      await flushPromises()
      await wrapper.get('input').setValue('restored.bin')
      const save = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.fileRecoverySaveAs'))!
      await save.trigger('click')
      await save.trigger('click')
      expect(mocks.resolve).toHaveBeenCalledTimes(1)
      expect(mocks.resolve).toHaveBeenCalledWith({
        recovery_ref: row.recovery_ref,
        expected_revision: 1,
        expected_etag: row.etag,
        action: 'save_as',
        saved_name: 'restored.bin',
      })
      accept?.({ operationId: 'c'.repeat(32), status: 'pending' })
      await flushPromises()
      expect(mocks.track).toHaveBeenCalledTimes(1)
      expect(wrapper.text()).not.toContain(i18n.global.t('plugins.fileRecoveryCompleted'))
      mocks.store.operations['c'.repeat(32)] = { operationId: 'c'.repeat(32), status: 'completed' }
      mocks.list.mockResolvedValue({ items: [], next_cursor: null })
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.fileRecoveryCompleted'))
      expect(
        wrapper
          .findAll('button')
          .find((button) => button.text() === i18n.global.t('common.close'))!
          .attributes('disabled')
      ).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
  it('keeps the same choices available after a failed submission', async () => {
    mocks.resolve.mockRejectedValue(new Error('unconfirmed'))
    const wrapper = open()
    try {
      await flushPromises()
      await wrapper.get('input').setValue('restored.bin')
      const save = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('plugins.fileRecoverySaveAs'))!
      await save.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(i18n.global.t('plugins.fileRecoverySubmitFailed'))
      expect(save.attributes('disabled')).toBeUndefined()
      await save.trigger('click')
      await flushPromises()
      expect(mocks.resolve).toHaveBeenCalledTimes(2)
    } finally {
      wrapper.unmount()
    }
  })
})
