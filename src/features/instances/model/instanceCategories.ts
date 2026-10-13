import { array, boolean, looseObject, number, optional, safeParse, string } from 'valibot'
import { i18n } from '@/i18n'
import type { InstanceCategory } from '@/types/instances'

const categorySchema = looseObject({
  id: string(),
  name: string(),
  color: string(),
  order: optional(number(), 0),
  builtin: optional(boolean(), false),
})

export function parseInstanceCategories(value: unknown): InstanceCategory[] {
  const result = safeParse(array(categorySchema), value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}
