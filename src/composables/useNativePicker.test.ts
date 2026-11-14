import { describe, expect, it } from 'vitest'
import { useNativePicker } from './useNativePicker'

describe('useNativePicker', () => {
  it('在途期间重复调用直接返回 null，且不重复执行动作', async () => {
    const picker = useNativePicker()
    let finish!: (value: string) => void
    let calls = 0
    const first = picker.pick(
      () =>
        new Promise<string>((resolve) => {
          calls++
          finish = resolve
        })
    )

    expect(picker.pending.value).toBe(true)
    const second = await picker.pick(() => {
      calls++
      return Promise.resolve('second')
    })

    expect(second).toBeNull()
    expect(calls).toBe(1)

    finish('first')
    expect(await first).toBe('first')
    expect(picker.pending.value).toBe(false)
  })

  it('动作抛错后仍然释放 pending，可以再次选择', async () => {
    const picker = useNativePicker()
    await expect(
      picker.pick(() => {
        throw new Error('失败')
      })
    ).rejects.toThrow('失败')

    expect(picker.pending.value).toBe(false)
    expect(await picker.pick(() => Promise.resolve('again'))).toBe('again')
  })
})
