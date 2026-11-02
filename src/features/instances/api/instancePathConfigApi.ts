import { looseObject, optional, safeParse, string } from 'valibot'
import backend from '@/api/client'
import { hasMutation, serializeMutation } from '@/app/data/mutationCoordinator'
import { invalidateResource, readResource, setResourceSnapshot } from '@/app/data/refreshCoordinator'
import { queryClient } from '@/app/queryClient'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import { i18n } from '@/i18n'
import type { EclPathConfig } from '@/types/config'
import { configValuesEqual, copyConfigValue } from '@/utils/configValue'
import { gamePathIdentity, normalizeGamePath } from '@/utils/path'

const pathConfigSchema = looseObject({ activeVersion: optional(string()), active_version: optional(string()) })
const pendingActiveVersionWrites = new Map<string, { versionId: string; promise: Promise<void> }>()

function normalizePathKey(gamePath: string): string {
  const path = normalizeGamePath(gamePathIdentity(gamePath))
  return /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path
}

function configKey(gamePath: string) {
  return ['instance-path-config', normalizePathKey(gamePath)] as const
}

function parseConfig(value: unknown): EclPathConfig {
  const parsed = safeParse(pathConfigSchema, value)
  if (!parsed.success) throw new Error(i18n.global.t('dataSync.invalid'))
  return parsed.output
}

async function fetchConfig(gamePath: string): Promise<EclPathConfig> {
  return parseConfig(
    assertSuccess(await backend.command('game_config_get', { game_path: gamePath }), '读取 ecl.json') ?? {}
  )
}

/** 完整目录配置读取保持显式新读取语义，同时更新 activeVersion 使用的共享快照。 */
function readConfig(gamePath: string): Promise<EclPathConfig> {
  return readResource({
    queryKey: configKey(gamePath),
    load: () => fetchConfig(gamePath),
    force: true,
    staleTime: Infinity,
  })
}

async function writeConfig(gamePath: string, data: EclPathConfig): Promise<void> {
  const key = configKey(gamePath)
  const submitted = copyConfigValue(data)
  await serializeMutation(key, async () => {
    const current = queryClient.getQueryData<EclPathConfig>(key)
    if (current && !queryClient.getQueryState(key)?.isInvalidated && configValuesEqual(current, submitted)) return
    const result = await backend.command('game_config_set', { game_path: gamePath, data: submitted })
    assertSuccess(result, '写入 ecl.json')
    setResourceSnapshot(key, parseConfig(submitted))
  })
}

function patchConfig(gamePath: string, patch: Partial<EclPathConfig>): Promise<EclPathConfig> {
  const key = configKey(gamePath)
  const submitted = copyConfigValue(patch)
  return serializeMutation(key, async () => {
    const current = queryClient.getQueryData<EclPathConfig>(key)
    if (
      current &&
      !queryClient.getQueryState(key)?.isInvalidated &&
      configValuesEqual(current, { ...current, ...submitted })
    )
      return copyConfigValue(current)
    const result = await backend.command('game_config_patch', { game_path: gamePath, patch: submitted })
    const config = parseConfig(assertSuccess(result, '更新 ecl.json') ?? {})
    setResourceSnapshot(key, config)
    return config
  })
}

async function getActiveVersion(gamePath: string, options: { force?: boolean } = {}): Promise<string | null> {
  const config = await readResource({
    queryKey: configKey(gamePath),
    load: () => fetchConfig(gamePath),
    staleTime: Infinity,
    ...options,
  })
  return config.activeVersion || config.active_version || null
}

function invalidateActiveVersionCache(gamePath?: string): void {
  void invalidateResource(gamePath ? configKey(gamePath) : ['instance-path-config'], gamePath !== undefined)
}

async function setActiveVersion(gamePath: string, versionId: string): Promise<void> {
  const key = normalizePathKey(gamePath)
  const pending = pendingActiveVersionWrites.get(key)
  if (pending?.versionId === versionId) return pending.promise
  const queryKey = configKey(gamePath)
  const cached = queryClient.getQueryState(queryKey)?.isInvalidated
    ? undefined
    : queryClient.getQueryData<EclPathConfig>(queryKey)
  if (!pending && !hasMutation(queryKey) && (cached?.activeVersion || cached?.active_version) === versionId) return
  const promise = patchConfig(gamePath, { activeVersion: versionId }).then(() => undefined)
  const entry = { versionId, promise }
  pendingActiveVersionWrites.set(key, entry)
  try {
    await promise
  } finally {
    if (pendingActiveVersionWrites.get(key) === entry) pendingActiveVersionWrites.delete(key)
  }
}

export const instancePathConfigApi = {
  readConfig,
  writeConfig,
  patchConfig,
  getActiveVersion,
  invalidateActiveVersionCache,
  setActiveVersion,
}
