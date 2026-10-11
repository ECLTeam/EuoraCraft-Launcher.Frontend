import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import backend from '@/api/client'
import AvatarRenderer from '@/components/game/AvatarRenderer.vue'
import type { MinecraftAccount } from '@/types/accounts'
import {
  clearAvatarCache,
  fetchAccountTextures,
  fetchAccountTextureDataUrl,
  fetchTextureDataUrl,
  reconcileAvatarAccounts,
  useAvatarRenderer,
} from './useAvatarRenderer'

vi.mock('@/api/client', () => ({ default: { command: vi.fn(), runtime: { isAvailable: true } } }))
const skin = 'https://example.com/skin.png'
const alice: MinecraftAccount = {
  id: 'a',
  type: 'authlib',
  uuid: 'uuid-a',
  alias: 'Alice',
  auth_server: 'https://server-a',
}
const bob: MinecraftAccount = {
  id: 'b',
  type: 'microsoft',
  uuid: 'uuid-b',
  alias: 'Bob',
  skinUrl: 'https://example.com/b.png',
}
const wrappers: ReturnType<typeof mount>[] = []
function snapshot(accounts = [alice, bob], invalidated: string[] = []) {
  reconcileAvatarAccounts({ accounts, current: accounts[0] || null, textureInvalidatedAccountIds: invalidated })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
function render(account: MinecraftAccount, size = 32) {
  return useAvatarRenderer().renderAvatar(account.uuid, account.alias, size, account.skinUrl, account.id, account.type)
}
beforeEach(() => {
  clearAvatarCache()
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
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,avatar')
  vi.mocked(backend.command).mockImplementation(async (name) =>
    name === 'accounts_texture_urls'
      ? { success: true, data: { skinUrl: skin, skinModel: 'classic' } }
      : { success: true, data: { dataUrl: 'data:image/png;base64,skin' } }
  )
  snapshot()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  clearAvatarCache()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.mocked(backend.command).mockReset()
})

describe('账户头像缓存失效边界', () => {
  it('不同尺寸头像与衣柜共享材质解析和图片，普通快照变化保持缓存', async () => {
    await Promise.all([render(alice), render(alice, 64), fetchAccountTextures(alice.id)])
    expect(backend.command).toHaveBeenCalledTimes(2)
    snapshot([
      { ...alice, favorite: true, pinned: true, isCurrent: false },
      { ...bob, isCurrent: true },
    ])
    await render(alice)
    await render(alice, 48)
    expect(backend.command).toHaveBeenCalledTimes(2)
  })

  it('刷新 A 即时重绘 A，同 URL 重新下载，B 不重绘也不查询', async () => {
    for (const account of [alice, bob]) {
      wrappers.push(
        mount(AvatarRenderer, {
          props: {
            accountId: account.id,
            uuid: account.uuid,
            username: account.alias,
            typeName: account.type,
            skinUrl: account.skinUrl,
            size: 32,
          },
        })
      )
    }
    await flushPromises()
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(2)
    vi.mocked(backend.command).mockClear()
    snapshot([alice, bob], ['a'])
    await flushPromises()
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(3)
    expect(backend.command).toHaveBeenCalledTimes(2)
    expect(backend.command).toHaveBeenCalledWith('image_fetch_data_url', { url: skin, refresh: true })
    await render(bob)
    expect(backend.command).toHaveBeenCalledTimes(2)
  })

  it('同 UUID 在认证服务器变化后重新解析，不复用旧身份材质', async () => {
    await render(alice)
    snapshot([{ ...alice, auth_server: 'https://server-b' }, bob])
    await render(alice)
    expect(vi.mocked(backend.command).mock.calls.filter(([name]) => name === 'accounts_texture_urls')).toHaveLength(2)
  })

  it('失效后迟到元数据不能回填缓存或清除新在途查询', async () => {
    const old = deferred<{ success: boolean; data: { skinUrl: string } }>()
    const fresh = deferred<{ success: boolean; data: { skinUrl: string } }>()
    vi.mocked(backend.command).mockImplementationOnce(() => old.promise)
    const first = fetchAccountTextures('a')
    await flushPromises()
    snapshot([alice, bob], ['a'])
    vi.mocked(backend.command).mockImplementationOnce(() => fresh.promise)
    const second = fetchAccountTextures('a')
    await flushPromises()
    old.resolve({ success: true, data: { skinUrl: 'old' } })
    await first
    const same = fetchAccountTextures('a')
    fresh.resolve({ success: true, data: { skinUrl: 'fresh' } })
    await Promise.all([second, same])
    expect(await fetchAccountTextures('a')).toEqual({ skinUrl: 'fresh' })
    expect(backend.command).toHaveBeenCalledTimes(2)
  })

  it('删除账户后的迟到头像不能恢复该账户缓存', async () => {
    const old = deferred<{ success: boolean; data: { skinUrl: string } }>()
    vi.mocked(backend.command).mockImplementationOnce(() => old.promise)
    const first = render(alice)
    await flushPromises()
    snapshot([bob])
    old.resolve({ success: true, data: { skinUrl: skin } })
    expect(await first).toBeNull()
    snapshot()
    await render(alice)
    expect(vi.mocked(backend.command).mock.calls.filter(([name]) => name === 'accounts_texture_urls')).toHaveLength(2)
  })

  it('失败或无材质仅短暂回退，到期重新获取真实皮肤', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(backend.command).mockRejectedValueOnce(new Error('temporary'))
    await render(alice)
    await render(alice, 64)
    expect(backend.command).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 30_001)
    await render(alice)
    expect(backend.command).toHaveBeenCalledTimes(3)
  })

  it('显式刷新失败继续显示旧缓存，短回退到期仍执行强制刷新', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await fetchAccountTextureDataUrl('a', skin)
    snapshot([alice, bob], ['a'])
    vi.mocked(backend.command).mockResolvedValueOnce({
      success: true,
      data: { dataUrl: 'data:image/png;base64,old', stale: true },
    })
    expect(await fetchAccountTextureDataUrl('a', skin)).toBe('data:image/png;base64,old')
    await fetchAccountTextureDataUrl('a', skin)
    expect(backend.command).toHaveBeenCalledTimes(2)
    vi.setSystemTime(Date.now() + 30_001)
    await fetchAccountTextureDataUrl('a', skin)
    expect(backend.command).toHaveBeenLastCalledWith('image_fetch_data_url', { url: skin, refresh: true })
  })

  it('图片下载失败短暂合并回退，恢复后可以重试', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(backend.command).mockRejectedValueOnce(new Error('temporary'))
    expect(await fetchTextureDataUrl(skin)).toBeNull()
    expect(await fetchTextureDataUrl(skin)).toBeNull()
    vi.setSystemTime(Date.now() + 30_001)
    expect(await fetchTextureDataUrl(skin)).toBe('data:image/png;base64,skin')
    expect(backend.command).toHaveBeenCalledTimes(2)
  })

  it('再次显式刷新立即重试，不受失败回退窗口阻挡', async () => {
    await fetchAccountTextureDataUrl('a', skin)
    snapshot([alice, bob], ['a'])
    vi.mocked(backend.command).mockResolvedValueOnce({
      success: true,
      data: { dataUrl: 'data:image/png;base64,old', stale: true },
    })
    await fetchAccountTextureDataUrl('a', skin)
    snapshot([alice, bob], ['a'])
    await fetchAccountTextureDataUrl('a', skin)
    expect(backend.command).toHaveBeenCalledTimes(3)
    expect(backend.command).toHaveBeenLastCalledWith('image_fetch_data_url', { url: skin, refresh: true })
  })

  it('本地和 Base64 皮肤不访问后端', async () => {
    expect(await fetchTextureDataUrl('data:image/png;base64,local')).toBe('data:image/png;base64,local')
    expect(await fetchTextureDataUrl('blob:local')).toBe('blob:local')
    await render({ ...alice, type: 'offline', skinUrl: 'data:image/png;base64,local' })
    expect(backend.command).not.toHaveBeenCalled()
  })
})
