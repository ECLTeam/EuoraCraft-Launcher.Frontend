import { beforeEach, expect, it, vi } from 'vitest'
import { acceptConfigSnapshot } from '@/app/data/configQueries'
import { queryClient } from '@/app/queryClient'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { setLauncherConfig } from './api'

const mocks = vi.hoisted(() => ({ set: vi.fn() }))
vi.mock('@/api/client', () => ({
  default: { config: { set: mocks.set }, command: vi.fn(), on: vi.fn(), runtime: {} },
}))
vi.mock('@/features/settings/api/settingsApi', () => ({ settingsApi: { load: vi.fn() } }))

beforeEach(() => {
  queryClient.clear()
  vi.clearAllMocks()
  vi.mocked(settingsApi.load).mockResolvedValue({
    ui: { locale: 'zh-CN' },
    game: { minecraft_paths: [] },
    launcher: {},
    download: { mirror_source: 'official' },
    connector: { mode: 'automatic', nodes: [] },
  })
  mocks.set.mockImplementation(async (section, data) => ({ success: true, data: { section, data, effective: true } }))
})

it('SDK 配置与主界面共享确认快照，相同值不请求保存且保持返回契约', async () => {
  expect(await setLauncherConfig('ui', { locale: 'zh-CN' })).toMatchObject({ success: true, data: undefined })
  expect(mocks.set).not.toHaveBeenCalled()
  await setLauncherConfig('ui', { locale: 'en-US' })
  await setLauncherConfig('ui', { locale: 'en-US' })
  expect(mocks.set).toHaveBeenCalledOnce()
  acceptConfigSnapshot({ section: 'ui', data: { locale: 'de-DE' }, effective: true })
  await setLauncherConfig('ui', { locale: 'de-DE' })
  expect(mocks.set).toHaveBeenCalledOnce()
})

it('SDK 写入失败不更新确认值，相同内容随后可以重试', async () => {
  mocks.set.mockResolvedValueOnce({ success: false, message: 'write failed' })
  expect(await setLauncherConfig('ui', { locale: 'en-US' })).toMatchObject({ success: false })
  expect(await setLauncherConfig('ui', { locale: 'en-US' })).toMatchObject({ success: true })
  expect(mocks.set).toHaveBeenCalledTimes(2)
})
