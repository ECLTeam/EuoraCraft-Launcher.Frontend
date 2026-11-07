import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from '@/composables/useTheme'
import { resolveLocalImageUrl, settingsApi } from '@/features/settings/api/settingsApi'

vi.mock('@/features/settings/api/settingsApi', () => ({
  resolveLocalImageUrl: vi.fn(),
  settingsApi: {
    isShowcase: false,
    isAvailable: false,
    listBackgroundImages: vi.fn(),
    openBackgroundVideo: vi.fn(),
  },
}))

const imageUrl = 'data:image/png;base64,AA=='
const videoUrl = 'http://127.0.0.1/background/test-stream'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  vi.mocked(resolveLocalImageUrl).mockReset().mockResolvedValue(imageUrl)
  vi.mocked(settingsApi.listBackgroundImages).mockReset().mockResolvedValue(['C:/images/first.png'])
  vi.mocked(settingsApi.openBackgroundVideo).mockReset().mockResolvedValue(videoUrl)
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      set src(_value: string) {
        Promise.resolve().then(() => this.onload?.())
      }
    }
  )
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('主题只加载当前启用的背景分支', () => {
  it('视频初始化不读失效单图，切回图片时才报错并允许重试', async () => {
    const theme = useTheme()
    vi.mocked(resolveLocalImageUrl).mockRejectedValue(new Error('图片文件不存在'))
    await expect(
      theme.initTheme({
        background: {
          media_type: 'video',
          image: { type: 'custom', mode: 'single', path: 'C:/missing.png' },
          video: { path: 'C:/movie.mp4' },
        },
      })
    ).resolves.toBeUndefined()
    expect(resolveLocalImageUrl).not.toHaveBeenCalled()
    expect(theme.backgroundVideoUrl.value).toBe(videoUrl)
    expect(theme.backgroundImagePath.value).toBe('C:/missing.png')
    await expect(theme.activateImageBackground()).rejects.toThrow('图片文件不存在')
    expect(theme.backgroundImagePath.value).toBe('C:/missing.png')
    vi.mocked(resolveLocalImageUrl).mockResolvedValue(imageUrl)
    await theme.activateImageBackground()
    expect(theme.backgroundImage.value).toBe(imageUrl)
    expect(theme.backgroundVideoPath.value).toBe('C:/movie.mp4')
  })

  it.each(['carousel', 'random'] as const)('视频保留 %s 目录，切回图片才扫描并加载第一张', async (mode) => {
    const theme = useTheme()
    await theme.initTheme({
      background: {
        media_type: 'video',
        image: { type: 'custom', mode, path: 'C:/images', interval: 17 },
        video: { path: 'C:/movie.mp4' },
      },
    })
    expect(settingsApi.listBackgroundImages).not.toHaveBeenCalled()
    expect(resolveLocalImageUrl).not.toHaveBeenCalled()
    expect(theme.bgFolderPath.value).toBe('C:/images')
    expect(theme.backgroundImagePath.value).toBe('')
    await theme.activateImageBackground()
    expect(settingsApi.listBackgroundImages).toHaveBeenCalledExactlyOnceWith('C:/images')
    expect(resolveLocalImageUrl).toHaveBeenCalledExactlyOnceWith('C:/images/first.png')
    expect(theme.backgroundImage.value).toBe(imageUrl)
    expect(theme.bgMode.value).toBe(mode)
    expect(theme.bgInterval.value).toBe(17)
  })

  it('图片背景正常加载一次，不请求保留的视频流', async () => {
    const theme = useTheme()
    await theme.initTheme({
      background: {
        media_type: 'image',
        image: { type: 'custom', path: 'C:/active.png' },
        video: { path: 'C:/old-video.mp4' },
      },
    })
    expect(resolveLocalImageUrl).toHaveBeenCalledExactlyOnceWith('C:/active.png')
    expect(settingsApi.openBackgroundVideo).not.toHaveBeenCalled()
    expect(theme.backgroundImage.value).toBe(imageUrl)
  })

  it('默认背景不读取残留路径或扫描目录', async () => {
    const theme = useTheme()
    await theme.initTheme({
      background: {
        media_type: 'image',
        image: { type: 'default', path: 'C:/stale', mode: 'carousel' },
      },
    })
    expect(resolveLocalImageUrl).not.toHaveBeenCalled()
    expect(settingsApi.listBackgroundImages).not.toHaveBeenCalled()
    expect(theme.backgroundImage.value).toBe('')
  })

  it('视频只加载自己的封面，未启用图片失效不会阻断视频', async () => {
    const theme = useTheme()
    vi.mocked(resolveLocalImageUrl).mockImplementation(async (path) => {
      if (path !== 'C:/poster.png') throw new Error('未启用图片不能读取')
      return imageUrl
    })
    await theme.initTheme({
      background: {
        media_type: 'video',
        image: { type: 'custom', path: 'C:/missing.png' },
        video: { path: 'C:/movie.mp4', poster_path: 'C:/poster.png' },
      },
    })
    expect(resolveLocalImageUrl).toHaveBeenCalledExactlyOnceWith('C:/poster.png')
    expect(theme.backgroundVideoUrl.value).toBe(videoUrl)
    expect(theme.backgroundImage.value).toBe(imageUrl)
  })

  it('切换到视频后，迟到的图片读取不能覆盖视频封面', async () => {
    const theme = useTheme()
    await theme.initTheme({
      background: {
        media_type: 'video',
        image: { type: 'custom', path: 'C:/image.png' },
        video: { path: 'C:/movie.mp4' },
      },
    })
    let resolveImage!: (url: string) => void
    vi.mocked(resolveLocalImageUrl).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveImage = resolve
        })
    )
    const loading = theme.activateImageBackground()
    await theme.activateVideoBackground()
    resolveImage(imageUrl)
    await loading
    expect(theme.backgroundMediaType.value).toBe('video')
    expect(theme.backgroundImage.value).toBe('')
    expect(theme.backgroundVideoUrl.value).toBe(videoUrl)
  })
})
