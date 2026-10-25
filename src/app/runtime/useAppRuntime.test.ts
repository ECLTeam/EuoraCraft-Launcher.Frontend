import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type * as AppData from '@/app/data'
import { pinia } from '@/app/stores'
import { globalTaskQueue, useTaskQueueStore } from '@/composables/useTaskQueue'
import { i18n } from '@/i18n'
import { installationFixture } from '@/types/installation.fixture'
import type { InstallProgress } from '@/types/instances'
import { useAppRuntime } from './useAppRuntime'

const mocks = vi.hoisted(() => ({ handlers: new Map<string, (payload: InstallProgress) => void>() }))
vi.mock('@/api/client', () => ({
  default: {
    runtime: { isAvailable: true, isDesktop: false },
    isShowcaseActive: false,
    command: vi.fn().mockResolvedValue({ success: true, data: [] }),
    on: vi.fn((name: string, handler: (payload: InstallProgress) => void) => {
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
})
afterEach(() => runtime?.stop())

async function startRuntime() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })
  await router.push('/')
  runtime = useAppRuntime({
    router,
    t: (key) => i18n.global.t(key),
    message: { warning: vi.fn(), info: vi.fn(), error: vi.fn() },
    markAgreementNotAccepted: vi.fn(),
    showAgreementModal: ref(false),
  })
  await runtime.start()
  const handler = mocks.handlers.get('game:install_progress')
  expect(handler).toBeTypeOf('function')
  return handler!
}

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
