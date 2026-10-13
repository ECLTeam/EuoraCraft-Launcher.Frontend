import { queryKeys } from '@/app/queryKeys'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { parseAccountList } from '@/features/accounts/model/accountSnapshot'
import type { AccountListData } from '@/types/accounts'
import { invalidateResource, readResource, setResourceSnapshot } from './refreshCoordinator'

export function accountsQuery(): Promise<AccountListData> {
  return readResource({ queryKey: queryKeys.accounts, load: () => accountsApi.list() })
}

export function invalidateAccounts(): Promise<void> {
  return invalidateResource(queryKeys.accounts)
}

export function setAccountsSnapshot(data: AccountListData): AccountListData {
  const snapshot = parseAccountList(data)
  setResourceSnapshot(queryKeys.accounts, snapshot)
  return snapshot
}
