import { array, boolean, looseObject, number, optional, picklist, safeParse, string } from 'valibot'
import { i18n } from '@/i18n'
import type { InstanceProfile } from '@/types/instances'

const iconSchema = looseObject({
  type: picklist(['builtin', 'loader', 'local', 'external', 'data']),
  value: string(),
  source: optional(string()),
})
const profileSchema = looseObject({
  schemaVersion: number(),
  alias: optional(string()),
  description: optional(string()),
  favorite: optional(boolean()),
  pinned: optional(boolean()),
  hidden: optional(boolean()),
  categoryId: optional(string()),
  tags: optional(array(string())),
  icon: optional(iconSchema),
  cover: optional(iconSchema),
  pinOrder: optional(number()),
  preferredExternalSource: optional(string()),
})

export function parseInstanceProfile(value: unknown): InstanceProfile {
  const result = safeParse(profileSchema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}
