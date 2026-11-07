import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import type { BackendMockState } from '@/test/mockBackend'
import { accountsApi } from './accountsApi'
import { invalidateLittleSkinWardrobe, isLittleSkinWardrobeCached } from './littleSkinWardrobeCache'

const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})

const { command } = mock.state!.mocks
const player = { pid: 1, name: 'Player', tid_skin: 0, tid_cape: 0 }
const management = { needs_authorization: false, player }
const firstPage = { current_page: 1, last_page: 2, total: 1, data: [] }
const secondPage = { ...firstPage, current_page: 2 }
const success = <T>(data: T) => ({ success: true, data })

beforeEach(() => command.mockReset())
afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('LittleSkin wardrobe cache', () => {
  it('coalesces concurrent reads and refetches management after 60 seconds', async () => {
    let now = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    command.mockResolvedValueOnce(success(management)).mockResolvedValueOnce(success(management))

    await expect(
      Promise.all([accountsApi.littleSkinManagement('A'), accountsApi.littleSkinManagement('A')])
    ).resolves.toEqual([management, management])
    now += 59_999
    await accountsApi.littleSkinManagement('A')
    expect(command).toHaveBeenCalledTimes(1)

    now += 1
    await accountsApi.littleSkinManagement('A')
    expect(command).toHaveBeenCalledTimes(2)
  })

  it('reuses successful empty pages and keeps accounts, kinds and page numbers separate', async () => {
    command
      .mockResolvedValueOnce(success(management))
      .mockResolvedValueOnce(success(firstPage))
      .mockResolvedValueOnce(success(secondPage))
      .mockResolvedValueOnce(success(firstPage))
      .mockResolvedValueOnce(success(firstPage))

    await accountsApi.littleSkinManagement('A')
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    await accountsApi.littleSkinCloset('A', 'skin', 2)
    await accountsApi.littleSkinCloset('A', 'cape', 1)
    await accountsApi.littleSkinCloset('B', 'skin', 1)

    expect(isLittleSkinWardrobeCached('A', 'skin', 1)).toBe(true)
    expect(isLittleSkinWardrobeCached('B', 'skin', 1)).toBe(false)
    await expect(accountsApi.littleSkinCloset('A', 'skin', 1)).resolves.toEqual(firstPage)
    expect(command.mock.calls.map(([name, payload]) => [name, payload])).toEqual([
      ['accounts_littleskin_management', { account_id: 'A' }],
      ['accounts_littleskin_closet', { account_id: 'A', kind: 'skin', page: 1 }],
      ['accounts_littleskin_closet', { account_id: 'A', kind: 'skin', page: 2 }],
      ['accounts_littleskin_closet', { account_id: 'A', kind: 'cape', page: 1 }],
      ['accounts_littleskin_closet', { account_id: 'B', kind: 'skin', page: 1 }],
    ])
  })

  it('refreshes the current account and leaves other accounts cached', async () => {
    command.mockResolvedValue(success(firstPage))
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    await accountsApi.littleSkinCloset('A', 'cape', 1)
    await accountsApi.littleSkinCloset('B', 'skin', 1)
    command.mockResolvedValueOnce(success(management))
    await accountsApi.littleSkinManagement('A')

    await invalidateLittleSkinWardrobe('A')
    expect(command).toHaveBeenCalledTimes(4)
    command.mockResolvedValueOnce(success(management))
    await accountsApi.littleSkinManagement('A')
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    await accountsApi.littleSkinCloset('B', 'skin', 1)
    expect(isLittleSkinWardrobeCached('A', 'cape', 1)).toBe(false)
    await accountsApi.littleSkinCloset('A', 'cape', 1)
    expect(command).toHaveBeenCalledTimes(7)
  })

  it('discards a page response started before refresh', async () => {
    const oldPage = success({ ...firstPage, total: 0 })
    let finishRead!: (response: typeof oldPage) => void
    const pending = new Promise<typeof oldPage>((resolve) => (finishRead = resolve))
    command.mockReturnValueOnce(pending).mockResolvedValueOnce(success(firstPage))

    const initialRead = accountsApi.littleSkinCloset('A', 'skin', 1)
    await invalidateLittleSkinWardrobe('A')
    const refreshedRead = accountsApi.littleSkinCloset('A', 'skin', 1)
    finishRead(oldPage)

    await expect(Promise.all([initialRead, refreshedRead])).resolves.toEqual([firstPage, firstPage])
    expect(command).toHaveBeenCalledTimes(2)
  })

  it('updates wearing and clearing from the server result without discarding cached pages', async () => {
    const wearing = { ...player, tid_skin: 7 }
    command
      .mockResolvedValueOnce(success(management))
      .mockResolvedValueOnce(success(firstPage))
      .mockResolvedValueOnce(success(wearing))
      .mockResolvedValueOnce(success(player))

    await accountsApi.littleSkinManagement('A')
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    await accountsApi.setLittleSkinTexture('A', 'skin', 7)
    await expect(accountsApi.littleSkinManagement('A')).resolves.toEqual({ ...management, player: wearing })
    await accountsApi.setLittleSkinTexture('A', 'skin')
    await expect(accountsApi.littleSkinManagement('A')).resolves.toEqual(management)
    await expect(accountsApi.littleSkinCloset('A', 'skin', 1)).resolves.toEqual(firstPage)
    expect(command).toHaveBeenCalledTimes(4)
  })

  it('invalidates wearing status on an unconfirmed write without retrying the mutation', async () => {
    command
      .mockResolvedValueOnce(success(management))
      .mockResolvedValueOnce({ success: false, errorCode: 'LITTLESKIN_WRITE_UNCONFIRMED' })
      .mockResolvedValueOnce(success(management))

    await accountsApi.littleSkinManagement('A')
    await expect(accountsApi.setLittleSkinTexture('A', 'skin', 7)).rejects.toMatchObject({
      errorCode: 'LITTLESKIN_WRITE_UNCONFIRMED',
    })
    expect(command).toHaveBeenCalledTimes(2)
    await accountsApi.littleSkinManagement('A')
    expect(command.mock.calls.map(([name]) => name)).toEqual([
      'accounts_littleskin_management',
      'accounts_littleskin_set_texture',
      'accounts_littleskin_management',
    ])
  })

  it('does not reuse failed reads and clears existing pages when authorization is refused', async () => {
    command
      .mockResolvedValueOnce(success(firstPage))
      .mockResolvedValueOnce({ success: false, errorCode: 'LITTLESKIN_RATE_LIMITED' })
      .mockResolvedValueOnce(success({ needs_authorization: true, player: null }))
      .mockResolvedValueOnce(success(management))
      .mockResolvedValueOnce(success(firstPage))

    await accountsApi.littleSkinCloset('A', 'skin', 1)
    await expect(accountsApi.littleSkinManagement('A')).rejects.toMatchObject({ errorCode: 'LITTLESKIN_RATE_LIMITED' })
    await expect(accountsApi.littleSkinManagement('A')).resolves.toEqual({ needs_authorization: true, player: null })
    await accountsApi.littleSkinManagement('A')
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    expect(command).toHaveBeenCalledTimes(5)
  })

  it.each(['delete', 'authorize'] as const)('retains no old data or late mutation result after %s', async (action) => {
    const updatedPlayer = success({ ...player, tid_skin: 9 })
    let finishWrite!: (response: typeof updatedPlayer) => void
    const pendingWrite = new Promise<typeof updatedPlayer>((resolve) => (finishWrite = resolve))
    command
      .mockResolvedValueOnce(success(management))
      .mockResolvedValueOnce(success(firstPage))
      .mockReturnValueOnce(pendingWrite)
      .mockResolvedValueOnce(success({ id: 'A', alias: 'Player', type: 'authlib', auth_provider: 'littleskin' }))
      .mockResolvedValueOnce(success(management))
      .mockResolvedValueOnce(success(firstPage))

    await accountsApi.littleSkinManagement('A')
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    const write = accountsApi.setLittleSkinTexture('A', 'skin', 9)
    if (action === 'delete') await accountsApi.remove('A')
    else await accountsApi.completeLittleSkinLogin('session')
    expect(isLittleSkinWardrobeCached('A', 'skin', 1)).toBe(false)
    finishWrite(updatedPlayer)
    await write
    await expect(accountsApi.littleSkinManagement('A')).resolves.toEqual(management)
    await accountsApi.littleSkinCloset('A', 'skin', 1)
    expect(command).toHaveBeenCalledTimes(6)
  })
})
