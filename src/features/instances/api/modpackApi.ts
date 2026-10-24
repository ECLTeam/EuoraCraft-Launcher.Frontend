import {
  array,
  boolean,
  minValue,
  nullable,
  number,
  object,
  optional,
  picklist,
  pipe,
  safeParse,
  string,
} from 'valibot'
import backend from '@/api/client'
import { i18n } from '@/i18n'
import type { ModpackInstallResult, ModpackPreparation, ModpackPrepareInput } from '@/types/modpack'

const count = pipe(number(), minValue(0))
const fileSchema = object({
  fileId: string(),
  path: string(),
  size: nullable(count),
  requirement: picklist(['required', 'optional', 'unsupported']),
})
const preparationSchema = object({
  preparationId: string(),
  status: picklist(['preparing', 'ready', 'installing', 'consumed', 'released', 'failed']),
  expiresAt: number(),
  cleanupPending: boolean(),
  preview: optional(
    object({
      name: string(),
      format: string(),
      source: picklist(['local', 'modrinth', 'curseforge', 'ftb']),
      summary: string(),
      minecraftVersion: string(),
      loader: string(),
      loaderVersion: nullable(string()),
      files: array(fileSchema),
      warnings: array(object({ code: string(), message: string() })),
    })
  ),
})
const resultSchema = object({
  versionId: string(),
  format: string(),
  downloadedFiles: count,
  excludedOptionalFiles: count,
  unsupportedFiles: count,
  overridesFiles: count,
  baseVersion: nullable(string()),
  warnings: array(string()),
})

export function parseModpackResult(value: unknown): ModpackInstallResult | null {
  const parsed = safeParse(resultSchema, value)
  return parsed.success ? parsed.output : null
}

export const modpackApi = {
  async prepare(input: ModpackPrepareInput) {
    const response = await backend.command('game_modpack_prepare', input)
    if (!response.success || !response.data)
      throw new Error(response.message || i18n.global.t('modpackWizard.prepareFailed'))
    const parsed = safeParse(object({ preparationId: string(), operationId: string() }), response.data)
    if (!parsed.success) throw new Error(i18n.global.t('modpackWizard.invalidResponse'))
    return parsed.output
  },
  async get(preparationId: string): Promise<ModpackPreparation> {
    const response = await backend.command('game_modpack_preparation_get', { preparation_id: preparationId })
    if (!response.success) throw new Error(response.message || i18n.global.t('modpackWizard.previewExpired'))
    const parsed = safeParse(preparationSchema, response.data)
    if (!parsed.success || parsed.output.preparationId !== preparationId)
      throw new Error(i18n.global.t('modpackWizard.invalidResponse'))
    return parsed.output
  },
  async release(preparationId: string): Promise<void> {
    const response = await backend.command('game_modpack_preparation_release', { preparation_id: preparationId })
    if (!response.success) throw new Error(response.message || i18n.global.t('modpackWizard.releaseFailed'))
  },
  async install(preparationId: string, gamePath: string, versionName: string, excludedFileIds: string[]) {
    const response = await backend.command('game_modpack_install', {
      preparation_id: preparationId,
      game_path: gamePath,
      new_version_id: versionName,
      excluded_file_ids: excludedFileIds,
    })
    if (!response.success || !response.data)
      throw new Error(response.message || i18n.global.t('modpackWizard.installFailed'))
    const parsed = safeParse(object({ operationId: string() }), response.data)
    if (!parsed.success) throw new Error(i18n.global.t('modpackWizard.invalidResponse'))
    return parsed.output
  },
}
