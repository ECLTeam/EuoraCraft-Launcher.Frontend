import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
import { acceptConfigSnapshot } from '@/app/data/configQueries'
import { queryClient } from '@/app/queryClient'
import { javaApi } from '@/features/java/api/javaApi'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { parseSettingsSnapshot } from '@/features/settings/model/settingsSnapshot'
import { javaInventory, javaRuntime } from '@/test/javaFixtures'
import { useSettingsStore } from './settingsStore'

vi.mock('@/features/java/api/javaApi', () => ({ javaApi: { inventory: vi.fn() } }))

vi.mock('@/features/settings/api/settingsApi', () => ({
  settingsApi: {
    load: vi.fn(),
    saveUi: vi.fn(),
    saveGame: vi.fn(),
    saveLauncher: vi.fn(),
    patchDownload: vi.fn(),
    listJava: vi.fn(),
    selectImage: vi.fn(),
    selectBackgroundVideo: vi.fn(),
    openBackgroundVideo: vi.fn(),
    saveImageUrl: vi.fn(),
    readImage: vi.fn(),
  },
}))

describe('settingsStore', () => {
  it('保存前接纳外部已确认快照，保留外部更新且跳过相同值', async () => {
    const store = useSettingsStore()
    await store.load()
    acceptConfigSnapshot({ section: 'game', effective: true, data: { ...store.game, memory_size: 8192 } })
    await store.patchGame({ memory_size: 8192 })
    expect(settingsApi.saveGame).not.toHaveBeenCalled()
    await store.patchGame({ fullscreen: true })
    expect(settingsApi.saveGame).toHaveBeenLastCalledWith(
      expect.objectContaining({ memory_size: 8192, fullscreen: true })
    )
  })

  it('嵌套下载映射按资源键比较，保留其他类型且不重复提交', async () => {
    const store = useSettingsStore()
    await store.load()
    store.download.resourceSaveDirectories = { mod: 'D:/Mods', shader: 'D:/Shaders' }
    await store.patchDownload({ resourceSaveDirectories: { mod: 'D:/Mods' } })
    expect(settingsApi.patchDownload).not.toHaveBeenCalled()
    vi.mocked(settingsApi.patchDownload).mockResolvedValue({
      ...store.download,
      resourceSaveDirectories: { mod: 'D:/NewMods', shader: 'D:/Shaders' },
    })
    await store.patchDownload({ resourceSaveDirectories: { mod: 'D:/NewMods' } })
    await store.patchDownload({ resourceSaveDirectories: { mod: 'D:/NewMods' } })
    expect(settingsApi.patchDownload).toHaveBeenCalledOnce()
    expect(store.download.resourceSaveDirectories?.shader).toBe('D:/Shaders')
  })

  it('未变化的全部配置分区与嵌套偏好不请求保存', async () => {
    const store = useSettingsStore()
    await store.load()
    await store.patchGame({ memory_size: 6144, fullscreen: false })
    await store.patchLauncher({ request_timeout: 15, request_retries: 2 })
    await store.patchDownload({ mirror_source: 'bmclapi' })
    await store.patchUi({})
    await store.patchUiTheme({})
    await store.patchUiDebugTools({})
    await store.patchUiBackground({})
    await store.updateUi((current) => ({ ...current }))
    for (const save of [settingsApi.saveGame, settingsApi.saveLauncher, settingsApi.patchDownload, settingsApi.saveUi])
      expect(save).not.toHaveBeenCalled()
    expect(settingsApi.load).toHaveBeenCalledOnce()
  })

  it('重复同值提交只写一次，失败后相同内容可重试', async () => {
    const store = useSettingsStore()
    await store.load()
    vi.mocked(settingsApi.saveGame).mockResolvedValue(undefined)
    await Promise.all([store.patchGame({ memory_size: 8192 }), store.patchGame({ memory_size: 8192 })])
    expect(settingsApi.saveGame).toHaveBeenCalledOnce()
    vi.mocked(settingsApi.saveGame).mockRejectedValueOnce(new Error('write failed'))
    await expect(store.patchGame({ memory_size: 4096 })).rejects.toThrow('write failed')
    await store.patchGame({ memory_size: 4096 })
    expect(settingsApi.saveGame).toHaveBeenCalledTimes(3)
    expect(store.game.memory_size).toBe(4096)
  })

  it('排队期间冻结调用方数组，A → B → A 不丢最后一次修改', async () => {
    const store = useSettingsStore()
    await store.load()
    const patch = { jvm_args: ['-Xmx4G'] }
    const first = store.patchGame(patch)
    patch.jvm_args.push('-Dunexpected=true')
    await first
    expect(settingsApi.saveGame).toHaveBeenLastCalledWith(expect.objectContaining({ jvm_args: ['-Xmx4G'] }))
    await Promise.all([store.patchGame({ memory_size: 8192 }), store.patchGame({ memory_size: 6144 })])
    expect(store.game.memory_size).toBe(6144)
    expect(settingsApi.saveGame).toHaveBeenCalledTimes(3)
  })

  it('并发修改调试显示、形态及其他 UI 偏好时合并保存，重新加载保留结果', async () => {
    const store = useSettingsStore()
    await store.load()
    store.ui = { locale: 'zh-CN', debugTools: { minimizedShape: 'circle' } }
    vi.mocked(settingsApi.saveUi).mockImplementation(async (ui) => ui)
    await Promise.all([
      store.patchUiDebugTools({ visible: false }),
      store.patchUi({ flowDebug: true }),
      store.patchUiDebugTools({ minimizedShape: 'rectangle' }),
    ])
    expect(store.ui).toEqual({
      locale: 'zh-CN',
      flowDebug: true,
      debugTools: { visible: false, minimizedShape: 'rectangle' },
    })
    const saved = structuredClone(toRaw(store.ui))
    vi.mocked(settingsApi.load).mockResolvedValue(
      parseSettingsSnapshot({
        ui: saved,
        game: { minecraft_paths: [] },
        launcher: {},
        download: { mirror_source: 'official' },
      })
    )
    const reloaded = useSettingsStore(createPinia())
    await reloaded.load(true)
    expect(reloaded.ui.debugTools).toEqual(saved.debugTools)
    vi.mocked(settingsApi.saveUi).mockReset()
  })

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
  it.each(['force', 'invalidate'])('Java %s 不复用旧请求，旧结果不覆盖唯一清单', async (mode) => {
    const store = useSettingsStore()
    let finish!: (value: ReturnType<typeof javaInventory>) => void
    vi.mocked(javaApi.inventory).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const old = store.loadJavaInstallations()
    const current = javaRuntime({ executablePath: 'C:/Java/21/bin/java.exe', fullVersion: '21' })
    vi.mocked(javaApi.inventory).mockResolvedValueOnce(javaInventory([current]))
    if (mode === 'invalidate') store.invalidateJavaInstallations()
    await store.loadJavaInstallations(mode === 'force')
    finish(javaInventory())
    await old
    expect(store.javaInstallations[0]?.path).toBe(current.executablePath)
    expect(javaApi.inventory).toHaveBeenCalledTimes(2)
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
    // 数据层按 queryKey 缓存，跨用例共享会掩盖真实请求，需逐例清空。
    queryClient.clear()
    vi.mocked(javaApi.inventory).mockReset().mockResolvedValue(javaInventory())
    vi.mocked(settingsApi.load).mockResolvedValue({
      ui: {},
      game: {
        minecraft_paths: [{ name: '主目录', path: 'D:/Minecraft' }],
        jvm_args: ['-XX:+UseG1GC'],
        memory_size: 6144,
      },
      download: { mirror_source: 'bmclapi', mod_source: 'mcim' },
      launcher: {},
    })
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
    expect(store.download.mod_source).toBe('mcim')
  })

  it('设置入口委托唯一 Java 清单，并支持强制刷新', async () => {
    vi.mocked(javaApi.inventory)
      .mockResolvedValueOnce(javaInventory([javaRuntime({ fullVersion: '17.0.12', majorVersion: 17 })]))
      .mockResolvedValueOnce(javaInventory([javaRuntime({ fullVersion: '21.0.4' })]))
    const store = useSettingsStore()
    await store.loadJavaInstallations()
    await store.loadJavaInstallations()
    expect(javaApi.inventory).toHaveBeenCalledOnce()
    expect((await store.loadJavaInstallations(true))[0]?.version).toBe('21.0.4')
    expect(javaApi.inventory).toHaveBeenCalledTimes(2)
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
