import type { InstanceTargetPayload } from '@/types/instances'

export const exportCategories = [
  'mods',
  'disabledMods',
  'config',
  'settings',
  'resources',
  'shaders',
  'saves',
  'screenshots',
  'servers',
  'other',
] as const

export type ExportCategory = (typeof exportCategories)[number]
export type ExportResourceMode = 'references' | 'bundled'

export interface InstanceExportFile {
  fileId: string
  path: string
  size: number
  category: ExportCategory
  recommended: boolean
}

export interface InstanceExportPreview {
  sourceRevision: string
  versionId: string
  isolated: boolean
  dependencies: Record<string, string>
  files: InstanceExportFile[]
  excludedCount: number
}

export interface InstanceExportResult {
  path: string
  format: 'modrinth'
  onlineFiles: number
  packedFiles: number
  selectedBytes: number
  warnings: string[]
}

export type InstanceExportRequest = InstanceTargetPayload & {
  output_path: string
  pack_format: 'modrinth'
  source_revision: string
  selected_file_ids: string[]
  pack_name: string
  pack_version: string
  summary: string
  resource_mode: ExportResourceMode
}
