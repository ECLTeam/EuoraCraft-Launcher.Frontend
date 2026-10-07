import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { aboutApi } from '@/features/settings/api/aboutApi'
import { settingsApi } from '@/features/settings/api/settingsApi'
import {
  accountsQuery,
  configQuery,
  invalidateAccounts,
  invalidateConfig,
  launcherInfoQuery,
  setAccountsSnapshot,
} from './index'

vi.mock('@/features/accounts/api/accountsApi', () => ({ accountsApi: { list: vi.fn() } }))
vi.mock('@/features/settings/api/aboutApi', () => ({ aboutApi: { getLauncherInfo: vi.fn() } }))
vi.mock('@/features/settings/api/settingsApi', () => ({ settingsApi: { load: vi.fn() } }))

const configSnapshot = {
  ui: {},
  game: { minecraft_paths: [] },
  download: { mirror_source: 'official' as const },
  launcher: {},
  connector: { mode: 'automatic' as const, nodes: [] },
}

describe('统一启动数据层', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    vi.mocked(settingsApi.load).mockResolvedValue(configSnapshot)
    vi.mocked(aboutApi.getLauncherInfo).mockResolvedValue(null)
    vi.mocked(accountsApi.list).mockResolvedValue({ accounts: [], current: null })
  })

  it('同一数据域的并发读取只触发一次底层请求', async () => {
    await Promise.all([configQuery(), configQuery(), configQuery()])
    expect(settingsApi.load).toHaveBeenCalledOnce()
  })

  it('缓存有效期内重复读取不再请求后端', async () => {
    await configQuery()
    await configQuery()
    expect(settingsApi.load).toHaveBeenCalledOnce()
  })

  it('配置写入失效缓存后，下次读取重新请求后端', async () => {
    await configQuery()
    await invalidateConfig()
    await configQuery()
    expect(settingsApi.load).toHaveBeenCalledTimes(2)
  })

  it('启动器信息与配置域各自去重，且带首屏超时', async () => {
    await Promise.all([launcherInfoQuery(), launcherInfoQuery(), configQuery()])
    expect(aboutApi.getLauncherInfo).toHaveBeenCalledOnce()
    expect(aboutApi.getLauncherInfo).toHaveBeenCalledWith(3000)
    expect(settingsApi.load).toHaveBeenCalledOnce()
  })

  it('后端推送的账户快照直接写入缓存，读取不再请求后端', async () => {
    const snapshot = { accounts: [], current: null }
    setAccountsSnapshot(snapshot)
    await expect(accountsQuery()).resolves.toEqual(snapshot)
    expect(accountsApi.list).not.toHaveBeenCalled()
  })

  it('账户失效后重新请求后端', async () => {
    await accountsQuery()
    await invalidateAccounts()
    await accountsQuery()
    expect(accountsApi.list).toHaveBeenCalledTimes(2)
  })
})
