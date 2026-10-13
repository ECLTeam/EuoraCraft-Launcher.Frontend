import { expect, it } from 'vitest'
import { parseAccountList } from './accountSnapshot'

it('共享账户快照只包含公开字段，不携带意外的令牌字段', () => {
  const account = { id: 'demo', alias: '玩家', type: 'offline', uuid: 'uuid', access_token: '不能进入展示缓存' }
  const result = parseAccountList({ accounts: [account], current: account })
  expect(result.accounts[0]).not.toHaveProperty('access_token')
  expect(result.current).not.toHaveProperty('access_token')
})
