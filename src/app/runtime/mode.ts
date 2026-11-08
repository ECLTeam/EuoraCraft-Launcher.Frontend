export type AppRuntimeMode = 'desktop' | 'showcase' | 'browser'

function hasTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { __TAURI__?: { pytaruix?: unknown } }).__TAURI__?.pytaruix
}

export function hasShowcaseQuery(): boolean {
  if (typeof window === 'undefined') return false
  const value = new URLSearchParams(window.location.search).get('showcase')
  return value === '1' || value === 'true'
}

export function detectRuntimeMode(): AppRuntimeMode {
  if (hasTauriRuntime()) return 'desktop'
  if (import.meta.env.MODE === 'showcase' || hasShowcaseQuery()) return 'showcase'
  return 'browser'
}
