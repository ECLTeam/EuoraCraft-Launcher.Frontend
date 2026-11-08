import { afterEach, describe, expect, it } from 'vitest'
import { rememberSectionPath, resetSectionMemory } from '@/app/runtime/sectionMemory'
import { i18n } from '@/i18n'
import { moreEntryPath, settingsEntryPath } from './index'

describe('分区入口子页面', () => {
  afterEach(() => {
    resetSectionMemory()
    i18n.global.locale.value = 'zh-CN'
  })

  it('首次进入设置与更多时使用默认子页面', () => {
    expect(settingsEntryPath()).toBe('/settings/launcher')
    expect(moreEntryPath()).toBe('/more/plugins')
  })

  it('再次进入分区时回到上次停留的子页面', () => {
    rememberSectionPath('/settings', '/settings/about')
    rememberSectionPath('/more', '/more/tools')

    expect(settingsEntryPath()).toBe('/settings/about')
    expect(moreEntryPath()).toBe('/more/tools')
  })
})
