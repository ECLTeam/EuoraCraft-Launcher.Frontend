/**
 * 领域类型定义。
 * 由 types/api.ts 拆分而来，与后端 ECL/api/models.py 的 Pydantic 模型对齐。
 */

export type AccountType = 'microsoft' | 'offline' | 'authlib' | 'plugin'

export interface AuthlibProfile {
  id: string
  name: string
  logged_in?: boolean
}

export interface AuthField {
  key: string
  label: string
  type: string
  required: boolean
  placeholder: string
}

export interface AuthProvider {
  id: string
  title: string
  description: string
  fields: AuthField[]
}

export interface MinecraftAccount {
  id: string
  alias: string
  type: AccountType
  email?: string
  uuid?: string
  isCurrent?: boolean
  favorite?: boolean
  pinned?: boolean
  skinUrl?: string
  skinId?: string
  capes?: MicrosoftCape[]
  auth_server?: string
  provider?: string
  providerTitle?: string
  profile_selection_required?: boolean
  available_profiles?: AuthlibProfile[]
}

export interface DefaultSkin {
  id: string
  name: string
  skinUrl: string
}

export interface OfflineUuidPreview {
  player_name: string
  uuid: string
}

export interface MicrosoftCape {
  id: string
  name?: string
  state: string
  url: string
}

export type WardrobeKind = 'skin' | 'cape'
export type SkinModel = 'classic' | 'slim'

export interface WardrobeItem {
  id: string
  kind: WardrobeKind
  name: string
  model: SkinModel | null
  favorite: boolean
  width: number
  height: number
  byteSize: number
  sha256: string
  createdAt: string
  updatedAt: string
}

export interface WardrobeImportResult {
  item: WardrobeItem
  deduplicated: boolean
}

export interface AccountTextures {
  skinUrl?: string
  capeUrl?: string
  skinModel?: SkinModel
}

export interface AccountListData {
  accounts: MinecraftAccount[]
  current: MinecraftAccount | null
}

export interface AccountChangedEvent extends AccountListData {
  textureInvalidatedAccountIds: string[]
}

export type MicrosoftLoginStage =
  'waiting_authorization' | 'authorization_confirmed' | 'minecraft_token' | 'profile' | 'saving' | 'completed'

export interface MicrosoftLoginData {
  status?: 'pending' | 'progress' | 'completed' | 'error'
  stage?: MicrosoftLoginStage
  needs_client_id?: boolean
  userCode?: string
  verificationUri?: string
  message?: string
  interval?: number
}

export interface MicrosoftLoginConfigData {
  available: boolean
  needs_client_id: boolean
}

export interface AuthlibLoginConfigData {
  available: boolean
}

export interface MicrosoftPollData {
  status: 'pending' | 'progress' | 'ready' | 'error'
  stage?: MicrosoftLoginStage
  message?: string
  retry_after?: number
}

export interface MicrosoftLoginStatusEvent {
  status: 'progress' | 'ready' | 'error' | 'cancelled'
  stage?: MicrosoftLoginStage
  focus?: boolean
  message?: string
}

export interface MicrosoftCompleteData {
  status?: 'pending' | 'completed'
  stage?: MicrosoftLoginStage
  success?: boolean
  account?: MinecraftAccount
  message?: string
  retry_after?: number
}

export interface AuthlibServer {
  name: string
  url: string
  email: string
  description: string
}

// ═══════════════════════════════════════════════════════════════════
//  用户协议
// ═══════════════════════════════════════════════════════════════════

export interface SelectResult {
  path: string
}

export interface ImageSelection {
  path: string
  base64: string
}

export interface ImageDataUrl {
  dataUrl?: string
  base64?: string
  cached?: boolean
  stale?: boolean
}

export interface ImageSaveUrlResult {
  dataUrl: string
  base64: string
  url: string
  /** 后端落盘到本地数据目录后的路径（可能为空） */
  path?: string | null
}

export interface ImageListResult {
  files: string[]
}
