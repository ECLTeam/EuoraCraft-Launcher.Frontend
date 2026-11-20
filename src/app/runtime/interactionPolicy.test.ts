import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { installDesktopInteractionPolicy } from './interactionPolicy'

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
}

describe('桌面交互策略', () => {
  it('调试模式下 F12 打开开发者工具', () => {
    const openDevTools = vi.fn()
    const dispose = installDesktopInteractionPolicy(ref(true), { openDevTools })

    const event = press('F12')

    expect(openDevTools).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    dispose()
  })

  it('非调试模式下 F12 只拦默认行为，不打开开发者工具', () => {
    const openDevTools = vi.fn()
    const dispose = installDesktopInteractionPolicy(ref(false), { openDevTools })

    const event = press('F12')

    expect(openDevTools).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    dispose()
  })
})
