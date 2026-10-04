import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { useRequestScope } from './useRequestScope'

describe('异步目标范围', () => {
  it('旧请求在再次请求、A→B→A 和卸载时失效', () => {
    const target = ref('A')
    const scope = effectScope()
    const requests = scope.run(() => useRequestScope(() => target.value))!
    const first = requests.begin()
    const second = requests.begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
    target.value = 'B'
    target.value = 'A'
    expect(second()).toBe(false)
    const third = requests.begin()
    scope.stop()
    expect(third()).toBe(false)
  })
})
