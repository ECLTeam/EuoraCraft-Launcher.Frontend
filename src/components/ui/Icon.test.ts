import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Icon from './Icon.vue'

describe('UiIcon', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染 Iconify 图标时不触发属性类型警告（aria-hidden 须以布尔值绑定）', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mount(Icon, { props: { name: 'play', size: 14 } })

    const invalidPropWarnings = warnSpy.mock.calls
      .map((args) => args.map(String).join(' '))
      .filter((message) => message.includes('Invalid prop'))
    expect(invalidPropWarnings).toEqual([])
  })
})
