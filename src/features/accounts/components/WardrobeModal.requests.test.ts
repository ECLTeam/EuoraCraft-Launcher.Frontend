import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { i18n } from '@/i18n'
import type { MicrosoftCape, MinecraftAccount, WardrobeItem } from '@/types/accounts'
import WardrobeModal from './WardrobeModal.vue'

const mocks = vi.hoisted(() => ({
  listWardrobe: vi.fn(),
  wardrobeTexture: vi.fn(),
  textureUrls: vi.fn(),
  fetchTexture: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/features/accounts/api/accountsApi', () => ({ accountsApi: mocks }))
vi.mock('@/features/accounts/stores/accountStore', () => ({ useAccountStore: () => ({}) }))
vi.mock('@/composables/useAvatarRenderer', () => ({
  fetchTextureDataUrl: mocks.fetchTexture,
  clearAvatarCache: vi.fn(),
}))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ warning: mocks.warning, error: mocks.warning }),
}))
vi.mock('@/composables/useUiSkin', () => ({ useUiSkin: () => ({ isFolia: false }) }))
const preview = defineComponent({
  name: 'SkinViewer3D',
  props: { skinUrl: { type: String, default: '' }, capeUrl: { type: String, default: '' } },
  template: '<div :data-skin="skinUrl" :data-cape="capeUrl" />',
})
const wrappers: ReturnType<typeof mount>[] = []
function mountWardrobe() {
  const wrapper = mount(WardrobeModal, {
    props: {
      visible: false,
      accounts: [
        { id: 'A', alias: 'A', type: 'offline' },
        { id: 'B', alias: 'B', type: 'offline' },
      ] as MinecraftAccount[],
      currentAccount: null,
    },
    global: {
      plugins: [i18n],
      stubs: {
        FullscreenModal: { template: '<div><slot /></div>' },
        Modal: true,
        UiIcon: true,
        UiLoading: { template: '<div><slot /></div>' },
        SkinViewer3D: preview,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => {
  mocks.listWardrobe.mockResolvedValue([])
  mocks.wardrobeTexture.mockResolvedValue('')
  mocks.textureUrls.mockImplementation(async (id: string) => ({ skinUrl: id, capeUrl: '', skinModel: 'classic' }))
  mocks.fetchTexture.mockImplementation(async (url: string) => url)
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('衣柜预览请求归属', () => {
  it('官方披风的迟到纹理不能覆盖新选择', async () => {
    const wrapper = mountWardrobe()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const old = deferred<string>()
    mocks.fetchTexture.mockImplementation((url: string) => (url === 'old-cape' ? old.promise : Promise.resolve(url)))
    const vm = wrapper.vm as unknown as { selectOfficialCape: (cape: MicrosoftCape) => Promise<void> }
    const first = vm.selectOfficialCape({ id: 'old', url: 'old-cape', state: 'INACTIVE' })
    await vm.selectOfficialCape({ id: 'new', url: 'new-cape', state: 'INACTIVE' })
    old.resolve('old-cape')
    await first
    await flushPromises()
    expect(wrapper.findComponent(preview).props('capeUrl')).toBe('new-cape')
  })
  it('本地 old→new 的旧纹理不能覆盖新选择', async () => {
    const wrapper = mountWardrobe()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const old = deferred<string>()
    mocks.wardrobeTexture.mockImplementation((id: string) =>
      id === 'old' ? old.promise : Promise.resolve('new-image')
    )
    const vm = wrapper.vm as unknown as { selectLocal: (item: WardrobeItem) => Promise<void> }
    const item = { kind: 'skin', name: 'skin', model: 'classic' } as WardrobeItem
    const first = vm.selectLocal({ ...item, id: 'old' })
    await vm.selectLocal({ ...item, id: 'new' })
    old.resolve('old-image')
    await first
    await flushPromises()
    expect(wrapper.findComponent(preview).props('skinUrl')).toBe('new-image')
  })

  it('账户 A 在加载图片期间切到 B，迟到图片与错误均被忽略', async () => {
    const old = deferred<string>()
    mocks.fetchTexture.mockImplementation((url: string) => (url === 'A' ? old.promise : Promise.resolve(url)))
    const wrapper = mountWardrobe()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const vm = wrapper.vm as unknown as { targetAccountId: string }
    vm.targetAccountId = 'B'
    await flushPromises()
    old.reject(new Error('old failure'))
    await flushPromises()
    expect(wrapper.findComponent(preview).props('skinUrl')).toBe('B')
    expect(mocks.warning).not.toHaveBeenCalled()
  })

  it('关闭后不提交账户图片', async () => {
    const old = deferred<string>()
    mocks.fetchTexture.mockImplementation((url: string) => (url === 'A' ? old.promise : Promise.resolve(url)))
    const wrapper = mountWardrobe()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    await wrapper.setProps({ visible: false })
    old.resolve('closed-image')
    await flushPromises()
    expect(wrapper.findComponent(preview).props('skinUrl')).toBe('')
  })
})
