import { beforeEach, describe, expect, it } from 'vitest'
import {
  recallSectionPath,
  recallSectionScroll,
  rememberSectionPath,
  rememberSectionScroll,
  resetSectionMemory,
} from './sectionMemory'

beforeEach(() => {
  resetSectionMemory()
})

describe('分区子页面记忆', () => {
  it('未记录时返回默认子页面与零位置', () => {
    expect(recallSectionPath('/settings', '/settings/launcher')).toBe('/settings/launcher')
    expect(recallSectionScroll('/settings/game')).toBe(0)
  })

  it('按分区记录最近子页面，互不覆盖', () => {
    rememberSectionPath('/settings', '/settings/game')
    rememberSectionPath('/more', '/more/tools')

    expect(recallSectionPath('/settings', '/settings/launcher')).toBe('/settings/game')
    expect(recallSectionPath('/more', '/more/room')).toBe('/more/tools')
    expect(recallSectionPath('/other', '/other/first')).toBe('/other/first')
  })

  it('按子页面记录滚动位置并取整，负数按零处理', () => {
    rememberSectionScroll('/settings/about', 412.6)
    rememberSectionScroll('/settings/game', -30)

    expect(recallSectionScroll('/settings/about')).toBe(413)
    expect(recallSectionScroll('/settings/game')).toBe(0)
    expect(recallSectionScroll('/settings/launcher')).toBe(0)
  })

  it('重置后不再保留任何记忆', () => {
    rememberSectionPath('/settings', '/settings/java')
    rememberSectionScroll('/settings/java', 120)

    resetSectionMemory()

    expect(recallSectionPath('/settings', '/settings/launcher')).toBe('/settings/launcher')
    expect(recallSectionScroll('/settings/java')).toBe(0)
  })
})
