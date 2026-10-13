import { beforeEach, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { acceptConfigSnapshot, configQuery, serializeConfigWrite } from './configQueries'

vi.mock('@/features/settings/api/settingsApi', () => ({ settingsApi: { load: vi.fn() } }))

beforeEach(() => {
  queryClient.clear()
  vi.clearAllMocks()
  vi.mocked(settingsApi.load).mockResolvedValue({
    ui: {},
    game: { minecraft_paths: [] },
    download: { mirror_source: 'official' },
    launcher: {},
    connector: { mode: 'automatic', nodes: [] },
  })
})

it('写入响应和有效配置事件共用快照，读取没有额外 IPC，旧事件不被误当有效值', async () => {
  await configQuery()
  expect(acceptConfigSnapshot({ section: 'launcher', data: { debug: true }, effective: true })).toBe(true)
  expect(acceptConfigSnapshot({ section: 'launcher', data: { debug: false } })).toBe(false)
  expect((await configQuery()).launcher.debug).toBe(true)
  expect(settingsApi.load).toHaveBeenCalledOnce()
  expect(() => acceptConfigSnapshot({ section: 'game', data: { minecraft_paths: 42 }, effective: true })).toThrow()
})

it('所有调用方共享分区写入队列，失败后后续操作仍执行', async () => {
  const order: string[] = []
  const first = serializeConfigWrite('ui', async () => {
    order.push('一')
    throw new Error('失败')
  })
  const second = serializeConfigWrite('ui', async () => {
    order.push('二')
  })
  await expect(first).rejects.toThrow('失败')
  await second
  expect(order).toEqual(['一', '二'])
})
