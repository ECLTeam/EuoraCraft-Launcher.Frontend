import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { desktopWindow } from './desktopWindow'
import { detectActiveWindowChrome, useActiveWindowChrome, useSystemShadowSupported } from './windowChrome'

const command = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', () => ({ default: { runtime: { isAvailable: true, isDesktop: true }, command } }))

describe('detectActiveWindowChrome', () => {
  afterEach(() => {
    document.querySelector('#chrome-test-mount')?.remove()
    vi.restoreAllMocks()
    command.mockReset()
    // 数据层按 queryKey 缓存启动器信息，逐例清空才能验证每次实际请求。
    queryClient.clear()
  })

  it('按当前窗口实际装饰状态选择布局', async () => {
    vi.spyOn(desktopWindow, 'isDecorated').mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    command.mockResolvedValue({ success: true, data: { active_window_chrome: 'custom' } })

    await detectActiveWindowChrome()
    expect(useActiveWindowChrome().value).toBe('native')

    await detectActiveWindowChrome()
    expect(useActiveWindowChrome().value).toBe('custom')
  })

  it('无法读取窗口状态时安全回退到自绘布局', async () => {
    vi.spyOn(desktopWindow, 'isDecorated').mockRejectedValue(new Error('window unavailable'))
    command.mockResolvedValue({ success: false })

    await detectActiveWindowChrome()

    expect(useActiveWindowChrome().value).toBe('custom')
  })

  it('无系统标题栏时按启动快照使用系统阴影，保存设置不会提前改变外观', async () => {
    const mountHost = document.createElement('div')
    mountHost.id = 'chrome-test-mount'
    mountHost.innerHTML = '<div id="app"></div>'
    document.body.append(mountHost)
    vi.spyOn(desktopWindow, 'isDecorated').mockResolvedValue(false)
    command.mockResolvedValue({
      success: true,
      data: { active_window_chrome: 'system_shadow', system_shadow_supported: true },
    })

    await detectActiveWindowChrome()

    expect(useActiveWindowChrome().value).toBe('system_shadow')
    expect(document.querySelector('#app')?.getAttribute('data-window-chrome')).toBe('system_shadow')
    expect(useSystemShadowSupported().value).toBe(true)
    expect(command).toHaveBeenCalledWith('launcher_info', undefined, 3000)
  })

  it('实际有系统标题栏时以窗口装饰状态为准', async () => {
    vi.spyOn(desktopWindow, 'isDecorated').mockResolvedValue(true)
    command.mockResolvedValue({ success: true, data: { active_window_chrome: 'system_shadow' } })

    await detectActiveWindowChrome()

    expect(useActiveWindowChrome().value).toBe('native')
  })
})
