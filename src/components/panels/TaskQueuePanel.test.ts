import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { pinia } from '@/app/stores'
import { globalTaskQueue, useTaskQueueStore } from '@/composables/useTaskQueue'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { i18n } from '@/i18n'
import TaskQueuePanel from './TaskQueuePanel.vue'

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}))

beforeEach(() => {
  useTaskQueueStore(pinia).tasks = []
  useApplicationOperationStore().operations = {}
})

it('通过 store 展开只读任务，并在点击与键盘操作后显示真实失败原因', async () => {
  const id = globalTaskQueue.addTask({ type: 'download', name: 'file', versionId: '', loaderType: '' })
  globalTaskQueue.updateTask(id, { status: 'running', message: 'network stalled' })
  const wrapper = mount(TaskQueuePanel, {
    global: {
      plugins: [i18n],
      stubs: { FullscreenModal: { template: '<div><slot /></div>' }, PluginSlotHost: true, UiIcon: true },
    },
  })
  await wrapper.get('.tq-task-header').trigger('click')
  await flushPromises()
  expect(wrapper.get('.tq-task-message').text()).toContain('network stalled')
  await wrapper.get('.tq-task-header').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  expect(wrapper.find('.tq-task-message').exists()).toBe(false)
  globalTaskQueue.updateTask(id, { status: 'error', message: 'disk full' })
  await flushPromises()
  expect(wrapper.get('.tq-task-message').text()).toContain('disk full')
  wrapper.unmount()
})
