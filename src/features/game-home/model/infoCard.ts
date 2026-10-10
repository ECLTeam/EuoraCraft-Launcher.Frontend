import type { InfoCardAnnouncement, InfoCardData, InfoCardMode } from '@/types/system'

export type InfoCardView = 'tip' | 'announce'

/**
 * 组合首页卡片的本地文案与后端公告。
 *
 * 小贴士和欢迎语随前端语言切换；公告仍由后端负责拉取、缓存和有效期过滤，
 * 避免把网络代理与离线回退逻辑搬进 WebView。
 */
export function createLocalizedInfoCard(
  announcements: InfoCardAnnouncement[],
  t: (key: string) => string,
  locale = 'zh-CN'
): InfoCardData {
  return {
    mode: 'rotate',
    tip_title: t('game.didYouKnow'),
    announcement_title: t('game.announcement'),
    tips: [
      t('game.infoCard.tips.gameSettings'),
      t('game.infoCard.tips.instanceSettings'),
      t('game.infoCard.tips.accounts'),
      t('game.infoCard.tips.dataDirectory'),
    ],
    announcements: localizeAnnouncements(announcements, locale),
    welcome: {
      title: t('game.welcomeTitle'),
      content: t('game.welcomeContent'),
    },
    interval: 8000,
  }
}

/**
 * 为当前界面语言选择远程公告文案，并提供稳定的中文与默认文案回退。
 */
export function localizeAnnouncements(announcements: InfoCardAnnouncement[], locale: string): InfoCardAnnouncement[] {
  return announcements.map((announcement) => {
    const translation = announcement.locales?.[locale] ?? announcement.locales?.['zh-CN']
    return translation ? { ...announcement, ...translation } : announcement
  })
}

export function resolveInitialInfoCardView(
  mode: InfoCardMode,
  hasTips: boolean,
  hasAnnouncements: boolean
): InfoCardView {
  if (mode === 'tip_only') return 'tip'
  if (mode === 'announcement_only' || mode === 'announcement_first') {
    return hasAnnouncements ? 'announce' : 'tip'
  }
  return hasAnnouncements ? 'announce' : hasTips ? 'tip' : 'tip'
}
