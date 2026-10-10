import { describe, expect, it } from 'vitest'
import { createLocalizedInfoCard, localizeAnnouncements, resolveInitialInfoCardView } from './infoCard'

describe('game home info card', () => {
  it('无远程公告时仍使用当前语言的本地小贴士和欢迎语', () => {
    const chinese = createLocalizedInfoCard([], (key) => `zh:${key}`)
    const english = createLocalizedInfoCard([], (key) => `en:${key}`, 'en-US')

    expect(english.announcements).toEqual([])
    expect(english.tips).toHaveLength(4)
    expect(chinese.tip_title).toBe('zh:game.didYouKnow')
    expect(english.tip_title).toBe('en:game.didYouKnow')
    expect(english.welcome?.content).toBe('en:game.welcomeContent')
  })

  it('将前端翻译与远程公告组合为首页卡片', () => {
    const card = createLocalizedInfoCard(
      [{ id: 'notice-1', title: 'Remote notice', date: '', content: 'Details' }],
      (key) => `translated:${key}`
    )

    expect(card.tips).toHaveLength(4)
    expect(card.tip_title).toBe('translated:game.didYouKnow')
    expect(card.welcome?.content).toBe('translated:game.welcomeContent')
    expect(card.announcements).toEqual([{ id: 'notice-1', title: 'Remote notice', date: '', content: 'Details' }])
  })

  it('优先使用当前语言的远程公告翻译', () => {
    const [announcement] = localizeAnnouncements(
      [
        {
          id: 'notice-1',
          title: '默认标题',
          date: '',
          content: '默认正文',
          locales: {
            'zh-CN': { title: '中文标题', content: '中文正文' },
            'en-US': { title: 'English title', content: 'English content' },
          },
        },
      ],
      'en-US'
    )

    expect(announcement).toMatchObject({ title: 'English title', content: 'English content' })
  })

  it('在缺少当前语言时依次回退中文和默认文案', () => {
    const [chineseFallback] = localizeAnnouncements(
      [
        {
          title: '默认标题',
          date: '',
          content: '默认正文',
          locales: { 'zh-CN': { title: '中文标题', content: '中文正文' } },
        },
      ],
      'ja-JP'
    )
    const [defaultFallback] = localizeAnnouncements([{ title: '默认标题', date: '', content: '默认正文' }], 'ja-JP')

    expect(chineseFallback).toMatchObject({ title: '中文标题', content: '中文正文' })
    expect(defaultFallback).toMatchObject({ title: '默认标题', content: '默认正文' })
  })

  it('公告优先模式在无公告时回退到提示', () => {
    expect(resolveInitialInfoCardView('announcement_first', true, false)).toBe('tip')
    expect(resolveInitialInfoCardView('announcement_first', true, true)).toBe('announce')
  })
})
