import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAsyncAction } from './useAsyncAction'

const messages = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('./useLauncherMessage', () => ({
  useLauncherMessage: () => messages,
}))

describe('useAsyncAction', () => {
  it('跳过的动作不提示成功，并发动作全部结束才清除 loading', async () => {
    const action = useAsyncAction({ showSuccess: true, successMessage: 'done' })
    let finish!: () => void
    const pending = action.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    await action.run(() => Promise.resolve({ status: 'skipped' as const }))
    expect(messages.success).not.toHaveBeenCalled()
    expect(action.loading.value).toBe(true)
    finish()
    await pending
    expect(action.loading.value).toBe(false)
  })
  beforeEach(() => vi.clearAllMocks())

  it('does not show a success message when an action is cancelled', async () => {
    const { run } = useAsyncAction()

    const result = await run(() => Promise.resolve(false), {
      showSuccess: true,
      successMessage: 'installed',
    })

    expect(result).toBe(false)
    expect(messages.success).not.toHaveBeenCalled()
  })

  it('continues to show success for void actions', async () => {
    const { run } = useAsyncAction()

    await run(() => Promise.resolve(), {
      showSuccess: true,
      successMessage: 'done',
    })

    expect(messages.success).toHaveBeenCalledWith('done')
  })
})
