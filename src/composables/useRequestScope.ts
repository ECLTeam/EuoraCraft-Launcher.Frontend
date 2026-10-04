import { onScopeDispose, watch } from 'vue'

/** 将异步响应限定在当前目标和最新请求，目标切换及卸载后自动失效。 */
export function useRequestScope(target: () => string) {
  let revision = 0
  let isActive = true
  watch(target, () => revision++, { flush: 'sync' })
  onScopeDispose(() => {
    isActive = false
    revision++
  })
  return {
    begin(): () => boolean {
      const requestRevision = ++revision
      const targetKey = target()
      return () => isActive && revision === requestRevision && target() === targetKey
    },
    invalidate(): void {
      revision++
    },
  }
}
