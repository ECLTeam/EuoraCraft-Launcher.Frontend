import type { ModSearchResult } from '@/types/mods'

interface PageRequest {
  page: number
  sessionId: string
  refresh: boolean
}

interface PendingPage {
  page: number
  foreground: boolean
  resolve: (response: ModSearchResult | undefined) => void
  reject: (error: unknown) => void
  promise: Promise<ModSearchResult | undefined>
}

/** 一个搜索条件/会话的有界缓存和串行请求队列。 */
export class SearchPageCache {
  private readonly pages = new Map<number, { response: ModSearchResult; expiresAt: number }>()
  private readonly pending = new Map<number, PendingPage>()
  private readonly queue: PendingPage[] = []
  private running = false
  private disposed = false
  private prefetchVersion = 0
  private sessionId: string
  private refresh: boolean

  constructor(
    private readonly load: (request: PageRequest) => Promise<ModSearchResult>,
    private readonly options: {
      sessionId?: string
      refresh?: boolean
      pageSize?: number
      maxEntries?: number
      now?: () => number
    } = {}
  ) {
    this.sessionId = options.sessionId ?? ''
    this.refresh = options.refresh ?? false
  }

  /** 已派发的请求可以结束，但不能再修改此会话或缓存。 */
  dispose(): void {
    this.disposed = true
    this.prefetchVersion++
    this.pages.clear()
    this.queue.splice(0).forEach((entry) => {
      this.pending.delete(entry.page)
      entry.resolve(undefined)
    })
  }

  read(page: number): Promise<ModSearchResult | undefined> {
    return this.request(page, true)
  }

  /** 当前页先由调用方展示，后台只准备后续五页，不改变当前页状态。 */
  async prefetch(currentPage: number, response: ModSearchResult): Promise<void> {
    const version = ++this.prefetchVersion
    if (!response.items.length) return
    let previous = response
    for (let page = currentPage + 1; page <= currentPage + 5; page++) {
      if (this.disposed || version !== this.prefetchVersion || !this.hasNext(previous, page - 1)) return
      try {
        const next = await this.request(page, false)
        if (!next || (next.page ?? page) !== page) return
        previous = next
      } catch {
        // 预加载失败只停止本轮；实际取页时仍向调用方报告失败。
        return
      }
    }
  }

  private hasNext(response: ModSearchResult, page: number): boolean {
    if (response.truncated) return false
    return response.hasMore ?? page * (this.options.pageSize ?? 20) < response.total
  }

  private request(page: number, foreground: boolean): Promise<ModSearchResult | undefined> {
    if (this.disposed) return Promise.resolve(undefined)
    const cached = this.pages.get(page)
    if (
      cached &&
      cached.expiresAt > this.now() &&
      (cached.response.items.length || !this.hasNext(cached.response, page))
    ) {
      this.pages.delete(page)
      this.pages.set(page, cached)
      return Promise.resolve(cached.response)
    }
    this.pages.delete(page)
    const existing = this.pending.get(page)
    if (existing) {
      existing.foreground ||= foreground
      return existing.promise
    }
    let resolve!: PendingPage['resolve']
    let reject!: PendingPage['reject']
    const promise = new Promise<ModSearchResult | undefined>((done, fail) => {
      resolve = done
      reject = fail
    })
    const entry = { page, foreground, resolve, reject, promise }
    this.pending.set(page, entry)
    this.queue.push(entry)
    this.pump()
    return promise
  }

  private pump(): void {
    if (this.running || this.disposed) return
    const foreground = this.queue.findIndex((entry) => entry.foreground)
    const entry = this.queue.splice(foreground < 0 ? 0 : foreground, 1)[0]
    if (!entry) return
    this.running = true
    void this.execute(entry)
  }

  private async execute(entry: PendingPage): Promise<void> {
    const refresh = this.refresh
    this.refresh = false
    try {
      const response = await this.load({ page: entry.page, sessionId: this.sessionId, refresh })
      if (this.disposed) {
        entry.resolve(undefined)
        return
      }
      if (response.sessionId && this.sessionId && response.sessionId !== this.sessionId) this.pages.clear()
      this.sessionId = response.sessionId ?? this.sessionId
      const page = response.page ?? entry.page
      this.pages.delete(page)
      this.pages.set(page, { response, expiresAt: this.now() + 10 * 60_000 })
      while (this.pages.size > (this.options.maxEntries ?? 60)) {
        const oldest = this.pages.keys().next().value
        if (oldest !== undefined) this.pages.delete(oldest)
      }
      entry.resolve(response)
    } catch (error) {
      if (this.disposed) entry.resolve(undefined)
      else entry.reject(error)
    } finally {
      this.pending.delete(entry.page)
      this.running = false
      this.pump()
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)()
  }
}
