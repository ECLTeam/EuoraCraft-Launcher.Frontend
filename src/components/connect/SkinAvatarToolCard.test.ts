import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkinAvatarError } from '@/features/tools/skinAvatar'
import type * as SkinAvatarModule from '@/features/tools/skinAvatar'
import { i18n } from '@/i18n'
import SkinAvatarToolCard from './SkinAvatarToolCard.vue'

const mocks = vi.hoisted(() => ({ command: vi.fn(), load: vi.fn(), render: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))
vi.mock('@/features/tools/skinAvatar', async (original) => ({
  ...(await original<typeof SkinAvatarModule>()),
  loadSkinPixels: mocks.load,
  renderAvatarPng: mocks.render,
}))

const pixels = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) }
function mountCard() {
  i18n.global.locale.value = 'zh-CN'
  return mount(SkinAvatarToolCard, { global: { plugins: [i18n] } })
}
function button(wrapper: ReturnType<typeof mountCard>, label: string) {
  return wrapper.findAll('button').find((element) => element.text().includes(label))!
}
async function importSkin(wrapper: ReturnType<typeof mountCard>) {
  await button(wrapper, '选择皮肤').trigger('click')
  await flushPromises()
}

describe('SkinAvatarToolCard', () => {
  beforeEach(() => {
    mocks.command.mockReset().mockImplementation(async (name: string) => ({
      success: true,
      data:
        name === 'select_image'
          ? { path: 'D:/skin.png' }
          : name === 'fs_read_file'
            ? { content: 'encoded', size: 100 }
            : { path: 'D:/avatar.png' },
    }))
    mocks.load.mockReset().mockResolvedValue(pixels)
    mocks.render.mockReset().mockReturnValue('data:image/png;base64,avatar')
  })

  it('keeps the primary actions visible with settings closed and export unavailable before import', () => {
    const wrapper = mountCard()
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(button(wrapper, '导出 PNG').attributes('disabled')).toBeDefined()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(mocks.command).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('imports a local skin and exports the exact preview with the current settings', async () => {
    const wrapper = mountCard()
    await importSkin(wrapper)
    expect(mocks.command).toHaveBeenCalledWith('select_image', { purpose: 'skin' })
    expect(mocks.command).toHaveBeenCalledWith('fs_read_file', { path: 'D:/skin.png', mode: 'base64' })
    expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,avatar')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await wrapper.get('input[type="radio"][value="256"]').setValue(true)
    expect(wrapper.text()).toContain('256 × 256 · 帽子层关闭')
    expect(mocks.render).toHaveBeenLastCalledWith(pixels, 256, false)
    await button(wrapper, '导出 PNG').trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenLastCalledWith('skin_avatar_export', {
      data_url: 'data:image/png;base64,avatar',
      size: 256,
      source_path: 'D:/skin.png',
    })
    expect(wrapper.get('[role="status"]').text()).toBe('头像已导出')
    wrapper.unmount()
  })

  it('preserves a valid preview after a cancelled or damaged import', async () => {
    const wrapper = mountCard()
    await importSkin(wrapper)
    mocks.command.mockResolvedValueOnce({ success: true, data: { path: null } })
    await importSkin(wrapper)
    expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,avatar')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    mocks.load.mockRejectedValueOnce(new SkinAvatarError('decodeFailed'))
    await importSkin(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('损坏')
    expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,avatar')
    expect(button(wrapper, '导出 PNG').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('treats export cancellation as normal and prevents duplicate exports', async () => {
    const wrapper = mountCard()
    await importSkin(wrapper)
    let finish!: (value: unknown) => void
    mocks.command.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    await button(wrapper, '导出 PNG').trigger('click')
    await button(wrapper, '导出 PNG').trigger('click')
    expect(mocks.command.mock.calls.filter(([name]) => name === 'skin_avatar_export')).toHaveLength(1)
    expect(wrapper.get('input[type="checkbox"]').attributes('disabled')).toBeDefined()
    finish({ success: true, data: { path: null } })
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(button(wrapper, '导出 PNG').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows a localized source conflict and allows another export', async () => {
    const wrapper = mountCard()
    await importSkin(wrapper)
    mocks.command.mockResolvedValueOnce({ success: false, errorCode: 'SKIN_AVATAR_SOURCE_CONFLICT', message: 'raw' })
    await button(wrapper, '导出 PNG').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('不能覆盖导入的皮肤')
    expect(wrapper.text()).not.toContain('raw')
    expect(button(wrapper, '导出 PNG').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('ignores an import response after leaving the page', async () => {
    let finish!: (value: unknown) => void
    mocks.command.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    const wrapper = mountCard()
    await button(wrapper, '选择皮肤').trigger('click')
    wrapper.unmount()
    finish({ success: true, data: { path: 'D:/late.png' } })
    await flushPromises()
    expect(mocks.load).not.toHaveBeenCalled()
    expect(mocks.command).toHaveBeenCalledTimes(1)
  })
})
