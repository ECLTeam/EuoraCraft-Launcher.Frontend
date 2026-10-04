import { describe, expect, it, vi } from 'vitest'
import { createInstanceSaveSession } from './instanceSaveSession'

describe('实例保存会话', () => {
  it('提交 A 时编辑 B，按顺序持久化并保留失败的 B 供切页后恢复', async () => {
    const session = createInstanceSaveSession<{ alias: string }>()
    let finish!: () => void
    const write = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          })
      )
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValue(undefined)
    const a = { alias: 'A' }
    const first = session.enqueue('target', a, write)
    a.alias = 'caller edited'
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    const second = session.enqueue('target', { alias: 'B' }, write)
    const failed = expect(second).rejects.toThrow('write failed')
    expect(session.draft('target')).toEqual({ alias: 'B' })
    finish()
    await first
    await failed
    expect(write.mock.calls.map((call) => call[0])).toEqual([{ alias: 'A' }, { alias: 'B' }])
    expect(session.draft('target')).toEqual({ alias: 'B' })
    await session.enqueue('target', session.draft('target')!, write)
    expect(session.draft('target')).toBeUndefined()
  })

  it('重复 flush 相同在途快照只执行一次，不同目标可以独立保存', async () => {
    const session = createInstanceSaveSession<{ alias: string }>()
    let finish!: () => void
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const first = session.enqueue('A', { alias: 'A' }, write)
    expect(session.enqueue('A', { alias: 'A' }, write)).toBe(first)
    await session.enqueue('B', { alias: 'B' }, async () => undefined)
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce())
    finish()
    await first
    expect(session.draft('A')).toBeUndefined()
  })
})
