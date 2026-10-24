export type ModpackSource = 'local' | 'modrinth' | 'curseforge' | 'ftb'

export type ModpackPrepareInput =
  | { source: 'local'; source_path: string }
  | { source: Exclude<ModpackSource, 'local'>; project_id: string; file_id: string }

export interface ModpackPreviewFile {
  fileId: string
  path: string
  size: number | null
  requirement: 'required' | 'optional' | 'unsupported'
}

export interface ModpackWarning {
  code: string
  message: string
}

export interface ModpackPreview {
  name: string
  format: string
  source: ModpackSource
  summary: string
  minecraftVersion: string
  loader: string
  loaderVersion: string | null
  files: ModpackPreviewFile[]
  warnings: ModpackWarning[]
}

export interface ModpackPreparation {
  preparationId: string
  status: 'preparing' | 'ready' | 'installing' | 'consumed' | 'released' | 'failed'
  expiresAt: number
  cleanupPending: boolean
  preview?: ModpackPreview
}

export interface ModpackInstallResult {
  versionId: string
  format: string
  downloadedFiles: number
  excludedOptionalFiles: number
  unsupportedFiles: number
  overridesFiles: number
  baseVersion: string | null
  warnings: string[]
}
