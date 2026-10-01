import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCustomDownloadStore } from '@/features/download/stores/customDownloadStore'
import { i18n } from '@/i18n'
import CustomDownloadCard from './CustomDownloadCard.vue'
const mocks = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))

describe('CustomDownloadCard', () => {
  beforeEach(() => {
    Object.assign(useCustomDownloadStore(), {
      url: '',
      targetPath: '',
      overwrite: false,
      operationId: '',
      operation: null,
    })
    mocks.command.mockReset()
    i18n.global.locale.value = 'zh-CN'
  })
  it('uses the full chosen path and keeps overwrite disabled by default', async () => {
    mocks.command.mockImplementation(async (name: string) => ({
      success: true,
      data:
        name === 'custom_download_start'
          ? { operationId: 'download1', status: 'pending' }
          : { operationId: 'download1', status: 'completed', percent: 100, message: '操作完成' },
    }))
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await wrapper.findAll('input')[0]!.setValue('https://host.test/archive.zip')
    await wrapper.findAll('input')[1]!.setValue('D:/Downloads/自定义.zip')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('开始下载'))!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('custom_download_start', {
      url: 'https://host.test/archive.zip',
      target_path: 'D:/Downloads/自定义.zip',
      overwrite: false,
    })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    wrapper.unmount()
  })
  it('does not alter the path if the save dialog is cancelled', async () => {
    mocks.command.mockResolvedValue({ success: true, data: { path: null } })
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await wrapper.findAll('input')[1]!.setValue('D:/Existing/file.bin')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('浏览'))!
      .trigger('click')
    await flushPromises()
    expect((wrapper.findAll('input')[1]!.element as HTMLInputElement).value).toBe('D:/Existing/file.bin')
    wrapper.unmount()
  })
  it('retains an active task across page navigation and can cancel after remount', async () => {
    let status = 'running'
    mocks.command.mockImplementation(async (name: string) => {
      if (name === 'custom_download_start')
        return { success: true, data: { operationId: 'active-download', status: 'pending' } }
      if (name === 'game_operation_cancel') {
        status = 'cancelled'
        return { success: true, data: true }
      }
      return { success: true, data: { operationId: 'active-download', status, percent: 20, message: '正在下载' } }
    })
    const first = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await first.findAll('input')[0]!.setValue('https://host.test/file')
    await first.findAll('input')[1]!.setValue('D:/file.bin')
    await first
      .findAll('button')
      .find((button) => button.text().includes('开始下载'))!
      .trigger('click')
    await flushPromises()
    first.unmount()
    const second = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await flushPromises()
    expect((second.findAll('input')[1]!.element as HTMLInputElement).value).toBe('D:/file.bin')
    await second
      .findAll('button')
      .find((button) => button.text() === '取消')!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('game_operation_cancel', { operation_id: 'active-download' })
    expect(second.findAll('button').some((button) => button.text() === '重试')).toBe(true)
    second.unmount()
  })
})
