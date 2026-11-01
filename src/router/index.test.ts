import { afterEach, describe, expect, it } from 'vitest'
import { rememberSectionPath, resetSectionMemory } from '@/app/runtime/sectionMemory'
import { i18n } from '@/i18n'
import { isConnectorRouteAvailable, moreDefaultPath, moreEntryPath, settingsEntryPath } from './index'

describe('联机路由入口', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })

  it('简体中文可进入联机页，更多页默认落到联机', () => {
    i18n.global.locale.value = 'zh-CN'

    expect(isConnectorRouteAvailable()).toBe(true)
    expect(moreDefaultPath()).toBe('/more/room')
  })

  it('其他语言关闭联机入口，更多页默认落到插件', () => {
    i18n.global.locale.value = 'en-US'

    expect(isConnectorRouteAvailable()).toBe(false)
    expect(moreDefaultPath()).toBe('/more/plugins')
  })
})

describe('分区入口子页面', () => {
  afterEach(() => {
    resetSectionMemory()
    i18n.global.locale.value = 'zh-CN'
  })

  it('首次进入设置与更多时使用默认子页面', () => {
    expect(settingsEntryPath()).toBe('/settings/launcher')
    expect(moreEntryPath()).toBe('/more/room')
  })

  it('再次进入分区时回到上次停留的子页面', () => {
    rememberSectionPath('/settings', '/settings/about')
    rememberSectionPath('/more', '/more/tools')

    expect(settingsEntryPath()).toBe('/settings/about')
    expect(moreEntryPath()).toBe('/more/tools')
  })
})
