import { readonly, ref, type Ref } from 'vue'
import backend from '@/api/client'
import type { AccountChangedEvent, AccountTextures, MinecraftAccount } from '@/types/accounts'

const CACHE_TTL = 30 * 60 * 1000
const MAX_CACHE_ENTRIES = 100
const AVATAR_RENDER_VERSION = 5
const RETRY_TTL = 30 * 1000

const DEFAULT_SKINS = {
  steve:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAdVBMVEUAAAAAaGgAf38ApKQAr68AzMwDenoElZUFiIgKvLwkGAgmGgooKCgrHg0zJBE0JRI3Nzc6MYk/KhU/Pz9BNZtCHQpGOqVJJRBKSkpSPYlVVVVqQDB2SzN3QjWBUzmPXj6QWT+UYD6bY0mqclmzeV63g2v///9KLpkGAAAAAXRSTlMAQObYZgAAAvdJREFUWMPtlu1aozAQhWtBSdmSBYpVV4Vs0vX+L3HPmUmUdqsN/bsOSCc8zst8BGZWqyhNY3HaZoyyWiqN7XES8AK5BgBjHu5FxF3hAQLA3/WARoNwGsJygGUOm74fHVPopuWAXmKw06jHFTmwzGMzTg+QcVoQOyxrXnsICFgwHG4LaE1O9pu6trYmwfKoa91UPe/3WbHLDvKHP4fgf8q6Z0FJtvayB/QYz/ThcAgheLHSMCSQrA3UOF+Ht6fgn95C7Z3csrWAbE79be0hITw/wwNILf4jFUzHRUDd1M5P4283Pby+3kMZJ+9wk4AmBzA62JMw3j/co/4OC++4HX9AMt/KDtK2221a3wYgfLjtoqT7ZVkWCDWcBWy3bfsOgD0IZwFIk7vswWeADQE5HnwSQiEhnHgwDN2w3+87/AxQugqC56CsRal6gStMYVzgZw3h4gPQfQDwu6+MqcqyCoFX0WFZvtuX65ubNdQ5QAyHBDB3d6aACS/USSCrFPOiEgAW5wE47yDJiDrjhl6so9xA+HsEYBgkMGE0wtMJMBFQSfK8dzxEsDj2gCch+KPbBu4SEEMQh/im4kAN+NrMSplif8+BkcwVeKxJOpdiBYQAcM7KeAxg5g3dZvmgC6CIgCAAd+RBJ4ZDSsRQwcZUkrdKNKlfZcR/fd2PAY+Pab89ilRiVkkeKbSGvQkKCPrpmAHaHax+0XRHdafFgD8GZlQQEZS9ArwC/BzQtjsa7lrR2rilURZjNC9g4coCaA6dIFbf8l/KRoX7uiihfGfkW7LmhXmzZU/i52gRYN7uCXD+TFvP92BTnp0LFnhQuNzvoM4LQ+rWg84D2tqP5oKvAGKpc8Ne23kkzOeCrwBd7PcJUEVjQvI9IABamgeSpO9B+j78CziZF3Qe0HbCvnjZA+2xOrJAZy+Ko0HIKuVRCJA4EKTpICxIos4LLo0ksT1nbKK0EzQWl/q5zwSczgvJPiXhIuB0XkjzQErDZcDJvKAVZPp0Pjj9/7/jX3fLYvZOsQAAAABJRU5ErkJggg==',
  alex: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAZlBMVEUAAAAYOBYjYiQoKCgrVCg2NjY/Pz9PT09YWFhcOydkQSxlZWVsRi5vb29xq25yTjZ1UDh7snh8Vz6AglqGuYSMvoqUlmuUyJLUt4/egS7fxKLljT/rmD/r0LDvu7Hv2r/zqFj///9X5330AAAAAXRSTlMAQObYZgAAAy9JREFUWMPtVmtjojAQ1CrykMIFiRASCv3/f/JmNsGC1yr49bpIhOjMTjaP3d0umHXW4LLWGXyc2201BzPGsH2VYBwJ9kqc3UxgjfdshMGZ7QpGGBrPY80LCqxzGEDXIhL2BQJEb4R623Vd24JkuwLoZxy7rod13XoghIvrkQpGLoSRQ0E/b7vCsyCtHwBb6mCvk8410Z/cYfyESzRkRKB5TkB3dA2Gfuh7YbDiXFieB5ODpuv+820Y3j5771piYqDErJk+i8APk3X2FhMzrllQ3H0B//ExYBDdaEfjjAjAb88VWNO2nHvh6BlHwC13heOuWLUWClgUHQ7Tu64ZGWeLYLd+reHjB4LDIYq+CGruKVcUKWxJ0LffEqTpUsGlJYPgwfBcAf61UHDBhsIoviP4R0GttcrKKsuyoqhh+BMEIJjtpfgyJf3ym7QzgkypLK+qHAxZmmaZVkrXV0znIARqgpO6Zksn9YygzPMS+KoEAZ9AoGp1HYgHmm9aN7pp0PqGrzOCilDgq1yYKl1QgroSXyvcjZbrsrAZQU44WKAkT3EDIwhiQSAu4brpe3/Q0Pr5TCRJAullnuEhOZ8TaCZANRgpWeQZPX6nkIKLdkZwBig5C1gMIDolqGY88K1IEfZa7zfeXAFR74JNTnF84iw0ShcEIR6YZLw9IiAoCeA4SeL9fn9k/HWh1REv4OBVTAQYxJ0CgAI44Y1JKI5E7o9HPvMbtr/hoWFBEBP1ziCQJY4xhYpLhVdYf4rLb9rtnmFGEJ1OMccfn04RniNNXPYHlsniU2EJ30JwPwu/9vC4Hn3CYdZ/iYHZQRLPa/DdmsT6WMCyULvSpuPgukrB7zL43w3ZbJFsndbbDpH7gsNZ3fZbCNK7dD/ajQpIMFcw6g0KmOazqvTpXk7U2rqpOLCrCZBsmW6hBEczCKRAWNYFDwjykvlarMxmlcGyLvjJfJmAEZTCkN/XBeFACMfDDwRl5csOWigIQnmwQsFdvRCHgiAkphUEkua+6oXEJ9PJ1iggalYvbCaQVD+rF251+GoFs3qBJgHcEoN5vUCT0qyfkvsKglAvnKd6QSqCBwr+Ak0igZxltPjNAAAAAElFTkSuQmCC',
}

interface CacheEntry {
  url: string | null
  expiresAt: number
  accountId?: string
}

interface AccountState {
  revision: Ref<number>
  identity: string
  shouldRefresh: boolean
  preparedUrls: Set<string>
  urls: Set<string>
}

interface MetadataEntry {
  textures: AccountTextures
  expiresAt: number
}

const avatarCache = new Map<string, CacheEntry>()
const textureCache = new Map<string, CacheEntry>()
const pendingTextures = new Map<string, Promise<string | null>>()
const pendingAvatars = new Map<string, { accountId?: string; promise: Promise<string | null> }>()
const accountStates = new Map<string, AccountState>()
const metadataCache = new Map<string, MetadataEntry>()
const pendingMetadata = new Map<string, Promise<AccountTextures>>()
const refreshUrls = new Set<string>()
const cacheRevision = ref(0)

function accountState(accountId: string): AccountState {
  let state = accountStates.get(accountId)
  if (!state) {
    state = { revision: ref(0), identity: '', shouldRefresh: false, preparedUrls: new Set(), urls: new Set() }
    accountStates.set(accountId, state)
  }
  return state
}

function currentAccountRequest(accountId: string): () => boolean {
  const globalRevision = cacheRevision.value
  const state = accountId ? accountState(accountId) : null
  const revision = state?.revision.value
  return () =>
    globalRevision === cacheRevision.value &&
    (!state || (accountStates.get(accountId) === state && state.revision.value === revision))
}

export function getAvatarRevision(accountId: string): string {
  return `${cacheRevision.value}:${accountId ? accountState(accountId).revision.value : 0}`
}

function limitCache<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
}

function hashCode(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index++) hash = value.charCodeAt(index) + ((hash << 5) - hash)
  return hash
}

function setCached(
  cache: Map<string, CacheEntry>,
  key: string,
  url: string | null,
  ttl = CACHE_TTL,
  accountId?: string
): void {
  limitCache(cache, key, { url, expiresAt: Date.now() + ttl, accountId })
}

function getCached(cache: Map<string, CacheEntry>, key: string): CacheEntry | undefined {
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) {
    cache.delete(key)
    cache.set(key, entry)
    return entry
  }
  cache.delete(key)
  return undefined
}

function markTextureRefresh(url: string, restart = false): void {
  if (!url || url.startsWith('data:') || url.startsWith('blob:') || (refreshUrls.has(url) && !restart)) return
  refreshUrls.add(url)
  textureCache.delete(url)
  pendingTextures.delete(url)
}

function invalidateAccount(accountId: string, shouldRefresh: boolean): void {
  const state = accountState(accountId)
  state.revision.value += 1
  state.shouldRefresh = shouldRefresh
  state.preparedUrls.clear()
  metadataCache.delete(accountId)
  pendingMetadata.delete(accountId)
  for (const [key, entry] of avatarCache) if (entry.accountId === accountId) avatarCache.delete(key)
  for (const [key, entry] of pendingAvatars) if (entry.accountId === accountId) pendingAvatars.delete(key)
  if (shouldRefresh) for (const url of state.urls) markTextureRefresh(url, true)
}

function accountIdentity(account: MinecraftAccount): string {
  return JSON.stringify([
    account.type,
    account.uuid || account.alias,
    account.auth_server,
    account.provider,
    account.skinUrl,
    account.skinId,
  ])
}

export function reconcileAvatarAccounts(snapshot: AccountChangedEvent): void {
  const accounts = new Map(snapshot.accounts.map((account) => [account.id, account]))
  const invalidated = new Set(snapshot.textureInvalidatedAccountIds)
  for (const [accountId, state] of accountStates) {
    if (!accounts.has(accountId)) {
      invalidateAccount(accountId, false)
      accountStates.delete(accountId)
      continue
    }
    const identity = accountIdentity(accounts.get(accountId)!)
    if (invalidated.has(accountId) || (state.identity && state.identity !== identity))
      invalidateAccount(accountId, invalidated.has(accountId))
    state.identity = identity
  }
  for (const [accountId, account] of accounts) {
    if (!accountStates.has(accountId)) {
      const state = accountState(accountId)
      state.identity = accountIdentity(account)
      state.shouldRefresh = invalidated.has(accountId)
    }
  }
}

export function clearAvatarCache(): void {
  cacheRevision.value += 1
  avatarCache.clear()
  textureCache.clear()
  pendingTextures.clear()
  pendingAvatars.clear()
  metadataCache.clear()
  pendingMetadata.clear()
  accountStates.clear()
  refreshUrls.clear()
}

export function loadAvatarImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    if (!url.startsWith('data:') && !url.startsWith('blob:')) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

export async function fetchTextureDataUrl(url: string, shouldRefresh = false): Promise<string | null> {
  url = url.trim()
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  if (shouldRefresh) markTextureRefresh(url)
  const cached = getCached(textureCache, url)
  if (cached) return cached.url
  if (!backend.runtime.isAvailable) return url
  const pending = pendingTextures.get(url)
  if (pending) return pending
  const revision = cacheRevision.value
  const request = Promise.resolve().then(async () => {
    try {
      const response = await backend.command(
        'image_fetch_data_url',
        refreshUrls.has(url) ? { url, refresh: true } : { url }
      )
      const dataUrl = (response.success ? response.data?.dataUrl : null) || null
      if (revision === cacheRevision.value && pendingTextures.get(url) === request) {
        const isStale = !!response.data?.stale
        setCached(textureCache, url, dataUrl, !dataUrl || isStale ? RETRY_TTL : CACHE_TTL)
        if (dataUrl && !isStale) refreshUrls.delete(url)
      }
      return dataUrl
    } catch (reason) {
      if (revision === cacheRevision.value && pendingTextures.get(url) === request)
        setCached(textureCache, url, null, RETRY_TTL)
      console.warn('[Avatar] 皮肤图片读取失败，稍后重试:', reason)
      return null
    }
  })
  pendingTextures.set(url, request)
  try {
    return await request
  } finally {
    if (pendingTextures.get(url) === request) pendingTextures.delete(url)
  }
}

export async function fetchAccountTextures(accountId: string): Promise<AccountTextures> {
  if (!accountId) return {}
  const cached = metadataCache.get(accountId)
  if (cached && cached.expiresAt > Date.now()) return cached.textures
  const pending = pendingMetadata.get(accountId)
  if (pending) return pending
  const isCurrent = currentAccountRequest(accountId)
  const request = Promise.resolve().then(async () => {
    let textures: AccountTextures = {}
    try {
      const response = await backend.command('accounts_texture_urls', { account_id: accountId })
      if (response.success && response.data) textures = response.data
    } catch (reason) {
      console.warn('[Avatar] 账户材质读取失败，稍后重试:', reason)
    }
    if (isCurrent() && pendingMetadata.get(accountId) === request) {
      limitCache(metadataCache, accountId, {
        textures,
        expiresAt: Date.now() + (textures.skinUrl ? CACHE_TTL : RETRY_TTL),
      })
    }
    return textures
  })
  pendingMetadata.set(accountId, request)
  try {
    return await request
  } finally {
    if (pendingMetadata.get(accountId) === request) pendingMetadata.delete(accountId)
  }
}

export function fetchAccountTextureDataUrl(accountId: string, url: string): Promise<string | null> {
  const state = accountState(accountId)
  url = url.trim()
  if (url) state.urls.add(url)
  if (state.shouldRefresh && !state.preparedUrls.has(url)) {
    markTextureRefresh(url)
    state.preparedUrls.add(url)
  }
  return fetchTextureDataUrl(url)
}

export async function renderSkinAvatar(skinUrl: string, size: number): Promise<string | null> {
  const image = await loadAvatarImage(skinUrl)
  if (!image) return null
  const scale = image.naturalWidth / 64
  if (!Number.isInteger(scale) || scale < 1 || image.naturalHeight < 32 * scale) return null

  const outputScale = Math.max(1, Math.ceil(Math.max(1, Math.round(size)) / 56))
  const outputSize = 56 * outputScale
  const sourceSize = 8 * scale
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const context = canvas.getContext('2d')
  if (!context) return null
  context.imageSmoothingEnabled = false
  context.drawImage(
    image,
    8 * scale,
    8 * scale,
    sourceSize,
    sourceSize,
    4 * outputScale,
    4 * outputScale,
    48 * outputScale,
    48 * outputScale
  )
  context.drawImage(image, 40 * scale, 8 * scale, sourceSize, sourceSize, 0, 0, outputSize, outputSize)
  return canvas.toDataURL('image/png')
}

function defaultSkin(identifier: string): string {
  return Math.abs(hashCode(identifier)) % 2 === 0 ? DEFAULT_SKINS.steve : DEFAULT_SKINS.alex
}

export function useAvatarRenderer() {
  const loading = ref(false)
  const error = ref(false)

  async function renderAvatar(
    uuid: string | undefined,
    username: string | undefined,
    size: number,
    skinUrl?: string,
    accountId?: string,
    accountType?: string
  ): Promise<string | null> {
    loading.value = true
    error.value = false
    const identifier = uuid?.trim() || username?.trim() || 'Player'
    const key = JSON.stringify([AVATAR_RENDER_VERSION, accountId, accountType, identifier, skinUrl?.trim(), size])
    try {
      const cached = getCached(avatarCache, key)
      if (cached) return cached.url
      const pending = pendingAvatars.get(key)
      if (pending) return await pending.promise
      const isCurrent = currentAccountRequest(accountId || '')
      const request = (async () => {
        let texture = skinUrl?.trim()
        if (!texture && accountId && accountType === 'authlib') {
          texture = (await fetchAccountTextures(accountId)).skinUrl?.trim()
        }
        if (!isCurrent()) return null
        const resolved = texture
          ? await (accountId ? fetchAccountTextureDataUrl(accountId, texture) : fetchTextureDataUrl(texture))
          : defaultSkin(identifier)
        if (!isCurrent()) return null
        const avatar = resolved ? await renderSkinAvatar(resolved, size) : null
        const fallback = avatar || (await renderSkinAvatar(defaultSkin(identifier), size))
        if (!isCurrent()) return null
        const textureExpiry = texture ? getCached(textureCache, texture)?.expiresAt : undefined
        const isRetry =
          !avatar ||
          (!texture && accountType === 'authlib') ||
          (textureExpiry !== undefined && textureExpiry <= Date.now() + RETRY_TTL)
        if (fallback) setCached(avatarCache, key, fallback, isRetry ? RETRY_TTL : CACHE_TTL, accountId)
        return fallback
      })()
      pendingAvatars.set(key, { accountId, promise: request })
      try {
        const avatar = await request
        if (!avatar) error.value = true
        return avatar
      } finally {
        if (pendingAvatars.get(key)?.promise === request) pendingAvatars.delete(key)
      }
    } catch (reason) {
      console.warn('[Avatar] 前端头像渲染失败，使用默认皮肤:', reason)
      error.value = true
      return renderSkinAvatar(defaultSkin(identifier), size)
    } finally {
      loading.value = false
    }
  }

  return { loading, error, renderAvatar, cacheRevision: readonly(cacheRevision) }
}
