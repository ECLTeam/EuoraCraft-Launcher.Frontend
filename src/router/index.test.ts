import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import { isConnectorRouteAvailable, moreDefaultPath } from './index'

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
