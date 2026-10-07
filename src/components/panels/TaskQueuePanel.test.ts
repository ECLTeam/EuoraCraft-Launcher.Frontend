import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { pinia } from '@/app/stores'
import { globalTaskQueue, useTaskQueueStore } from '@/composables/useTaskQueue'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { i18n } from '@/i18n'
import TaskQueuePanel from './TaskQueuePanel.vue'

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}))

enableAutoUnmount(afterEach)

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  useTaskQueueStore(pinia).tasks = []
  useApplicationOperationStore().operations = {}
})

afterEach(() => vi.restoreAllMocks())

function render() {
  return mount(TaskQueuePanel, {
    global: {
      plugins: [i18n],
      stubs: { FullscreenModal: { template: '<div><slot /></div>' }, PluginSlotHost: true, UiIcon: true },
    },
  })
}

it('Java 任务使用中文名称，分数进度在列表与实时详情中显示为一致的整数', () => {
  useApplicationOperationStore().accept({
    operationId: 'java-install',
    kind: 'java_install',
    status: 'running',
    percent: 5.506119051055595,
    speed: 607 * 1024,
    message: '正在下载 Java',
  })
  const wrapper = render()
  expect(wrapper.get('.tq-task-name').text()).toBe('安装 Java')
  expect(wrapper.get('.tq-progress-text').text()).toBe('6%')
  expect(wrapper.get('.tq-live-pct').text()).toBe('6%')
  expect(wrapper.get('.tq-task-progress [role="progressbar"]').attributes('aria-valuenow')).toBe('6')
})

it.each([
  ['running', 99.99, '100%'],
  ['pending', 0, '...'],
  ['completed', 0, '100%'],
] as const)('任务 %s 的 %s 进度显示为 %s', (status, progress, expected) => {
  const id = globalTaskQueue.addTask({ type: 'operation', name: '安装 Java', versionId: '', loaderType: '' })
  globalTaskQueue.updateTask(id, { status, progress })
  expect(render().get('.tq-progress-text').text()).toBe(expected)
})

it('取消操作不会触发展开详情，等待执行方停止前保留运行状态', async () => {
  const store = useApplicationOperationStore()
  store.accept({ operationId: 'cancel-java', kind: 'java_install', status: 'running', percent: 20 })
  const cancel = vi.spyOn(store, 'cancel').mockResolvedValue(true)
  const wrapper = render()
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '取消')!
    .trigger('click')
  await flushPromises()
  expect(cancel).toHaveBeenCalledWith('cancel-java')
  expect(wrapper.get('.tq-task-header').attributes('aria-expanded')).toBe('false')
  expect(useTaskQueueStore(pinia).tasks[0]?.status).toBe('running')
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
