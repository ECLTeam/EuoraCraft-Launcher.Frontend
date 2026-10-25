import {
  array,
  boolean,
  check,
  integer,
  maxLength,
  minValue,
  number,
  object,
  picklist,
  pipe,
  record,
  regex,
  safeParse,
  string,
} from 'valibot'
import backend from '@/api/client'
import { i18n } from '@/i18n'
import {
  exportCategories,
  type InstanceExportPreview,
  type InstanceExportRequest,
  type InstanceExportResult,
} from '@/types/instanceExport'
import type { InstanceTargetPayload } from '@/types/instances'

const count = pipe(number(), integer(), minValue(0))

const fileId = pipe(string(), regex(/^[a-f0-9]{64}$/))
const relativePath = pipe(
  string(),
  check(
    (value) =>
      !value.includes('\\') &&
      !value.startsWith('/') &&
      !value.includes(':') &&
      !value.includes('\0') &&
      value.split('/').every((part) => !!part && part !== '.' && part !== '..')
  )
)
const previewSchema = object({
  sourceRevision: fileId,
  versionId: string(),
  isolated: boolean(),
  dependencies: pipe(
    record(string(), string()),
    check((value) => !!value.minecraft)
  ),
  files: pipe(
    array(
      object({ fileId, path: relativePath, size: count, category: picklist(exportCategories), recommended: boolean() })
    ),
    maxLength(50000),
    check((files) => new Set(files.map((file) => file.fileId)).size === files.length)
  ),
  excludedCount: count,
})
const resultSchema = object({
  path: string(),
  format: picklist(['modrinth']),
  onlineFiles: count,
  packedFiles: count,
  selectedBytes: count,
  warnings: array(string()),
})
const operationSchema = object({ operationId: pipe(string(), regex(/^[a-f0-9]{32}$/)) })

export function parseExportPreview(value: unknown): InstanceExportPreview {
  const parsed = safeParse(previewSchema, value)
  if (!parsed.success) throw new Error(i18n.global.t('instanceExport.invalidResponse'))
  return parsed.output
}

export function parseExportResult(value: unknown): InstanceExportResult | null {
  const parsed = safeParse(resultSchema, value)
  return parsed.success ? parsed.output : null
}

export function suggestedExportName(name: string, version: string): string {
  const clean = (value: string) =>
    Array.from(value)
      .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character))
      .join('')
      .replace(/[. ]+$/g, '')
      .slice(0, 100)
  return `${clean(name) || 'modpack'}-${clean(version) || '1.0.0'}.mrpack`
}

export const instanceExportApi = {
  async preview(target: InstanceTargetPayload) {
    const response = await backend.command('game_instance_export_preview', target)
    if (!response.success) throw new Error(response.message || i18n.global.t('instanceExport.scanFailed'))
    const parsed = safeParse(operationSchema, response.data)
    if (!parsed.success) throw new Error(i18n.global.t('instanceExport.invalidResponse'))
    return parsed.output
  },
  async chooseOutput(name: string, version: string): Promise<string | null> {
    const response = await backend.command('select_save_file', {
      purpose: 'instance-export',
      default_name: suggestedExportName(name, version),
    })
    if (!response.success) throw new Error(response.message || i18n.global.t('instanceExport.exportFailed'))
    const parsed = safeParse(object({ path: string() }), response.data)
    if (!response.data) return null
    if (!parsed.success) throw new Error(i18n.global.t('instanceExport.invalidResponse'))
    return parsed.output.path || null
  },
  async export(input: InstanceExportRequest) {
    const response = await backend.command('game_instance_export', input)
    if (!response.success) throw new Error(response.message || i18n.global.t('instanceExport.exportFailed'))
    const parsed = safeParse(operationSchema, response.data)
    if (!parsed.success) throw new Error(i18n.global.t('instanceExport.invalidResponse'))
    return parsed.output
  },
}
