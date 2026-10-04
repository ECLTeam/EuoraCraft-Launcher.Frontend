// 支持内存缓存、本地存储和过期时间管理

interface CacheOptions {
  /** 缓存过期时间（毫秒） */
  ttl?: number
  /** 是否使用本地存储持久化 */
  persistent?: boolean
  /** 缓存分组 */
  group?: string
}

interface CacheItem<T = unknown> {
  value: T
  timestamp: number
  ttl?: number
  group?: string
}

function isCacheItem(value: unknown): value is CacheItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<CacheItem>
  return (
    typeof item.timestamp === 'number' &&
    Number.isFinite(item.timestamp) &&
    item.timestamp >= 0 &&
    (item.ttl === undefined || (typeof item.ttl === 'number' && Number.isFinite(item.ttl) && item.ttl >= 0)) &&
    (item.group === undefined || typeof item.group === 'string') &&
    Object.hasOwn(item, 'value')
  )
}

class GlobalCache {
  private revisions = new Map<string, number>()
  private keyGroups = new Map<string, string>()
  private listeners = new Set<(key: string | null) => void>()

  getRevision(key: string, group?: string): number {
    if (!this.revisions.has(key)) this.revisions.set(key, 0)
    if (group !== undefined || !this.keyGroups.has(key)) this.keyGroups.set(key, group ?? 'default')
    return this.revisions.get(key) ?? 0
  }

  subscribe(listener: (key: string | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(key: string | null): void {
    const keys = key === null ? this.revisions.keys() : [key]
    for (const item of keys) this.revisions.set(item, this.getRevision(item) + 1)
    for (const listener of this.listeners) listener(key)
  }
  private memoryCache = new Map<string, CacheItem>()
  private readonly PREFIX = 'euora-cache-'
  private readonly DEFAULT_TTL = 30 * 60 * 1000 // 30分钟

  /**
   * 设置缓存值。
   * @param key - 缓存键
   * @param value - 缓存值
   * @param options - 缓存选项，包括过期时间、是否持久化、分组
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const { ttl = this.DEFAULT_TTL, persistent = false, group = 'default' } = options

    const cacheItem: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      group,
    }

    this.memoryCache.set(key, cacheItem)
    this.keyGroups.set(key, group)

    if (persistent) {
      try {
        const storageKey = this.getStorageKey(key)
        localStorage.setItem(storageKey, JSON.stringify(cacheItem))
      } catch (error) {
        console.warn('本地存储写入失败:', error)
      }
    }
    this.changed(key)
  }

  /**
   * 获取缓存值。
   * @param key - 缓存键
   * @returns 缓存值，不存在或已过期时返回 null
   */
  get<T>(key: string): T | null {
    let cacheItem = this.memoryCache.get(key)

    if (!cacheItem) {
      const persistent = this.readPersistentItem(this.getStorageKey(key))
      if (persistent) {
        cacheItem = persistent
        this.memoryCache.set(key, cacheItem)
      }
    }

    if (!cacheItem) return null

    if (this.isExpired(cacheItem)) {
      this.delete(key)
      return null
    }

    return cacheItem.value as T
  }

  /**
   * 删除指定缓存。
   * @param key - 缓存键
   */
  delete(key: string): void {
    this.memoryCache.delete(key)

    try {
      const storageKey = this.getStorageKey(key)
      localStorage.removeItem(storageKey)
    } catch (error) {
      console.warn('本地存储删除失败:', error)
    }
    this.changed(key)
  }

  /**
   * 检查缓存是否存在且未过期。
   * @param key - 缓存键
   */
  has(key: string): boolean {
    const value = this.get(key)
    return value !== null
  }

  /**
   * 清空所有缓存。
   */
  clear(): void {
    this.memoryCache.clear()

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn('清空本地存储失败:', error)
    }
    this.changed(null)
  }

  /**
   * 清空指定分组的缓存。
   * @param group - 缓存分组名称
   */
  clearGroup(group: string): void {
    const keys = new Set([...this.memoryCache].filter(([, item]) => item.group === group).map(([key]) => key))
    for (const [key, cachedGroup] of this.keyGroups) if (cachedGroup === group) keys.add(key)
    for (const key of keys) this.delete(key)

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.PREFIX)) {
          const item = this.readPersistentItem(key)
          if (!item || item.group === group) {
            localStorage.removeItem(key)
            this.changed(key.slice(this.PREFIX.length))
          }
        }
      }
    } catch (error) {
      console.warn('清空分组缓存失败:', error)
    }
  }

  /**
   * 获取缓存统计信息。
   * @returns 内存缓存数量、持久化缓存数量及总大小
   */
  getStats() {
    const memoryCount = this.memoryCache.size
    let persistentCount = 0
    let totalSize = 0

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.PREFIX)) {
          persistentCount++
          const value = localStorage.getItem(key)
          if (value) {
            totalSize += new Blob([value]).size
          }
        }
      }
    } catch (error) {
      console.warn('获取缓存统计失败:', error)
    }

    return {
      memoryCount,
      persistentCount,
      totalSize: this.formatBytes(totalSize),
    }
  }

  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 启动定期清理过期缓存。
   * @param interval - 清理间隔，默认 5 分钟
   */
  startCleanup(interval: number = 5 * 60 * 1000): void {
    this.stopCleanup()
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, interval)
  }

  /**
   * 停止定期清理过期缓存。
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * 清理所有过期缓存。
   */
  private cleanupExpired(): void {
    for (const [key, item] of this.memoryCache.entries()) {
      if (this.isExpired(item)) {
        this.delete(key)
      }
    }

    try {
      // 删除会改变 localStorage 索引，先生成键快照避免跳过相邻过期项。
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
        (key): key is string => Boolean(key?.startsWith(this.PREFIX))
      )
      for (const key of keys) {
        const item = this.readPersistentItem(key)
        if (!item || this.isExpired(item)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn('清理过期缓存失败:', error)
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(item: CacheItem): boolean {
    if (item.ttl === undefined) return false
    return Date.now() - item.timestamp > item.ttl
  }

  /** 读取并验证一条持久化缓存；损坏或旧格式的数据会被立即移除。 */
  private readPersistentItem(storageKey: string): CacheItem | null {
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return null
      const parsed: unknown = JSON.parse(stored)
      if (isCacheItem(parsed)) return parsed
      localStorage.removeItem(storageKey)
      return null
    } catch (error) {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* 存储不可用时保留原始读取错误 */
      }
      console.warn('本地存储读取失败:', error)
      return null
    }
  }

  /**
   * 获取本地存储的键名
   */
  private getStorageKey(key: string): string {
    return `${this.PREFIX}${key}`
  }

  /**
   * 格式化字节大小
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

export const globalCache = new GlobalCache()

globalCache.startCleanup()

export type { CacheOptions, CacheItem }

/**
 * 缓存键常量，用于统一管理缓存键名。
 */
export const CACHE_KEYS = {
  VERSIONS: 'versions',
  FABRIC_VERSIONS: 'fabric-versions',
  FORGE_VERSIONS: 'forge-versions',

  ACCOUNTS: 'accounts',
  CURRENT_ACCOUNT: 'current-account',

  AVATARS: 'avatars',
  SKINS: 'skins',

  SETTINGS: 'settings',
  THEME: 'theme',
  LANGUAGE: 'language',

  INSTANCES: 'instances',
  GAME_PATHS: 'game-paths',

  API_RESPONSES: 'api-responses',
} as const

/**
 * 缓存分组常量。
 */
export const CACHE_GROUPS = {
  VERSION: 'version',
  ACCOUNT: 'account',
  SKIN: 'skin',
  SETTING: 'setting',
  INSTANCE: 'instance',
  API: 'api',
} as const
