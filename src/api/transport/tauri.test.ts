import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTauriTransport } from './tauri'

describe('Tauri event transport', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI__')
  })

  it('decodes JSON string payloads emitted by the Python bridge', async () => {
    const listen = vi.fn(async (_event: string, callback: (event: { payload: string }) => void) => {
      callback({ payload: '{"error_id":"crash-1","message":"Minecraft crashed"}' })
      return vi.fn()
    })
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {
        pytaurix: { pyInvoke: vi.fn() },
        event: { listen },
      },
    })
    const handler = vi.fn()

    await createTauriTransport().listen('launcher:error', handler)

    expect(handler).toHaveBeenCalledWith({ error_id: 'crash-1', message: 'Minecraft crashed' })
  })
})
