import { array, boolean, nullable, number, object, picklist, pipe, regex, safeParse, string } from 'valibot'
import { i18n } from '@/i18n'
import type { LittleSkinLoginConfig, LittleSkinLoginSnapshot } from '@/types/accounts'

const configSchema = object({ device_code: boolean(), authorization_code: boolean(), needs_client_id: boolean() })
const snapshotSchema = object({
  account_id: nullable(string()),
  session_id: pipe(string(), regex(/^[0-9a-f]{32}$/)),
  method: picklist(['device_code', 'authorization_code']),
  status: picklist(['starting', 'pending', 'selecting', 'ready', 'saving', 'completed', 'error', 'cancelled']),
  user_code: string(),
  verification_uri: string(),
  expires_at: number(),
  profiles: array(object({ id: pipe(string(), regex(/^[0-9a-fA-F]{32}$/)), name: string() })),
  error_code: string(),
})

export function parseLittleSkinConfig(value: unknown): LittleSkinLoginConfig {
  const result = safeParse(configSchema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return result.output
}

export function parseLittleSkinSnapshot(value: unknown): LittleSkinLoginSnapshot {
  const result = safeParse(snapshotSchema, value)
  if (!result.success) throw new Error(i18n.global.t('dataSync.invalid'))
  if (!Number.isFinite(result.output.expires_at)) throw new Error(i18n.global.t('dataSync.invalid'))
  if (result.output.verification_uri) {
    let url: URL
    try {
      url = new URL(result.output.verification_uri)
    } catch {
      throw new Error(i18n.global.t('dataSync.invalid'))
    }
    const isDevice = result.output.method === 'device_code'
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      url.port ||
      url.hostname !== (isDevice ? 'open.littleskin.cn' : 'littleskin.cn') ||
      url.pathname !== (isDevice ? '/oauth/link' : '/oauth/authorize')
    )
      throw new Error(i18n.global.t('dataSync.invalid'))
  }
  return result.output
}
