import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendCommandError } from '@/app/runtime/errorPresentation'
import { i18n } from '@/i18n'
import LittleSkinClosetPanel from './LittleSkinClosetPanel.vue'

const mocks = vi.hoisted(() => ({
  littleSkinManagement: vi.fn(),
  littleSkinCloset: vi.fn(),
  setLittleSkinTexture: vi.fn(),
  importLittleSkinTexture: vi.fn(),
  syncAccountTexture: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  texture: vi.fn(),
}))
vi.mock('@/features/accounts/api/accountsApi', () => ({ accountsApi: mocks }))
vi.mock('@/composables/useAvatarRenderer', () => ({ fetchTextureDataUrl: mocks.texture }))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: mocks.success, error: mocks.error }),
}))
const wrappers: ReturnType<typeof mount>[] = []
const player = { pid: 7, name: 'Player', tid_skin: 1, tid_cape: 0 }
const texture = { tid: 2, name: 'Cloud Skin', type: 'alex', hash: 'a'.repeat(64) }
function render() {
  const wrapper = mount(LittleSkinClosetPanel, {
    props: { accountId: 'A' },
    global: {
      plugins: [i18n],
      stubs: {
        LittleSkinLoginPanel: true,
        UiLoading: { template: '<div><slot /></div>' },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  i18n.global.locale.value = 'zh-CN'
  mocks.littleSkinManagement.mockResolvedValue({ needs_authorization: false, player })
  mocks.littleSkinCloset.mockResolvedValue({ current_page: 1, last_page: 1, total: 1, data: [texture] })
  mocks.texture.mockResolvedValue('data:image/png;base64,preview')
  mocks.setLittleSkinTexture.mockResolvedValue({ ...player, tid_skin: 2 })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('LittleSkin cloud wardrobe', () => {
  it('previews without writing and writes only after the wear action', async () => {
    const wrapper = render()
    await flushPromises()
    const name = wrapper.get('button[aria-label="Cloud Skin"]')
    await name.trigger('click')
    await flushPromises()
    expect(mocks.setLittleSkinTexture).not.toHaveBeenCalled()
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toEqual({
      skinUrl: 'data:image/png;base64,preview',
      skinModel: 'slim',
    })
    const wear = wrapper.get('button[aria-label="穿戴"]')
    await wear.trigger('click')
    await flushPromises()
    expect(mocks.setLittleSkinTexture).toHaveBeenCalledExactlyOnceWith('A', 'skin', 2)
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toEqual({})
    expect(wrapper.get('button[aria-label="穿戴"]').attributes()).toHaveProperty('disabled')
    const status = wrapper.get('.wardrobe-card-detail')
    expect(status.text()).toBe('正在使用')
    expect(name.attributes('aria-describedby')).toBe(status.attributes('id'))
  })
  it('blocks duplicate writes while the first request is running', async () => {
    const pending = deferred<typeof player>()
    mocks.setLittleSkinTexture.mockReturnValue(pending.promise)
    const wrapper = render()
    await flushPromises()
    const wear = wrapper.get('button[aria-label="穿戴"]')
    await wear.trigger('click')
    await wear.trigger('click')
    expect(mocks.setLittleSkinTexture).toHaveBeenCalledTimes(1)
    pending.resolve(player)
    await flushPromises()
  })
  it('does not display the old account closet after switching accounts', async () => {
    const pending = deferred<{ needs_authorization: boolean; player: typeof player }>()
    mocks.littleSkinManagement.mockImplementation((id: string) =>
      id === 'A' ? pending.promise : Promise.resolve({ needs_authorization: true, player: null })
    )
    const wrapper = render()
    await wrapper.setProps({ accountId: 'B' })
    await flushPromises()
    pending.resolve({ needs_authorization: false, player })
    await flushPromises()
    expect(wrapper.text()).toContain('补充授权')
    expect(mocks.littleSkinCloset).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Cloud Skin')
  })
  it('distinguishes a network failure from missing authorization', async () => {
    mocks.littleSkinManagement.mockRejectedValue(new Error('Network'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('操作失败')
    expect(wrapper.text()).not.toContain('授权账户管理')
  })
  it.each(['account', 'kind', 'page'] as const)('discards old thumbnails after a %s switch', async (target) => {
    const pending = deferred<string>()
    const nextTexture = {
      ...texture,
      name: 'New Cloud Texture',
      hash: 'b'.repeat(64),
      type: target === 'kind' ? 'cape' : 'alex',
    }
    mocks.littleSkinCloset
      .mockResolvedValueOnce({ current_page: 1, last_page: 2, total: 2, data: [texture] })
      .mockResolvedValueOnce({ current_page: 1, last_page: 1, total: 1, data: [nextTexture] })
    mocks.texture.mockImplementation((url: string) =>
      url.endsWith(texture.hash) ? pending.promise : Promise.resolve('new-thumbnail.png')
    )
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('.wardrobe-card-placeholder').exists()).toBe(true)
    if (target === 'account') await wrapper.setProps({ accountId: 'B' })
    else {
      const label = target === 'kind' ? '披风' : '下一页'
      await wrapper
        .findAll('button')
        .find((button) => button.text() === label)!
        .trigger('click')
    }
    await flushPromises()
    pending.resolve('old-thumbnail.png')
    await flushPromises()
    expect(wrapper.get('.wardrobe-card img').attributes('src')).toBe('new-thumbnail.png')
    expect(wrapper.text()).not.toContain(texture.name)
  })
  it('keeps item actions available when the thumbnail and preview fail', async () => {
    mocks.texture.mockResolvedValue(null)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('.wardrobe-card-placeholder').exists()).toBe(true)
    const preview = wrapper.get('button[aria-label="Cloud Skin"]')
    await preview.trigger('click')
    await flushPromises()
    expect(preview.attributes('aria-pressed')).toBe('true')
    expect(mocks.error).toHaveBeenCalledOnce()
    await wrapper.get('button[aria-label="下载到本地衣柜"]').trigger('click')
    await flushPromises()
    expect(mocks.importLittleSkinTexture).toHaveBeenCalledExactlyOnceWith('A', 'skin', 2)
    await wrapper.get('button[aria-label="穿戴"]').trigger('click')
    await flushPromises()
    expect(mocks.setLittleSkinTexture).toHaveBeenCalledExactlyOnceWith('A', 'skin', 2)
  })
  it('reports uncertain writes and waits for an explicit refresh', async () => {
    mocks.setLittleSkinTexture.mockRejectedValue(
      new BackendCommandError({ success: false, errorCode: 'LITTLESKIN_WRITE_UNCONFIRMED' }, 'Unconfirmed')
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('button[aria-label="穿戴"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('修改结果尚未确认')
    expect(mocks.setLittleSkinTexture).toHaveBeenCalledTimes(1)
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
