import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import backend from '@/api/client'
import AvatarRenderer from '@/components/game/AvatarRenderer.vue'
import { clearAvatarCache, fetchTextureDataUrl, renderSkinAvatar, useAvatarRenderer } from './useAvatarRenderer'

vi.mock('@/api/client', () => ({ default: { command: vi.fn(), runtime: { isAvailable: true } } }))

describe('renderSkinAvatar', () => {
  it('相同账户属性未变化时，清理缓存也会自动重绘已显示头像', async () => {
    class MockImage {
      naturalWidth = 64
      naturalHeight = 64
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,old')
    const avatar = mount(AvatarRenderer, { props: { username: 'Player', skinUrl: 'data:image/png;base64,same-url' } })
    await flushPromises()
    expect(avatar.get('img').attributes('src')).toBe('data:image/png;base64,old')
    canvas.mockReturnValue('data:image/png;base64,fresh')
    clearAvatarCache()
    await flushPromises()
    expect(avatar.get('img').attributes('src')).toBe('data:image/png;base64,fresh')
    avatar.unmount()
  })
  it('清理皮肤缓存后，迟到旧请求不回填旧皮肤或清除新的在途请求', async () => {
    let finishOld!: (value: { success: boolean; data: { dataUrl: string } }) => void
    let finishNew!: (value: { success: boolean; data: { dataUrl: string } }) => void
    vi.mocked(backend.command).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve
        })
    )
    const old = fetchTextureDataUrl('https://example.com/skin.png')
    clearAvatarCache()
    vi.mocked(backend.command).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishNew = resolve
        })
    )
    const fresh = fetchTextureDataUrl('https://example.com/skin.png')
    finishOld({ success: true, data: { dataUrl: 'data:image/png;base64,old' } })
    await old
    const same = fetchTextureDataUrl('https://example.com/skin.png')
    finishNew({ success: true, data: { dataUrl: 'data:image/png;base64,fresh' } })
    await Promise.all([fresh, same])
    expect(await fetchTextureDataUrl('https://example.com/skin.png')).toBe('data:image/png;base64,fresh')
    expect(backend.command).toHaveBeenCalledTimes(2)
  })
  afterEach(() => {
    clearAvatarCache()
    vi.mocked(backend.command).mockReset()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it(async () => {
    class MockImage {
      naturalWidth = 64
      naturalHeight = 64
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''

      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', MockImage)

    const drawImage = vi.fn()
    const context = { drawImage, imageSmoothingEnabled: true }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,avatar')

    const result = await renderSkinAvatar('data:image/png;base64,skin', 32)

    expect(result).toBe('data:image/png;base64,avatar')
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(drawImage).toHaveBeenNthCalledWith(1, expect.anything(), 8, 8, 8, 8, 4, 4, 48, 48)
    expect(drawImage).toHaveBeenNthCalledWith(2, expect.anything(), 40, 8, 8, 8, 0, 0, 56, 56)
  })

  it('合并相同账户的并发渲染并复用 LRU 结果', async () => {
    class MockImage {
      naturalWidth = 64
      naturalHeight = 64
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,cached')
    const first = useAvatarRenderer()
    const second = useAvatarRenderer()

    const results = await Promise.all([
      first.renderAvatar('uuid', 'Player', 32),
      second.renderAvatar('uuid', 'Player', 32),
    ])
    const cached = await first.renderAvatar('uuid', 'Player', 32)

    expect(results).toEqual(['data:image/png;base64,cached', 'data:image/png;base64,cached'])
    expect(cached).toBe('data:image/png;base64,cached')
    expect(drawImage).toHaveBeenCalledTimes(2)
  })

  it('authlib 账户无列表皮肤时懒加载会话服务器皮肤，离线账户不请求', async () => {
    class MockImage {
      naturalWidth = 64
      naturalHeight = 64
      onload: (() => void) | null = null

      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', MockImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,avatar')
    vi.mocked(backend.command).mockResolvedValue({ success: true, data: { skinUrl: 'data:image/png;base64,realskin' } })

    const renderer = useAvatarRenderer()
    const authlib = await renderer.renderAvatar('authlib-uuid', 'Player', 32, undefined, 'authlib-id', 'authlib')
    expect(authlib).toBe('data:image/png;base64,avatar')
    expect(vi.mocked(backend.command)).toHaveBeenCalledWith('accounts_texture_urls', { account_id: 'authlib-id' })

    vi.mocked(backend.command).mockClear()
    const offline = await renderer.renderAvatar('offline-uuid', 'Offline', 32, undefined, 'offline-id', 'offline')
    expect(offline).toBe('data:image/png;base64,avatar')
    expect(vi.mocked(backend.command)).not.toHaveBeenCalled()
  })
})
