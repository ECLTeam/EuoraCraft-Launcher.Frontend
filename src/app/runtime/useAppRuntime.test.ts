import { performance as nodePerformance } from 'node:perf_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import backend from '@/api/client'
import type * as AppData from '@/app/data'
import { pinia } from '@/app/stores'
import { globalTaskQueue, useTaskQueueStore } from '@/composables/useTaskQueue'
import { i18n } from '@/i18n'
import { installationFixture } from '@/types/installation.fixture'
import { desktopWindow } from './desktopWindow'
import { launcherErrorQueue } from './errorPresentation'
import { useAppRuntime } from './useAppRuntime'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  command: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))
vi.mock('@/api/client', () => ({
  default: {
    runtime: { isAvailable: true, isDesktop: false },
    isShowcaseActive: false,
    command: mocks.command,
    on: vi.fn((name: string, handler: (payload: unknown) => void) => {
      mocks.handlers.set(name, handler)
      return () => mocks.handlers.delete(name)
    }),
    waitForEventListeners: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('@/app/data', async (importOriginal) => ({
  ...(await importOriginal<typeof AppData>()),
  configQuery: vi.fn().mockResolvedValue({ ui: { locale: 'en-US' }, launcher: {} }),
  launcherInfoQuery: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/composables/useTheme', () => ({ initTheme: vi.fn() }))
vi.mock('@/composables/usePluginBridge', () => ({
  initPluginBridge: vi.fn(),
  destroyPluginBridge: vi.fn(),
  scopePluginCss: vi.fn(),
}))
vi.mock('@/features/terminal/composables/useProcessInstances', () => ({
  globalProcessInstances: { init: vi.fn(), dispose: vi.fn() },
}))

let runtime: ReturnType<typeof useAppRuntime> | undefined
beforeEach(() => {
  useTaskQueueStore(pinia).tasks = []
  mocks.handlers.clear()
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  mocks.command.mockReset().mockResolvedValue({ success: true, data: [] })
  backend.isShowcaseActive = false
  vi.stubGlobal('performance', nodePerformance)
})
afterEach(() => {
  runtime?.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function createRuntime() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })
  await router.push('/')
  runtime = useAppRuntime({
    router,
    t: (key) => i18n.global.t(key),
    message: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    markAgreementNotAccepted: vi.fn(),
    showAgreementModal: ref(false),
  })
  return runtime
}

async function startRuntime() {
  await createRuntime()
  await runtime!.start()
  const handler = mocks.handlers.get('game:install_progress')
  expect(handler).toBeTypeOf('function')
  return handler!
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

function pendingQueries(): number {
  return mocks.command.mock.calls.filter(([command]) => command === 'launcher_errors_pending').length
}

describe('严重错误补查的可见性与生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  })

  it('首次补查后每 30 秒查询一次，重复启动不增加调度', async () => {
    await startRuntime()
    await runtime!.start()
    expect(pendingQueries()).toBe(1)
    await vi.advanceTimersByTimeAsync(29_999)
    expect(pendingQueries()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(pendingQueries()).toBe(2)
  })

  it('隐藏暂停，恢复立即补查，事件在隐藏时仍实时入队', async () => {
    await startRuntime()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(pendingQueries()).toBe(1)
    const enqueue = vi.spyOn(launcherErrorQueue, 'enqueue').mockReturnValue(true)
    const error = { error_id: 'hidden-event', message: '隐藏时发生的错误' }
    mocks.handlers.get('launcher:error')!(error)
    expect(enqueue).toHaveBeenCalledWith(error)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(pendingQueries()).toBe(2)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(pendingQueries()).toBe(3)
  })

  it('启动时隐藏仍补查一次，随后等恢复可见', async () => {
    setVisibility('hidden')
    await startRuntime()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(pendingQueries()).toBe(1)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(pendingQueries()).toBe(2)
  })

  it('WebView 仍报告可见时也按原生最小化状态暂停，停止时释放原生监听', async () => {
    let visibilityChanged!: (visible: boolean) => void
    const unsubscribe = vi.fn()
    vi.spyOn(desktopWindow, 'onVisibilityChanged').mockImplementation(async (handler) => {
      visibilityChanged = handler
      return unsubscribe
    })
    await startRuntime()
    visibilityChanged(false)
    expect(document.visibilityState).toBe('visible')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(pendingQueries()).toBe(1)
    visibilityChanged(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(pendingQueries()).toBe(2)
    runtime!.stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
    visibilityChanged(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(pendingQueries()).toBe(2)
  })

  it('慢查询期间多次恢复合并一次后续补查，不并发查询', async () => {
    await startRuntime()
    let resolveQuery!: (response: { success: boolean; data: never[] }) => void
    mocks.command.mockImplementation((command: string) =>
      command === 'launcher_errors_pending'
        ? new Promise((resolve) => {
            resolveQuery = resolve
          })
        : Promise.resolve({ success: true, data: [] })
    )
    await vi.advanceTimersByTimeAsync(30_000)
    for (let index = 0; index < 3; index++) {
      setVisibility('hidden')
      setVisibility('visible')
    }
    await vi.advanceTimersByTimeAsync(90_000)
    expect(pendingQueries()).toBe(2)
    mocks.command.mockResolvedValue({ success: true, data: [] })
    resolveQuery({ success: true, data: [] })
    await vi.advanceTimersByTimeAsync(0)
    expect(pendingQueries()).toBe(3)
    await vi.advanceTimersByTimeAsync(29_999)
    expect(pendingQueries()).toBe(3)
  })

  it.each(['query', 'ack'] as const)('%s 失败后继续补查并能确认同一错误', async (failure) => {
    const error = { error_id: `retry-${failure}`, message: '稍后恢复的错误' }
    let shouldFail = true
    const enqueue = vi.spyOn(launcherErrorQueue, 'enqueue').mockReturnValue(true)
    mocks.command.mockImplementation((command: string) => {
      if (command === 'launcher_errors_pending') {
        if (failure === 'query' && shouldFail) {
          shouldFail = false
          return Promise.reject(new Error('transport failure'))
        }
        return Promise.resolve({ success: true, data: [error] })
      }
      if (command === 'launcher_errors_ack' && failure === 'ack' && shouldFail) {
        shouldFail = false
        return Promise.reject(new Error('ack failure'))
      }
      return Promise.resolve({ success: true, data: [] })
    })
    await startRuntime()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(pendingQueries()).toBe(2)
    expect(enqueue).toHaveBeenCalledWith(error)
    expect(mocks.command).toHaveBeenCalledWith('launcher_errors_ack', { error_ids: [error.error_id] })
  })

  it('停止后的旧查询不入队或 ACK，不阻挡重新启动的查询', async () => {
    await startRuntime()
    let resolveQuery!: (response: unknown) => void
    mocks.command.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve
        })
    )
    await vi.advanceTimersByTimeAsync(30_000)
    runtime!.stop()
    const enqueue = vi.spyOn(launcherErrorQueue, 'enqueue').mockReturnValue(true)
    await runtime!.start()
    expect(pendingQueries()).toBe(3)
    resolveQuery({ success: true, data: [{ error_id: 'stale-error', message: '旧响应' }] })
    await vi.advanceTimersByTimeAsync(0)
    expect(enqueue).not.toHaveBeenCalled()
    expect(mocks.command.mock.calls.some(([command]) => command === 'launcher_errors_ack')).toBe(false)
    runtime!.stop()
    setVisibility('hidden')
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(pendingQueries()).toBe(3)
  })

  it('启动等待期间停止不重新注册监听或发送就绪通知', async () => {
    const { configQuery } = await import('@/app/data')
    const config = await configQuery()
    let resolveConfig!: (value: Awaited<ReturnType<typeof configQuery>>) => void
    vi.mocked(configQuery).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConfig = resolve
        })
    )
    await createRuntime()
    const starting = runtime!.start()
    runtime!.stop()
    resolveConfig(config)
    await starting
    expect(mocks.handlers.size).toBe(0)
    expect(mocks.command).not.toHaveBeenCalledWith('frontend_ready')
  })

  it('展示模式不建立真实补查调度', async () => {
    backend.isShowcaseActive = true
    await startRuntime()
    await vi.advanceTimersByTimeAsync(90_000)
    expect(pendingQueries()).toBe(0)
  })

  it('记录真实启动阶段，重启只保留当前指标且保留其他模块条目', async () => {
    performance.measure('other-feature', { start: 0, end: 1 })
    await startRuntime()
    const measures = () => performance.getEntriesByType('measure').filter(({ name }) => name.startsWith('ecl-startup:'))
    expect(measures().map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'ecl-startup:config',
        'ecl-startup:listeners',
        'ecl-startup:apply-config',
        'ecl-startup:launcher-info',
        'ecl-startup:ready',
        'ecl-startup:pending-errors',
        'ecl-startup:total',
      ])
    )
    const count = measures().length
    runtime!.stop()
    await runtime!.start()
    expect(measures()).toHaveLength(count)
    expect(performance.getEntriesByName('other-feature')).toHaveLength(1)
    expect(measures().every(({ duration }) => duration >= 0)).toBe(true)
    performance.clearMeasures('other-feature')
  })
})

describe('安装进度事件与任务队列集成', () => {
  it('结构化安装事件更新阶段，非法快照不能覆盖当前状态', async () => {
    const handle = await startRuntime()
    const id = globalTaskQueue.addTask({ type: 'install', name: 'Minecraft', versionId: '', loaderType: '' })
    handle({ kind: 'installation', task_id: id, installation: installationFixture() })
    expect(globalTaskQueue.tasks.value[0]?.installation?.currentStageId).toBe('download_game_files')
    handle({ kind: 'installation', task_id: id, installation: installationFixture({ revision: NaN }) })
    expect(globalTaskQueue.tasks.value[0]?.installation?.revision).toBe(1)
    expect(globalTaskQueue.tasks.value[0]?.status).toBe('running')
  })

  it.each([
    ['done', undefined, 'completed'],
    ['error', 'GAME_DOWNLOAD_FAILED', 'error'],
    ['error', 'INSTALL_CANCELLED', 'canceled'],
  ] as const)('不携带子阶段的 %s 事件结束已有阶段，迟到事件保持终态', async (phase, errorCode, status) => {
    const handle = await startRuntime()
    const id = globalTaskQueue.addTask({
      type: 'install',
      name: '26.3-fabric',
      versionId: '26.3',
      loaderType: 'fabric',
    })
    handle({
      task_id: id,
      phase: 'download',
      subtask: 'download_files',
      message: '正在下载 26.3-fabric',
      done: 2,
      total: 2,
      speed: 10,
    })
    expect(globalTaskQueue.tasks.value[0]?.status).toBe('running')
    expect(globalTaskQueue.tasks.value[0]?.subtasks[0]?.name).toBe('Download files')
    handle({ task_id: id, phase, errorCode, message: '最终结果', done: 1, total: 1 })
    handle({ task_id: id, phase: 'download', subtask: 'download_files', message: '迟到进度' })
    expect(globalTaskQueue.tasks.value[0]).toMatchObject({
      status,
      message: '最终结果',
      speedBytesPerSecond: 0,
      subtasks: [{ id: 'download_files', name: 'Download files', status, message: '最终结果' }],
    })
    runtime?.stop()
    expect(mocks.handlers.has('game:install_progress')).toBe(false)
  })

  it('最终事件携带新子阶段时也登记正确结果', async () => {
    const handle = await startRuntime()
    handle({
      task_id: 'empty',
      name: '无需下载',
      phase: 'done',
      subtask: 'check_files',
      message: '',
      done: 1,
      total: 1,
    })
    expect(globalTaskQueue.tasks.value[0]).toMatchObject({ status: 'completed', subtasks: [{ status: 'completed' }] })
  })
})
