/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export interface ModItem {
  filename: string
  name: string
  display_name: string
  english_name: string
  mcmod_url: string
  version: string
  author: string
  loader_type: string
  game_version: string
  project_id: string
  dependencies: string[]
  enabled: boolean
  size: number
  /** 从模组 jar 内提取的图标数据 URL，无图标时为空字符串 */
  icon_data: string
  modified_at: string
}

export interface ModSourceConfig {
  curseforge: { available: boolean }
}

export interface ModSearchResult {
  items: ModSearchItem[]
  sources: Record<string, ModSourceStatus>
  total: number
  query: string
}

export interface ModInfo {
  id: string
  slug: string
  title: string
  description: string
  author: string
  body: string
  iconUrl?: string
  code: string
  source: 'modrinth' | 'curseforge' | 'ftb'
  resourceType?: string
  loaders: string[]
  gameVersions: string[]
  projectUrl: string
}

export interface ModVersion {
  id: string
  projectId: string
  name: string
  versionNumber: string
  gameVersions: string[]
  loaders: string[]
  filename: string
  datePublished?: string
  downloads: number
  releaseType: 'release' | 'beta' | 'alpha'
  dependencies?: ModDependency[]
}

export interface ModInstallResult {
  installed: Array<{ filename: string; source: string; skipped: boolean }>
  modsPath: string
}

export interface ResourcePack {
  filename: string
  name?: string
  description?: string
  format?: number
}

export interface ShaderPack {
  filename: string
  name?: string
}

export interface SaveEntry {
  name: string
  lastPlayed?: string
  gameMode?: string
}

export interface ModpackTypeInfo {
  type: string
  [k: string]: unknown
}

// ═══════════════════════════════════════════════════════════════════
//  插件
// ═══════════════════════════════════════════════════════════════════

export interface ModSourceReference {
  source: 'modrinth' | 'curseforge' | 'ftb'
  projectId: string
  slug: string
  projectUrl: string
}

export interface McmodInfo {
  id: string
  title: string
  englishName: string
  summary: string
  iconUrl?: string
  url: string
}

export interface ModSearchItem {
  id: string
  projectId: string
  slug: string
  title: string
  displayTitle: string
  description: string
  author: string
  iconUrl?: string
  downloads: number
  follows: number
  dateModified?: string
  source: 'modrinth' | 'curseforge' | 'ftb'
  projectUrl: string
  categories: string[]
  loaders: string[]
  gameVersions: string[]
  wiki?: McmodInfo
  resourceType?: string
  alternatives: ModSourceReference[]
}

export interface ModSourceStatus {
  available: boolean
  error: string
  total: number
}

export interface ModDependency {
  versionId?: string | null
  projectId?: string | null
  filename?: string | null
  dependencyType: 'required' | 'optional' | 'incompatible' | 'embedded' | string
}
