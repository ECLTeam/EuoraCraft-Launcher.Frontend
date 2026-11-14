/**
 * 把后端返回的错误码转换成面向用户的失败说明。
 *
 * 后端诊断信息与用户提示共用 `message` 字段，安装、清单校验等失败会直接给出
 * 稳定错误码（如 `PLUGIN_INSTALL_FAILED`）。错误码只用于排查，不能出现在界面
 * 提示里，因此所有提示出口都先经过这里：命中文案表就返回本地化文案，未登记的
 * 码回退到调用方给出的业务说明，同时把码写进前端日志，保证仍可定位。
 *
 * 翻译能力由 i18n 初始化时注入，避免工具模块反向依赖 i18n 实例造成循环引用。
 */

type ErrorCodeResolver = (code: string) => string | null

let resolveCodeMessage: ErrorCodeResolver | null = null

/** 裸错误码：全大写字母数字并以分隔符连接，避免把 OK、404 之类误判为错误码。 */
const BARE_ERROR_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/

/**
 * 注册把错误码翻译为文案的函数。
 * @param resolver - 返回本地化文案，未登记该码时返回 null
 */
export function setErrorCodeResolver(resolver: ErrorCodeResolver | null): void {
  resolveCodeMessage = resolver
}

/**
 * 列出某个错误码可能的文案键，供需要自己判断文案是否存在的组件使用。
 *
 * 新增错误码统一登记到 `error.codes`；`plugins.errors` 是插件页的历史位置，
 * 随插件相关改动逐步收敛，因此先查新位置再查旧位置。
 * @param code - 后端错误码
 * @returns 按优先级排列的 i18n 键
 */
export function errorCodeMessageKeys(code: string): string[] {
  return [`error.codes.${code}`, `plugins.errors.${code}`]
}

/**
 * 判断一段文本是否只是错误码本身。
 * @param value - 待判断的文本
 * @returns 是裸错误码时为 true
 */
export function isBareErrorCode(value: string): boolean {
  return BARE_ERROR_CODE.test(value.trim())
}

/**
 * 返回可以直接展示给用户的失败说明。
 * @param raw - 后端返回的 message，可能只是错误码
 * @param fallback - 调用方针对该操作的业务说明，未登记的错误码回退到它
 * @returns 不含裸错误码的提示文本
 */
export function resolveDisplayMessage(raw: unknown, fallback: string): string {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return fallback
  if (!isBareErrorCode(text)) return text

  const translated = resolveCodeMessage?.(text)
  if (translated) return translated

  // 码本身写入前端日志（会被转发到启动器日志），界面只保留业务说明。
  console.warn(`[error] 未登记的错误码：${text}`)
  return fallback
}
