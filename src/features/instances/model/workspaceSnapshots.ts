import { array, boolean, looseObject, nullable, number, optional, safeParse, string, type GenericSchema } from 'valibot'
import { i18n } from '@/i18n'
import type { ScreenshotEntry, ServerEntry, WorldEntry } from '@/types/instances'

const text = optional(string())
const flag = optional(boolean())
const numeric = optional(number())
const nullableText = optional(nullable(string()))
const world = looseObject({
  id: string(),
  name: string(),
  path: string(),
  iconPath: nullableText,
  gameMode: text,
  gameModeId: numeric,
  difficulty: text,
  difficultyId: numeric,
  difficultyLocked: flag,
  allowCommands: flag,
  version: text,
  seed: text,
  seedEditable: flag,
  seedError: nullableText,
  spawn: optional(looseObject({ x: number(), y: number(), z: number() })),
  weather: optional(looseObject({ raining: boolean(), thundering: boolean() })),
  lastPlayedAt: nullableText,
  modifiedAt: text,
  createdAt: text,
  error: text,
})
const screenshot = looseObject({
  id: string(),
  name: string(),
  path: string(),
  width: number(),
  height: number(),
  size: number(),
  modifiedAt: string(),
  dateGroup: string(),
  thumbnailUrl: text,
})
const server = looseObject({
  id: string(),
  name: string(),
  address: string(),
  icon: nullableText,
  favorite: boolean(),
  order: number(),
})

function parse<T>(schema: GenericSchema<unknown, T>, value: unknown): T {
  const result = safeParse(schema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}

export function parseWorlds(value: unknown): WorldEntry[] {
  return parse(array(world), value)
}
export function parseScreenshots(value: unknown): ScreenshotEntry[] {
  return parse(array(screenshot), value)
}
export function parseServers(value: unknown): ServerEntry[] {
  return parse(array(server), value)
}
