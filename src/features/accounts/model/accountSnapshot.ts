import { array, boolean, object, nullable, optional, picklist, pipe, safeParse, string, transform } from 'valibot'
import { i18n } from '@/i18n'
import type { AccountListData, MinecraftAccount } from '@/types/accounts'

const text = optional(
  pipe(
    nullable(string()),
    transform((value) => value ?? undefined)
  )
)
const accountSchema = object({
  id: string(),
  alias: string(),
  type: picklist(['microsoft', 'offline', 'authlib', 'plugin']),
  email: text,
  uuid: text,
  isCurrent: optional(boolean()),
  favorite: optional(boolean()),
  pinned: optional(boolean()),
  skinUrl: text,
  skinId: text,
  auth_server: text,
  provider: text,
  providerTitle: text,
  profile_selection_required: optional(boolean()),
  available_profiles: optional(array(object({ id: string(), name: string(), logged_in: optional(boolean()) }))),
  capes: optional(array(object({ id: string(), name: text, state: string(), url: string() }))),
})
const listSchema = object({ accounts: array(accountSchema), current: nullable(accountSchema) })

export function parseAccountSnapshot(value: unknown): MinecraftAccount {
  const result = safeParse(accountSchema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}

export function parseAccountList(value: unknown): AccountListData {
  const result = safeParse(listSchema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}
