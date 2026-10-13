import { hashKey, type QueryKey } from '@tanstack/vue-query'

const queues = new Map<string, { scope: QueryKey; settled: Promise<void> }>()

export function hasMutation(scope: QueryKey): boolean {
  return queues.has(hashKey(scope))
}

/** 同一业务目标串行提交，独立动作不会因共享队列而被合并或取消。 */
export function serializeMutation<T>(scope: QueryKey, action: () => Promise<T>): Promise<T> {
  const key = hashKey(scope)
  const previous = queues.get(key)?.settled ?? Promise.resolve()
  const request = previous.then(action)
  const settled = request.then(
    () => undefined,
    () => undefined
  )
  const entry = { scope, settled }
  queues.set(key, entry)
  void settled.then(() => {
    if (queues.get(key) === entry) queues.delete(key)
  })
  return request
}

export async function waitForMutations(prefix: QueryKey): Promise<void> {
  while (true) {
    const waiting = [...queues.values()].filter(({ scope }) => prefix.every((value, index) => scope[index] === value))
    if (!waiting.length) return
    await Promise.all(waiting.map(({ settled }) => settled))
  }
}
