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
      downloadDirectory: '',
      namingMode: 'original',
      customName: '',
      userAgent: '',
      headers: [],
      nextHeaderId: 0,
      overwrite: false,
      operationId: '',
      operation: null,
    })
    mocks.command.mockReset()
    i18n.global.locale.value = 'zh-CN'
  })
  it('uses the chosen folder and original naming without overwriting by default', async () => {
    mocks.command.mockImplementation(async (name: string) => ({
      success: true,
      data:
        name === 'custom_download_defaults'
          ? { downloadDirectory: 'D:/Data/downloads', userAgent: 'EuoraCraft-Launcher' }
          : name === 'custom_download_start'
            ? { operationId: 'download1', status: 'pending' }
            : { operationId: 'download1', status: 'completed', percent: 100, message: '操作完成' },
    }))
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await wrapper.findAll('input')[0]!.setValue('https://host.test/archive.zip')
    await wrapper.findAll('input')[1]!.setValue('D:/Downloads')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('开始下载'))!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('custom_download_start', {
      url: 'https://host.test/archive.zip',
      download_directory: 'D:/Downloads',
      naming_mode: 'original',
      user_agent: '',
      headers: {},
      overwrite: false,
    })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    wrapper.unmount()
  })
  it('uses a folder dialog and retains the selected folder when cancelled', async () => {
    mocks.command.mockImplementation(async (name: string) => ({
      success: true,
      data:
        name === 'custom_download_defaults'
          ? { downloadDirectory: 'D:/Data/downloads', userAgent: 'EuoraCraft-Launcher' }
          : { path: null },
    }))
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await wrapper.findAll('input')[1]!.setValue('D:/Existing')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('浏览'))!
      .trigger('click')
    await flushPromises()
    expect((wrapper.findAll('input')[1]!.element as HTMLInputElement).value).toBe('D:/Existing')
    expect(mocks.command).toHaveBeenCalledWith('select_directory', {
      purpose: 'custom-download',
      default_directory: 'D:/Existing',
    })
    wrapper.unmount()
  })
  it('retains an active task across page navigation and can cancel after remount', async () => {
    let status = 'running'
    mocks.command.mockImplementation(async (name: string) => {
      if (name === 'custom_download_defaults')
        return { success: true, data: { downloadDirectory: 'D:/Data/downloads', userAgent: 'EuoraCraft-Launcher' } }
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
    await first.findAll('input')[1]!.setValue('D:/Downloads')
    await first
      .findAll('button')
      .find((button) => button.text().includes('开始下载'))!
      .trigger('click')
    await flushPromises()
    first.unmount()
    const second = mount(CustomDownloadCard, { global: { plugins: [i18n], stubs: { UiIcon: true } } })
    await flushPromises()
    expect((second.findAll('input')[1]!.element as HTMLInputElement).value).toBe('D:/Downloads')
    await second
      .findAll('button')
      .find((button) => button.text() === '取消')!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('game_operation_cancel', { operation_id: 'active-download' })
    expect(second.findAll('button').some((button) => button.text() === '重试')).toBe(true)
    second.unmount()
  })

  it('loads defaults without replacing a folder chosen while the request was pending', async () => {
    let resolveDefaults!: (value: unknown) => void
    mocks.command.mockReturnValue(
      new Promise((resolve) => {
        resolveDefaults = resolve
      })
    )
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n] } })
    useCustomDownloadStore().downloadDirectory = 'D:/Chosen'
    resolveDefaults({ success: true, data: { downloadDirectory: 'D:/Default', userAgent: 'Default-UA' } })
    await flushPromises()
    expect(useCustomDownloadStore().downloadDirectory).toBe('D:/Chosen')
    expect(useCustomDownloadStore().defaultUserAgent).toBe('Default-UA')
    wrapper.unmount()
  })

  it('submits an exact custom filename, UA and headers and shows the resolved destination', async () => {
    mocks.command.mockImplementation(async (name: string) => ({
      success: true,
      data:
        name === 'custom_download_defaults'
          ? { downloadDirectory: 'D:/Default', userAgent: 'EuoraCraft-Launcher' }
          : name === 'custom_download_start'
            ? { operationId: 'custom', status: 'pending' }
            : {
                operationId: 'custom',
                status: 'completed',
                percent: 100,
                message: '操作完成',
                path: 'D:/Chosen/精确名称',
              },
    }))
    Object.assign(useCustomDownloadStore(), {
      url: 'https://host/file',
      downloadDirectory: 'D:/Chosen',
      namingMode: 'custom',
      customName: '精确名称',
      userAgent: 'My-UA',
      headers: [
        { id: 0, name: 'Referer', value: 'https://example.com' },
        { id: 1, name: '', value: '' },
      ],
    })
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n] } })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('开始下载'))!
      .trigger('click')
    await flushPromises()
    expect(mocks.command).toHaveBeenCalledWith('custom_download_start', {
      url: 'https://host/file',
      download_directory: 'D:/Chosen',
      naming_mode: 'custom',
      custom_name: '精确名称',
      user_agent: 'My-UA',
      headers: { Referer: 'https://example.com' },
      overwrite: false,
    })
    expect(wrapper.text()).toContain('D:/Chosen/精确名称')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    wrapper.unmount()
  })

  it.each([
    { customName: '../bad', namingMode: 'custom', headers: [] },
    { customName: 'CON.zip', namingMode: 'custom', headers: [] },
    {
      namingMode: 'original',
      headers: [
        { id: 0, name: 'X-Test', value: 'a' },
        { id: 1, name: 'x-test', value: 'b' },
      ],
    },
    { namingMode: 'original', headers: [{ id: 0, name: 'User-Agent', value: 'a' }] },
  ])('blocks invalid filenames or conflicting headers: %j', async (options) => {
    mocks.command.mockResolvedValue({
      success: true,
      data: { downloadDirectory: 'D:/Default', userAgent: 'EuoraCraft-Launcher' },
    })
    Object.assign(useCustomDownloadStore(), { url: 'https://host/file', ...options })
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('开始下载'))!
        .attributes('disabled')
    ).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
    expect(mocks.command).not.toHaveBeenCalledWith('custom_download_start', expect.anything())
    wrapper.unmount()
  })

  it('can add and remove header rows without losing the remaining values', async () => {
    mocks.command.mockResolvedValue({
      success: true,
      data: { downloadDirectory: 'D:/Default', userAgent: 'EuoraCraft-Launcher' },
    })
    const wrapper = mount(CustomDownloadCard, { global: { plugins: [i18n] } })
    const add = () => wrapper.findAll('button').find((button) => button.text().includes('添加请求头'))!
    await add().trigger('click')
    await add().trigger('click')
    const store = useCustomDownloadStore()
    store.headers[1]!.name = 'Cookie'
    store.headers[1]!.value = 'session=local'
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '移除')!
      .trigger('click')
    expect(store.headers).toEqual([{ id: 1, name: 'Cookie', value: 'session=local' }])
    wrapper.unmount()
  })
})
