import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInstanceManager } from '@/composables/useInstanceManager'
import { globalLaunchProgress } from '@/composables/useLaunchProgress'
import type * as GameConfig from '@/config/game'
import type { BackendMockState } from '@/test/mockBackend'

const mocks = vi.hoisted(() => ({
  state: undefined as BackendMockState | undefined,
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  popup: vi.fn(),
  cancelLaunch: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mocks.state = createMockBackend()
  return mocks.state.backend
})

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
    info: vi.fn(),
  }),
}))

vi.mock('@/app/runtime/useLauncherPopupQueue', () => ({ notifyLauncherPopup: mocks.popup }))

vi.mock('@/features/game-home/api/gameHomeApi', () => ({
  gameHomeApi: { cancelLaunch: mocks.cancelLaunch },
}))

vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({ loadJavaInstallations: vi.fn() }),
}))

vi.mock('@/config/game', async (importOriginal) => {
  const actual = await importOriginal<typeof GameConfig>()
  // 重试间隔置零，避免测试等待真实延迟。
  return { ...actual, LAUNCH_BUSY_RETRY_DELAY: 0 }
})

vi.mock('@/features/instances/stores/instanceStore', async () => {
  const { defineStore } = await import('pinia')
  const { ref } = await import('vue')
  const useInstanceStore = defineStore('instance', () => {
    const versions = ref([{ id: '1.21.8', type: 'Vanilla', versionType: 'release', gamePath: 'D:/mc' }])
    const selectedVersion = ref('1.21.8')
    const currentGamePath = ref('D:/mc')
    const scannedVersions = ref([
      {
        id: '1.21.8',
        versionId: '1.21.8',
        versionType: 'release',
        path: 'D:/mc',
        displayName: '1.21.8',
        primaryLoader: 'Vanilla',
        vanillaName: '1.21.8',
        hasForge: false,
        hasNeoForge: false,
        hasFabric: false,
        hasQuilt: false,
        jsonPath: 'D:/mc/versions/1.21.8/1.21.8.json',
      },
    ])
    return {
      versions,
      selectedVersion,
      currentGamePath,
      scannedVersions,
      loadAll: vi.fn(),
      selectVersion: vi.fn(),
      setGamePath: vi.fn(),
    }
  })
  return { useInstanceStore }
})

const { mocks: backendMocks } = mocks.state!

function failure(message: string, errorCode: string) {
  return { success: false, message, errorCode, timestamp: 0 }
}

// 可控时钟：取消后的连点保护窗口依赖 Date.now()。
let nowValue = 1_000_000

describe('useInstanceManager 启动取消', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    backendMocks.command.mockReset()
    backendMocks.waitForEventListeners.mockResolvedValue(undefined)
    mocks.cancelLaunch.mockResolvedValue(true)
    globalLaunchProgress.cancel()
    nowValue = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('取消后立即释放启动按钮与进度卡，并丢弃迟到的启动结果', async () => {
    let resolveLaunch!: (value: unknown) => void
    backendMocks.command.mockImplementation((name: string) => {
      if (name === 'game_launch') return new Promise((resolve) => (resolveLaunch = resolve))
      return Promise.resolve({ success: true, data: null, timestamp: 0 })
    })

    const instance = useInstanceManager((key: string) => key)
    const launching = instance.launchGame({ id: 'account-1' })
    await flushPromises()
    expect(instance.launching).toBe(true)
    expect(globalLaunchProgress.progress.value.visible).toBe(true)

    instance.cancelLaunch()
    expect(instance.launching).toBe(false)
    expect(globalLaunchProgress.progress.value.visible).toBe(false)
    expect(mocks.cancelLaunch).toHaveBeenCalledTimes(1)

    resolveLaunch(failure('启动已取消', 'LAUNCH_CANCELLED'))
    await launching
    // 迟到的取消结果不能重新点亮进度卡，也不该弹启动失败提示。
    expect(globalLaunchProgress.progress.value.visible).toBe(false)
    expect(instance.launching).toBe(false)
    expect(mocks.popup).not.toHaveBeenCalled()
  })

  it('取消后立刻重新启动时，上一次启动的迟到结果不会覆盖新会话', async () => {
    const pending: ((value: unknown) => void)[] = []
    backendMocks.command.mockImplementation((name: string) => {
      if (name === 'game_launch') return new Promise((resolve) => pending.push(resolve))
      return Promise.resolve({ success: true, data: null, timestamp: 0 })
    })

    const instance = useInstanceManager((key: string) => key)
    const firstLaunch = instance.launchGame({ id: 'account-1' })
    await flushPromises()
    instance.cancelLaunch()
    // 越过取消后的连点保护窗口再重新启动。
    nowValue += 1000
    const secondLaunch = instance.launchGame({ id: 'account-1' })
    await flushPromises()
    expect(globalLaunchProgress.progress.value.visible).toBe(true)

    pending[0]?.(failure('启动已取消', 'LAUNCH_CANCELLED'))
    await firstLaunch
    expect(globalLaunchProgress.progress.value.visible).toBe(true)
    expect(instance.launching).toBe(true)

    pending[1]?.({ success: true, data: { instanceId: 'minecraft-instance' }, timestamp: 0 })
    await secondLaunch
    expect(instance.launching).toBe(false)
  })

  it('上一次启动仍在退出时自动重试，并以普通提示代替失败弹窗', async () => {
    backendMocks.command.mockResolvedValue(failure('已有游戏启动任务正在运行', 'LAUNCH_ALREADY_RUNNING'))

    const instance = useInstanceManager((key: string) => key)
    await instance.launchGame({ id: 'account-1' })

    const launchCalls = backendMocks.command.mock.calls.filter(([name]) => name === 'game_launch')
    expect(launchCalls).toHaveLength(4)
    expect(mocks.warning).toHaveBeenCalled()
    expect(mocks.popup).not.toHaveBeenCalled()
    expect(instance.launching).toBe(false)
  })

  it('取消后立刻点击启动会被忽略，避免连点误触发新启动', async () => {
    backendMocks.command.mockImplementation((name: string) => {
      if (name === 'game_launch') return new Promise(() => {})
      return Promise.resolve({ success: true, data: null, timestamp: 0 })
    })
    const launchCalls = () => backendMocks.command.mock.calls.filter(([name]) => name === 'game_launch')

    const instance = useInstanceManager((key: string) => key)
    void instance.launchGame({ id: 'account-1' })
    await flushPromises()
    instance.cancelLaunch()

    // 取消后 200ms 的点击落在保护窗口内，直接忽略。
    nowValue += 200
    await instance.launchGame({ id: 'account-1' })
    expect(instance.launching).toBe(false)
    expect(launchCalls()).toHaveLength(1)

    // 越过窗口后可以正常重新启动。
    nowValue += 1000
    void instance.launchGame({ id: 'account-1' })
    await flushPromises()
    expect(instance.launching).toBe(true)
    expect(launchCalls()).toHaveLength(2)
  })

  it('取消时启动已经完成会提示游戏已启动', async () => {
    mocks.cancelLaunch.mockResolvedValue(false)
    backendMocks.command.mockImplementation((name: string) => {
      if (name === 'game_launch') return new Promise(() => {})
      return Promise.resolve({ success: true, data: null, timestamp: 0 })
    })

    const instance = useInstanceManager((key: string) => key)
    void instance.launchGame({ id: 'account-1' })
    await flushPromises()
    instance.cancelLaunch()
    await flushPromises()

    expect(mocks.warning).toHaveBeenCalled()
  })
})
