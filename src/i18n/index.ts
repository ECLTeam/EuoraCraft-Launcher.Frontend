import { readonly, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import backend from '@/api/client'
import { configQuery, launcherInfoQuery } from '@/app/data'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { errorCodeMessageKeys, setErrorCodeResolver } from '@/utils/errorCodeMessages'
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
const sessionLocale = ref<LocaleCode | null>(null)
export const sessionLanguage = readonly(sessionLocale)

/** 验证宿主提供的会话覆盖；不写入持久 UI 设置。 */
export function applySessionLanguage(value: unknown): void {
  sessionLocale.value = supportedLocales.find(({ code }) => code === value)?.code ?? null
}

/** 界面使用本次显式语言覆盖，配置编辑仍持有原保存值。 */
export function resolveLocale(value: unknown): LocaleCode {
  return sessionLocale.value ?? supportedLocales.find(({ code }) => code === value)?.code ?? defaultLocale
}

/**
 * 判断界面语言是否为简体中文。
 *
 * 下载源、模组源与联机功能只面向简体中文用户，其他语言不提供这些入口。
 * @param locale - 当前界面语言代码
 * @returns 是否为简体中文
 */
export function isSimplifiedChinese(locale: string): boolean {
  return locale === defaultLocale
}

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
      const [config, info] = await Promise.all([configQuery(), launcherInfoQuery()])
      applySessionLanguage(info?.session_language)
      const locale = resolveLocale(config.ui.locale)
      if (locale) {
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
  const effective = resolveLocale(locale)
  i18n.global.locale.value = effective
  document.documentElement.setAttribute('lang', effective)

  try {
    if (backend.runtime.isAvailable) {
      await useSettingsStore().updateUi((ui) => ({ ...ui, locale }))
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

/**
 * 错误码文案查询：界面只展示文案，不展示错误码本身。
 */
setErrorCodeResolver((code) => {
  for (const key of errorCodeMessageKeys(code)) {
    if (i18n.global.te(key)) return i18n.global.t(key)
  }
  return null
})
