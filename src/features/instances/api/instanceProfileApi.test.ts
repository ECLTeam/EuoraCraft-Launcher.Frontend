import { beforeEach, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import type { BackendMockState } from '@/test/mockBackend'
import { instanceProfileApi } from './instanceProfileApi'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({}))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})
const category = { id: 'custom', name: '自定义', color: '#778899', order: 50, builtin: false }
beforeEach(() => {
  queryClient.clear()
  mock.state!.mocks.command.mockReset().mockResolvedValue({ success: true, data: [category] })
})

it('列表、详情和分类窗口共享一次读取，重新进入不重复请求', async () => {
  await Promise.all([instanceProfileApi.categories(), instanceProfileApi.categories(), instanceProfileApi.categories()])
  await instanceProfileApi.categories()
  expect(mock.state!.mocks.command).toHaveBeenCalledOnce()
})

it('有效分类事件先于写入响应时不再回读，所有消费者得到更新', async () => {
  await instanceProfileApi.categories()
  const updated = { ...category, name: '新名称' }
  mock.state!.mocks.command.mockImplementationOnce(async () => {
    instanceProfileApi.acceptCategoriesSnapshot([updated])
    return { success: true, data: updated }
  })
  await instanceProfileApi.upsertCategory(updated)
  expect(await instanceProfileApi.categories()).toEqual([updated])
  expect(mock.state!.mocks.command).toHaveBeenCalledTimes(2)
})

it('错误结构不缓存，重试可以取得正确分类', async () => {
  mock.state!.mocks.command.mockResolvedValueOnce({ success: true, data: [{ id: 42 }] })
  await expect(instanceProfileApi.categories()).rejects.toThrow()
  expect(await instanceProfileApi.categories()).toEqual([category])
})

it('资料并发读取共用请求，保存响应阻止旧资料回填', async () => {
  const target = { gamePath: 'C:/Minecraft', versionId: 'fixture' }
  let finish!: (value: unknown) => void
  mock.state!.mocks.command.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
  const readings = [instanceProfileApi.get(target), instanceProfileApi.get(target)]
  const updated = { schemaVersion: 1, alias: '新名称' }
  mock.state!.mocks.command.mockResolvedValueOnce({ success: true, data: updated })
  await instanceProfileApi.patch(target, { alias: '新名称' })
  finish({ success: true, data: { schemaVersion: 1, alias: '旧名称' } })
  expect(await Promise.all(readings)).toEqual([updated, updated])
  expect(mock.state!.mocks.command).toHaveBeenCalledTimes(2)
})
