import { createI18n } from 'vue-i18n'
import backend from '@/api/client'
import { configQuery, invalidateConfig } from '@/app/data'
import deDE from './locales/de-DE.json'
import enUS from './locales/en-US.json'
import jaJP from './locales/ja-JP.json'
import ruRU from './locales/ru-RU.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

// 支持的语言列表
export const supportedLocales = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ru-RU', name: 'Русский' },
  { code: 'de-DE', name: 'Deutsch' },
] as const

export type LocaleCode = (typeof supportedLocales)[number]['code']

export const defaultLocale: LocaleCode = 'zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: defaultLocale,
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'en-US': enUS,
    'ja-JP': jaJP,
    'ru-RU': ruRU,
    'de-DE': deDE,
  },
})

/**
 * 从后端配置加载并应用语言。
 * @returns 最终生效的语言代码
 */
export async function loadLocaleFromBackend(): Promise<LocaleCode> {
  try {
    if (backend.runtime.isAvailable) {
      const config = await configQuery()
      const locale = config.ui.locale as LocaleCode | undefined
      if (locale && supportedLocales.some((l) => l.code === locale)) {
        i18n.global.locale.value = locale
        document.documentElement.setAttribute('lang', locale)
        return locale
      }
    }
  } catch (error) {
    console.warn('[i18n] 从后端加载语言配置失败:', error)
  }
  return defaultLocale
}

/**
 * 切换前端语言并同步保存到后端。
 * @param locale - 目标语言代码
 */
export async function setLocale(locale: LocaleCode): Promise<void> {
  i18n.global.locale.value = locale
  document.documentElement.setAttribute('lang', locale)

  try {
    if (backend.runtime.isAvailable) {
      const config = await configQuery()
      await backend.config.set('ui', { ...config.ui, locale })
      await invalidateConfig()
    }
  } catch (error) {
    console.warn('[i18n] 保存语言配置到后端失败:', error)
  }
}

/**
 * 获取当前生效的语言代码。
 */
export function getCurrentLocale(): LocaleCode {
  return i18n.global.locale.value as LocaleCode
}

export default i18n
