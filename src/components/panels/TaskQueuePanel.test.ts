import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { pinia } from '@/app/stores'
import { globalTaskQueue, useTaskQueueStore } from '@/composables/useTaskQueue'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { i18n } from '@/i18n'
import { installationFixture } from '@/types/installation.fixture'
import TaskQueuePanel from './TaskQueuePanel.vue'

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: vi.fn(), success: vi.fn() }),
}))

enableAutoUnmount(afterEach)

beforeEach(() => {
  i18n.global.locale.value = 'zh-CN'
  useTaskQueueStore(pinia).tasks = []
  globalTaskQueue.panelVisible.value = false
  useApplicationOperationStore().operations = {}
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function downloadTask(name: string, speed?: number) {
  const id = globalTaskQueue.addTask({ type: 'download', name, versionId: '', loaderType: '' })
  globalTaskQueue.updateTask(id, {
    status: 'running',
    progressType: 'bytes',
    done: 10,
    total: 100,
    speedBytesPerSecond: speed,
  })
  return id
}

function cardFor(wrapper: VueWrapper, name: string) {
  return wrapper.findAll('.tq-task').find((card) => card.get('.tq-task-name').text() === name)!
}

it('网速曲线和唯一速度数字放在任务卡顶部，仅保留一条进度条', () => {
  downloadTask('Download', 1024)
  const wrapper = render()
  expect(wrapper.find('.tq-live').exists()).toBe(false)
  expect(wrapper.get('.tq-task-top .tq-task-speed').text()).toBe('1.0 KB/s')
  expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(1)
  expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('Download')
  expect(wrapper.get('.tq-task-stats').text()).not.toContain('KB/s')
})

it('多任务独立采样，普通进度更新和插入任务不清空已有曲线', async () => {
  vi.useFakeTimers()
  const first = downloadTask('First', 1024)
  downloadTask('Second', 2048)
  const wrapper = render()
  expect(vi.getTimerCount()).toBe(1)
  globalTaskQueue.updateTask(first, { progress: 40, speedBytesPerSecond: 512 })
  await vi.advanceTimersByTimeAsync(1000)
  const firstLine = cardFor(wrapper, 'First').get('.tq-speed-line').attributes('d')
  expect(firstLine).not.toBe(cardFor(wrapper, 'Second').get('.tq-speed-line').attributes('d'))
  expect(cardFor(wrapper, 'First').get('.tq-speed-value').text()).toBe('512 B/s')
  downloadTask('Third', 300)
  await nextTick()
  expect(cardFor(wrapper, 'First').get('.tq-speed-line').attributes('d')).toBe(firstLine)
  expect(vi.getTimerCount()).toBe(1)
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('未知速度不绘制假数据，零速度显示为零，关闭再打开重新采样', async () => {
  vi.useFakeTimers()
  const id = downloadTask('Download')
  const wrapper = render()
  expect(wrapper.get('.tq-speed-value').text()).toBe('—')
  expect(wrapper.find('.tq-speed-line').exists()).toBe(false)
  globalTaskQueue.updateTask(id, { speedBytesPerSecond: 0 })
  await vi.advanceTimersByTimeAsync(1000)
  expect(wrapper.get('.tq-speed-value').text()).toBe('0 B/s')
  globalTaskQueue.panelVisible.value = false
  await nextTick()
  expect(vi.getTimerCount()).toBe(0)
  globalTaskQueue.updateTask(id, { speedBytesPerSecond: 2048 })
  globalTaskQueue.panelVisible.value = true
  await nextTick()
  expect(wrapper.find('.tq-speed-line').exists()).toBe(false)
  expect(wrapper.get('.tq-speed-value').text()).toBe('2.0 KB/s')
  expect(vi.getTimerCount()).toBe(1)
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('切换下载步骤只清空对应任务，结束后停止采样', async () => {
  vi.useFakeTimers()
  const id = globalTaskQueue.addTask({ type: 'install', name: 'Minecraft', versionId: '', loaderType: '' })
  const installation = installationFixture()
  globalTaskQueue.updateTask(id, { status: 'running', installation })
  const other = downloadTask('Other', 1024)
  const wrapper = render()
  await vi.advanceTimersByTimeAsync(1000)
  const otherLine = cardFor(wrapper, 'Other').get('.tq-speed-line').attributes('d')
  installation.revision++
  installation.currentStageId = 'finalize_install'
  installation.stages[1]!.status = 'completed'
  installation.stages[2]!.status = 'running'
  installation.stages[2]!.download = {
    completedFiles: 0,
    totalFiles: 1,
    transferredBytes: 0,
    speedBytesPerSecond: 60,
  }
  globalTaskQueue.updateTask(id, { installation })
  await nextTick()
  expect(cardFor(wrapper, 'Minecraft').find('.tq-speed-line').exists()).toBe(false)
  expect(cardFor(wrapper, 'Minecraft').get('.tq-speed-value').text()).toBe('60.0 B/s')
  expect(cardFor(wrapper, 'Other').get('.tq-speed-line').attributes('d')).toBe(otherLine)
  globalTaskQueue.updateTask(id, { status: 'error' })
  await nextTick()
  expect(cardFor(wrapper, 'Minecraft').find('.tq-task-speed').exists()).toBe(false)
  expect(vi.getTimerCount()).toBe(1)
  globalTaskQueue.updateTask(other, { status: 'completed' })
  await nextTick()
  expect(vi.getTimerCount()).toBe(0)
})

it('每项仅保留最近60个样本，移除下载任务后清理定时器', async () => {
  vi.useFakeTimers()
  const id = downloadTask('Download', 2048)
  const wrapper = render()
  await wrapper.get('.tq-task-header').trigger('click')
  await vi.advanceTimersByTimeAsync(59000)
  expect(wrapper.get('.tq-speed-details').text()).toContain('60')
  expect(wrapper.get('.tq-speed-details').text()).toContain('2.0 KB/s')
  globalTaskQueue.updateTask(id, { speedBytesPerSecond: 1024 })
  await vi.advanceTimersByTimeAsync(60000)
  expect(wrapper.get('.tq-speed-details').text()).toContain('60')
  expect(wrapper.get('.tq-speed-details').text()).toContain('1.0 KB/s')
  expect(wrapper.get('.tq-speed-details').text()).not.toContain('2.0 KB/s')
  useTaskQueueStore(pinia).tasks = []
  await nextTick()
  expect(vi.getTimerCount()).toBe(0)
})

it('安装步骤保留真实比例，未知总量持续显示传输量，处理阶段隐藏网速', async () => {
  const id = globalTaskQueue.addTask({ type: 'install', name: 'NeoForge', versionId: '', loaderType: '' })
  const installation = installationFixture()
  globalTaskQueue.updateTask(id, { status: 'running', installation })
  const wrapper = render()
  expect(wrapper.get('.tq-progress-text').text()).toBe('60%')
  expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(1)
  expect(wrapper.get('.tq-task-phase').text()).toBe('下载游戏文件')
  installation.revision++
  installation.stages[1]!.progress = { unit: 'unknown', completed: 60, total: null }
  globalTaskQueue.updateTask(id, { installation })
  await flushPromises()
  expect(wrapper.get('.tq-progress-text').text()).toBe('—')
  expect(wrapper.get('.tq-task-stats').text()).toContain('已传输')
  expect(wrapper.get('.tq-task-progress [role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
  installation.revision++
  installation.currentStageId = 'finalize_install'
  installation.stages[1]!.status = 'completed'
  installation.stages[1]!.download!.speedBytesPerSecond = 0
  installation.stages[2]!.status = 'running'
  installation.stages[2]!.progress = { unit: 'unknown', completed: 0, total: null }
  globalTaskQueue.updateTask(id, { installation })
  await flushPromises()
  expect(wrapper.find('.tq-task-speed').exists()).toBe(false)
  expect(wrapper.get('.tq-task-phase').text()).toBe('完成安装')
})

it('旧快照不能覆盖新步骤，终态后迟到事件无效', () => {
  const id = globalTaskQueue.addTask({ type: 'install', name: 'Minecraft', versionId: '', loaderType: '' })
  globalTaskQueue.updateTask(id, { status: 'running', installation: installationFixture({ revision: 3 }) })
  globalTaskQueue.updateTask(id, { status: 'running', installation: installationFixture({ revision: 2 }) })
  expect(globalTaskQueue.tasks.value[0]?.installation?.revision).toBe(3)
  globalTaskQueue.updateTask(id, {
    status: 'completed',
    installation: installationFixture({ revision: 4, status: 'completed' }),
  })
  globalTaskQueue.updateTask(id, { status: 'running', installation: installationFixture({ revision: 5 }) })
  expect(globalTaskQueue.tasks.value[0]?.status).toBe('completed')
})

function render() {
  globalTaskQueue.panelVisible.value = true
  return mount(TaskQueuePanel, {
    global: {
      plugins: [i18n],
      stubs: { FullscreenModal: { template: '<div><slot /></div>' }, PluginSlotHost: true, UiIcon: true },
    },
  })
}

it.each(['completed', 'error', 'canceled'] as const)('结束后的 %s 子阶段显示最终结果并停止转圈', async (status) => {
  const id = globalTaskQueue.addTask({ type: 'download', name: '26.3-fabric', versionId: '', loaderType: '' })
  globalTaskQueue.addSubtask(id, {
    id: 'download_files',
    name: '下载文件',
    status: 'running',
    message: '正在下载 26.3-fabric',
  })
  globalTaskQueue.updateTask(id, { status, message: '最终结果' })
  useTaskQueueStore(pinia).tasks[0]!.expanded = true
  const wrapper = render()
  expect(wrapper.get('.tq-subtask').classes()).toContain(`tq-subtask--${status}`)
  expect(wrapper.get('.tq-subtask-msg').text()).toBe('最终结果')
  expect(wrapper.find('.tq-subtask .ui-loading').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('正在下载 26.3-fabric')
  await flushPromises()
})

it('Java 任务使用中文名称，分数进度显示为整数，速度在顶部显示', () => {
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
  expect(wrapper.get('.tq-task-top .tq-speed-value').text()).toBe('607 KB/s')
  expect(wrapper.get('.tq-task-progress [role="progressbar"]').attributes('aria-valuenow')).toBe('6')
})

it('插件安装使用统一任务与真实安装阶段，不另建下载卡', () => {
  useApplicationOperationStore().accept({
    operationId: 'plugin-game-install',
    kind: 'plugin_game_install',
    status: 'running',
    canCancel: true,
    installation: installationFixture(),
  })
  const wrapper = render()
  expect(wrapper.get('.tq-task-name').text()).toBe('插件安装游戏')
  expect(wrapper.get('.tq-task-phase').text()).toBe('下载游戏文件')
  expect(wrapper.get('.tq-progress-text').text()).toBe('60%')
  expect(wrapper.get('.tq-speed-value').text()).toBe('30.0 B/s')
  expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(1)
  expect(wrapper.findAll('button').some((button) => button.text() === '取消')).toBe(true)
})

it.each([
  ['plugin_game_launch', 'downloading', '检查并补全游戏文件'],
  ['plugin_game_launch', 'launching', '创建游戏进程'],
  ['plugin_game_stop', 'stopping', '等待游戏实际退出'],
])('插件任务 %s 将阶段 %s 显示为本地化说明', (kind, stage, expected) => {
  useApplicationOperationStore().accept({ operationId: 'plugin-game-action', kind, stage, status: 'running' })
  const wrapper = render()
  expect(wrapper.get('.tq-task-phase').text()).toBe(expected)
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
