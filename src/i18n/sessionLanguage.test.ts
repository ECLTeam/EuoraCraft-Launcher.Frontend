import { afterEach, describe, expect, it } from 'vitest'
import { applySessionLanguage, resolveLocale, sessionLanguage } from './index'

afterEach(() => applySessionLanguage(null))

describe('本次启动语言覆盖', () => {
  it('保留持久设置但优先显示本次语言', () => {
    const saved = { locale: 'zh-CN', theme: { mode: 'dark' } }
    applySessionLanguage('en-US')
    expect(resolveLocale(saved.locale)).toBe('en-US')
    expect(saved.locale).toBe('zh-CN')
    expect(resolveLocale('de-DE')).toBe('en-US')
    expect(sessionLanguage.value).toBe('en-US')
    applySessionLanguage(null)
    expect(resolveLocale('de-DE')).toBe('de-DE')
  })

  it('拒绝未知宿主输入并使用有效的持久语言', () => {
    applySessionLanguage({ language: 'en-US' })
    expect(sessionLanguage.value).toBeNull()
    expect(resolveLocale('ja-JP')).toBe('ja-JP')
    expect(resolveLocale('unknown')).toBe('zh-CN')
  })
})
