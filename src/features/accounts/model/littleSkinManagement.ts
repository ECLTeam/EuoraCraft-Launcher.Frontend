import {
  array,
  boolean,
  integer,
  maxLength,
  minLength,
  minValue,
  nullable,
  number,
  object,
  picklist,
  pipe,
  regex,
  safeParse,
  string,
} from 'valibot'
import { i18n } from '@/i18n'
import type { LittleSkinClosetPage, LittleSkinManagement, LittleSkinPlayer } from '@/types/accounts'

const positiveInteger = pipe(number(), integer(), minValue(1))
const textureId = pipe(number(), integer(), minValue(0))
const playerSchema = object({
  pid: positiveInteger,
  name: pipe(string(), minLength(1)),
  tid_skin: textureId,
  tid_cape: textureId,
})
const managementSchema = object({ needs_authorization: boolean(), player: nullable(playerSchema) })
const closetSchema = object({
  current_page: positiveInteger,
  last_page: positiveInteger,
  total: textureId,
  data: pipe(
    array(
      object({
        tid: positiveInteger,
        name: pipe(string(), minLength(1)),
        type: picklist(['steve', 'alex', 'cape']),
        hash: pipe(string(), regex(/^[0-9a-f]{64}$/)),
      })
    ),
    maxLength(100)
  ),
})

export function parseLittleSkinPlayer(value: unknown): LittleSkinPlayer {
  const result = safeParse(playerSchema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}

export function parseLittleSkinManagement(value: unknown): LittleSkinManagement {
  const result = safeParse(managementSchema, value)
  if (!result.success || (!result.output.needs_authorization && !result.output.player))
    throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}

export function parseLittleSkinCloset(value: unknown): LittleSkinClosetPage {
  const result = safeParse(closetSchema, value)
  if (!result.success || new Set(result.output.data.map((item) => item.tid)).size !== result.output.data.length)
    throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}
