import backend from '@/api/client'
import { unwrapResponse as assertSuccess } from '@/app/runtime/errorPresentation'
import {
  normalizeVersionSettings,
  type VersionLaunchSettings,
  type VersionSettingsTarget,
} from '@/features/instances/model/instanceSettings'
/**
 * 版本独立启动设置保存在每个版本自己的目录中
 * （.minecraft/versions/<versionId>/.ecl/settings.json），
 * 不再写入全局 setting.json，避免全局配置携带实例相关数据。
 */
export const instanceSettingsApi = {
  async get(target: VersionSettingsTarget): Promise<VersionLaunchSettings> {
    const result = await backend.command('game_version_settings_get', {
      game_path: target.path,
      version_id: target.versionId,
    })
    const stored = assertSuccess(result, '读取版本独立设置')
    // 旧配置的唯一性判断与原子迁移由后端负责，前端不再写回整个历史分区。
    return normalizeVersionSettings(stored)
  },

  async save(target: VersionSettingsTarget, value: Partial<VersionLaunchSettings>): Promise<void> {
    const result = await backend.command('game_version_settings_set', {
      game_path: target.path,
      version_id: target.versionId,
      data: normalizeVersionSettings(value),
    })
    assertSuccess(result, '保存版本独立设置')
  },

  async reset(target: VersionSettingsTarget): Promise<void> {
    const result = await backend.command('game_version_settings_set', {
      game_path: target.path,
      version_id: target.versionId,
      data: {},
    })
    assertSuccess(result, '重置版本独立设置')
  },

  async effective(target: VersionSettingsTarget): Promise<Record<string, unknown>> {
    return assertSuccess(
      await backend.command('game_version_settings_effective', {
        game_path: target.path,
        version_id: target.versionId,
      }),
      '读取有效启动设置'
    )
  },
}
