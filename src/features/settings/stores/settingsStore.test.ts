import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { useSettingsStore } from './settingsStore'

vi.mock('@/features/settings/api/settingsApi', () => ({
  settingsApi: {
    load: vi.fn(),
    saveUi: vi.fn(),
    saveGame: vi.fn(),
    saveDownload: vi.fn(),
    saveConnector: vi.fn(),
    listJava: vi.fn(),
    selectImage: vi.fn(),
    selectBackgroundVideo: vi.fn(),
    openBackgroundVideo: vi.fn(),
    saveImageUrl: vi.fn(),
    readImage: vi.fn(),
  },
}))

describe('settingsStore', () => {
  it('后台配置刷新等待本地写入完成，再读取最新配置', async () => {
    const store = useSettingsStore()
    await store.load()
    let finishSaving!: () => void
    vi.mocked(settingsApi.saveGame).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSaving = resolve
        })
    )
    const saving = store.patchGame({ memory_size: 8192 })
    await vi.waitFor(() => expect(settingsApi.saveGame).toHaveBeenCalledOnce())
    const refreshing = store.refreshAfterWrites()
    expect(settingsApi.load).toHaveBeenCalledTimes(1)
    finishSaving()
    await Promise.all([saving, refreshing])
    expect(settingsApi.load).toHaveBeenCalledTimes(2)
    expect(store.status).toBe('ready')
  })
  it.each(['force', 'invalidate'])('Java %s 不复用旧扫描，迟到的旧结果不覆盖最新列表', async (mode) => {
    const store = useSettingsStore()
    let finish!: (value: never[]) => void
    vi.mocked(settingsApi.listJava).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const old = store.loadJavaInstallations()
    const installations = [
      { path: 'C:/Java/21/bin/java.exe', version: '21', major_version: 21, java_type: 'JRE', arch: 'x64', sources: [] },
    ]
    vi.mocked(settingsApi.listJava).mockResolvedValueOnce(installations)
    if (mode === 'invalidate') store.invalidateJavaInstallations()
    await store.loadJavaInstallations(mode === 'force')
    finish([])
    await old
    expect(store.javaInstallations).toEqual(installations)
    expect(settingsApi.listJava).toHaveBeenCalledTimes(2)
  })

  it('设置刷新途中本地写入完成时，保留新值并结束加载状态', async () => {
    const store = useSettingsStore()
    await store.load()
    let finish!: (value: Awaited<ReturnType<typeof settingsApi.load>>) => void
    const snapshot = vi.mocked(settingsApi.load).mock.results[0]!.value
    vi.mocked(settingsApi.load).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    let finishSaving!: () => void
    vi.mocked(settingsApi.saveGame).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSaving = resolve
        })
    )
    const saving = store.patchGame({ memory_size: 8192 })
    await vi.waitFor(() => expect(settingsApi.saveGame).toHaveBeenCalledOnce())
    const loading = store.load(true)
    finishSaving()
    await saving
    finish(await snapshot)
    await loading
    expect(store.game.memory_size).toBe(8192)
    expect(store.status).toBe('ready')
  })
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(settingsApi.load).mockResolvedValue({
      ui: {},
      game: {
        minecraft_paths: [{ name: '主目录', path: 'D:/Minecraft' }],
        jvm_args: ['-XX:+UseG1GC'],
        memory_size: 6144,
      },
      download: { mirror_source: 'bmclapi' },
      launcher: {},
      connector: { mode: 'automatic', nodes: [] },
    })
  })

  it('联机配置沿用共用队列，策略和原始地址更新不会相互覆盖', async () => {
    const store = useSettingsStore()
    await store.load()
    await Promise.all([store.patchConnector({ mode: 'custom' }), store.patchConnector({ nodes: ['draft', ''] })])
    expect(store.connector).toEqual({ mode: 'custom', nodes: ['draft', ''] })
    expect(settingsApi.saveConnector).toHaveBeenLastCalledWith(store.connector)
  })

  it('加载时补齐默认值但保留后端配置', async () => {
    const store = useSettingsStore()
    await store.load()

    expect(store.status).toBe('ready')
    expect(store.game.java_auto).toBe(true)
    expect(store.game.instance_isolation_policy).toBe('all')
    expect(store.game.jvm_args).toEqual(['-XX:+UseG1GC'])
    expect(store.game.renderer).toBe('default')
    expect(store.game.game_args_tail).toBe('')
    expect(store.game.disable_crash_analysis).toBe(false)
    expect(store.game.minecraft_paths).toEqual([{ name: '主目录', path: 'D:/Minecraft' }])
    expect(store.download.mirror_source).toBe('bmclapi')
  })

  it('复用 Java 扫描结果，并允许用户强制重新扫描', async () => {
    vi.mocked(settingsApi.listJava)
      .mockResolvedValueOnce([
        {
          path: 'C:/Java/17/bin/java.exe',
          version: '17.0.12',
          major_version: 17,
          java_type: 'JRE',
          arch: 'x64',
          sources: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          path: 'C:/Java/21/bin/java.exe',
          version: '21.0.4',
          major_version: 21,
          java_type: 'JRE',
          arch: 'x64',
          sources: [],
        },
      ])
    const store = useSettingsStore()

    await store.loadJavaInstallations()
    await store.loadJavaInstallations()
    expect(settingsApi.listJava).toHaveBeenCalledOnce()

    await expect(store.loadJavaInstallations(true)).resolves.toEqual([
      {
        path: 'C:/Java/21/bin/java.exe',
        version: '21.0.4',
        major_version: 21,
        java_type: 'JRE',
        arch: 'x64',
        sources: [],
      },
    ])
    expect(settingsApi.listJava).toHaveBeenCalledTimes(2)
  })

  it('更新局部设置时不覆盖路径与 JVM 参数', async () => {
    const store = useSettingsStore()
    await store.load()
    await store.patchGame({ fullscreen: true })

    expect(settingsApi.saveGame).toHaveBeenCalledWith(
      expect.objectContaining({
        fullscreen: true,
        minecraft_paths: [{ name: '主目录', path: 'D:/Minecraft' }],
        jvm_args: ['-XX:+UseG1GC'],
      })
    )
  })

  it('保存主窗口标题栏模式并在写入失败时保留已保存值', async () => {
    const store = useSettingsStore()
    await store.load()
    await store.patchUiTheme({ window_chrome: 'system_shadow' })

    expect(settingsApi.saveUi).toHaveBeenCalledWith(
      expect.objectContaining({ theme: expect.objectContaining({ window_chrome: 'system_shadow' }) })
    )
    expect(store.ui.theme?.window_chrome).toBe('system_shadow')

    vi.mocked(settingsApi.saveUi).mockRejectedValueOnce(new Error('write failed'))
    await expect(store.patchUiTheme({ window_chrome: 'custom' })).rejects.toThrow('write failed')
    expect(store.ui.theme?.window_chrome).toBe('system_shadow')
  })

  it('串行化同一区域的并发局部更新，避免后一次覆盖前一次字段', async () => {
    const store = useSettingsStore()
    await store.load()
    let releaseFirstSave: (() => void) | undefined
    vi.mocked(settingsApi.saveGame).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseFirstSave = resolve
        })
    )

    const first = store.patchGame({ fullscreen: true })
    const second = store.patchGame({ memory_size: 8192 })
    await vi.waitFor(() => expect(settingsApi.saveGame).toHaveBeenCalledTimes(1))

    releaseFirstSave?.()
    await Promise.all([first, second])

    expect(settingsApi.saveGame).toHaveBeenLastCalledWith(
      expect.objectContaining({ fullscreen: true, memory_size: 8192 })
    )
    expect(store.game.fullscreen).toBe(true)
    expect(store.game.memory_size).toBe(8192)
  })

  it('选择视频背景后保存视频类型并请求受保护的媒体地址', async () => {
    vi.mocked(settingsApi.selectBackgroundVideo).mockResolvedValue('C:/background.mp4')
    vi.mocked(settingsApi.openBackgroundVideo).mockResolvedValue('http://127.0.0.1:9527/background/token')
    const store = useSettingsStore()
    await store.load()

    await expect(store.chooseBackgroundVideo()).resolves.toEqual({
      path: 'C:/background.mp4',
      videoUrl: 'http://127.0.0.1:9527/background/token',
    })
    expect(settingsApi.saveUi).toHaveBeenCalledWith(
      expect.objectContaining({
        background: expect.objectContaining({
          media_type: 'video',
          video: expect.objectContaining({ path: 'C:/background.mp4' }),
        }),
      })
    )
  })

  it('分别更新图片和视频分支时保留另一分支的设置', async () => {
    vi.mocked(settingsApi.load).mockResolvedValue({
      ui: {
        background: {
          media_type: 'image',
          image: { type: 'custom', path: 'C:/background.png', mode: 'single' },
          video: { path: 'C:/background.mp4', options: { muted: false, volume: 0.4 } },
        },
      },
      game: { minecraft_paths: [] },
      download: { mirror_source: 'official' },
      launcher: {},
      connector: { mode: 'automatic', nodes: [] },
    })
    const store = useSettingsStore()
    await store.load()

    await store.patchUiBackground({ video: { options: { volume: 0.8 } } })
    await store.patchUiBackground({ image: { mode: 'random' } })

    expect(settingsApi.saveUi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        background: expect.objectContaining({
          image: expect.objectContaining({ path: 'C:/background.png', mode: 'random' }),
          video: expect.objectContaining({
            path: 'C:/background.mp4',
            options: expect.objectContaining({ muted: false, volume: 0.8 }),
          }),
        }),
      })
    )
  })
})
