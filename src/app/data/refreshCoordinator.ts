import { hashKey, type QueryKey } from '@tanstack/vue-query'
import { toRaw } from 'vue'
import { queryClient } from '@/app/queryClient'
import { i18n } from '@/i18n'

interface ResourceRevision {
  revision: number
  snapshotRevision: number
  forceRevision: number
  active: object | null
  retired: boolean
}

const revisions = new Map<string, ResourceRevision>()

queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'removed') return
  const state = revisions.get(event.query.queryHash)
  if (state) state.retired = true
  revisions.delete(event.query.queryHash)
})

function resourceRevision(key: QueryKey): ResourceRevision {
  const hash = hashKey(key)
  let state = revisions.get(hash)
  if (!state) {
    state = { revision: 0, snapshotRevision: -1, forceRevision: -1, active: null, retired: false }
    revisions.set(hash, state)
  }
  return state
}

/** 失效只标记变化，不取消已发出的 IPC；同一读取会继续取得最后一次变化后的结果。 */
export function invalidateResource(queryKey: QueryKey, exact = true): Promise<void> {
  const queries = queryClient.getQueryCache().findAll({ queryKey, exact })
  for (const query of queries) resourceRevision(query.queryKey).revision++
  if (exact && queries.length === 0) resourceRevision(queryKey).revision++
  return queryClient.invalidateQueries({ queryKey, exact, refetchType: 'none' }, { cancelRefetch: false })
}

/** 权威事件或写入响应提供完整快照时，迟到的旧读取也只能返回这一新快照。 */
export function setResourceSnapshot<T>(queryKey: QueryKey, snapshot: T): void {
  const state = resourceRevision(queryKey)
  state.snapshotRevision = ++state.revision
  queryClient.setQueryData(queryKey, structuredClone(toRaw(snapshot)))
}

/** 统一共享读取、显式刷新和变化期间的旧响应保护；业务动作不得使用此接口。 */
export async function readResource<T>(options: {
  queryKey: QueryKey
  load: (context: { force: boolean }) => Promise<T>
  staleTime?: number
  force?: boolean
}): Promise<T> {
  const { queryKey, load } = options
  const state = resourceRevision(queryKey)
  if (options.force && (!state.active || state.forceRevision !== state.revision)) {
    await invalidateResource(queryKey)
    state.forceRevision = state.revision
  }
  const result = await queryClient.fetchQuery({
    queryKey,
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
    queryFn: async ({ signal }) => {
      const active = {}
      state.active = active
      try {
        for (let attempt = 0; attempt < 8; attempt++) {
          const revision = state.revision
          const value = await load({ force: state.forceRevision === state.revision })
          if (state.retired || signal.aborted) throw new DOMException('读取所属数据域已释放', 'AbortError')
          if (revision === state.revision) return value
          if (state.snapshotRevision === state.revision) {
            const snapshot = queryClient.getQueryData<T>(queryKey)
            if (snapshot !== undefined) return snapshot
          }
          // 多个变更只要求读取最新状态，不为每个通知启动一条并行请求。
        }
        throw new Error(i18n.global.t('dataSync.changing'))
      } finally {
        if (state.active === active) {
          state.active = null
          state.forceRevision = -1
        }
      }
    },
  })
  if (state.snapshotRevision === state.revision) {
    const snapshot = queryClient.getQueryData<T>(queryKey)
    if (snapshot !== undefined) return structuredClone(toRaw(snapshot))
  }
  // 缓存命中后到 Promise 继续执行前也可能发生写入，不能返回已经失效的缓存。
  if (queryClient.getQueryState(queryKey)?.isInvalidated) return readResource({ ...options, force: false })
  return structuredClone(toRaw(result))
}
