import type { ApiResponse } from '@/types/api'
import type { ConfigSection, ConfigSectionSnapshot } from '@/types/config'
import { call } from './commands'

export function createConfig() {
  return {
    get<T = unknown>(section: ConfigSection) {
      return call<T>('settings_get', { section })
    },
    set(section: ConfigSection, data: unknown) {
      return call<ConfigSectionSnapshot>('settings_set', { section, data })
    },
    async list(): Promise<ApiResponse<string[]>> {
      const response = await call<Record<string, unknown>>('settings_get')
      if (!response.success) return response as unknown as ApiResponse<string[]>
      return { ...response, data: Object.keys(response.data ?? {}) }
    },

    /** 一次拉取全部配置 */
    getAll() {
      return call<Record<string, unknown>>('settings_get')
    },

    /** 一次拉取多个分区 */
    getMany(sections: ConfigSection[]) {
      return call<Record<string, unknown>>('settings_get', { sections })
    },
  }
}
