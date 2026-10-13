import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { invalidateResource, readResource, setResourceSnapshot } from './refreshCoordinator'

beforeEach(() => queryClient.clear())

describe('共享数据刷新协调', () => {
  it('十个消费者共用一次读取，返回独立的展示副本', async () => {
    const load = vi.fn(async () => [{ name: '原始值' }])
    const values = await Promise.all(Array.from({ length: 10 }, () => readResource({ queryKey: ['test'], load })))
    expect(load).toHaveBeenCalledOnce()
    values[0]![0]!.name = '编辑草稿'
    expect(values[1]![0]!.name).toBe('原始值')
    expect(await readResource({ queryKey: ['test'], load })).toEqual([{ name: '原始值' }])
  })

  it('在途读取期间多次失效只追加一次最终读取，不提交旧快照', async () => {
    let finish!: (value: string[]) => void
    const load = vi.fn().mockImplementationOnce(() => new Promise<string[]>((resolve) => (finish = resolve)))
    load.mockResolvedValue(['最新值'])
    const options = { queryKey: ['changing'], load }
    const first = readResource(options)
    await Promise.resolve()
    await Promise.all(Array.from({ length: 5 }, () => invalidateResource(options.queryKey)))
    const second = readResource(options)
    finish(['旧值'])
    expect(await first).toEqual(['最新值'])
    expect(await second).toEqual(['最新值'])
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('事件完整快照阻止旧结果回填，且无需再发起读取', async () => {
    let finish!: (value: string[]) => void
    const load = vi.fn(() => new Promise<string[]>((resolve) => (finish = resolve)))
    const reading = readResource({ queryKey: ['snapshot'], load })
    setResourceSnapshot(['snapshot'], ['事件新值'])
    finish(['旧值'])
    expect(await reading).toEqual(['事件新值'])
    expect(queryClient.getQueryData(['snapshot'])).toEqual(['事件新值'])
    expect(load).toHaveBeenCalledOnce()
  })

  it('同一有效刷新共用请求，失败后允许重试，不同参数不合并', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('读取失败')).mockResolvedValue([])
    await expect(readResource({ queryKey: ['resource', 'a'], load })).rejects.toThrow('读取失败')
    await readResource({ queryKey: ['resource', 'a'], load })
    await Promise.all(
      Array.from({ length: 10 }, () => readResource({ queryKey: ['resource', 'a'], load, force: true }))
    )
    expect(load).toHaveBeenCalledTimes(3)
    await readResource({ queryKey: ['resource', 'b'], load })
    expect(load).toHaveBeenCalledTimes(4)
  })

  it('变化持续发生时有重试上限，不无限等待', async () => {
    const queryKey = ['unstable']
    const load = vi.fn(async () => {
      await invalidateResource(queryKey)
      return []
    })
    await expect(readResource({ queryKey, load })).rejects.toThrow()
    expect(load).toHaveBeenCalledTimes(8)
  })
})
