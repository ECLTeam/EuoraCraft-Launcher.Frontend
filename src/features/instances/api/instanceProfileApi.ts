import backend from '@/api/client'
import { invalidateResource, readResource, setResourceSnapshot } from '@/app/data/refreshCoordinator'
import { queryClient } from '@/app/queryClient'
import { queryKeys } from '@/app/queryKeys'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import { parseInstanceCategories } from '@/features/instances/model/instanceCategories'
import { parseInstanceProfile } from '@/features/instances/model/instanceProfileSnapshot'
import type { InstanceCategory, InstanceProfile, ScannedVersion } from '@/types/instances'
import { gamePathIdentity } from '@/utils/path'

export interface InstanceTarget {
  gamePath: string
  versionId: string
}

function payload(target: InstanceTarget) {
  return { game_path: target.gamePath, version_id: target.versionId }
}

function profileKey(target: InstanceTarget) {
  return ['instance-profile', gamePathIdentity(target.gamePath), target.versionId] as const
}

export function targetFromVersion(version: ScannedVersion): InstanceTarget {
  return { gamePath: version.path, versionId: version.versionId }
}

export const instanceProfileApi = {
  async get(target: InstanceTarget): Promise<InstanceProfile> {
    return readResource({
      queryKey: profileKey(target),
      staleTime: 0,
      load: async () =>
        parseInstanceProfile(
          unwrapResponse(await backend.command('game_instance_profile_get', payload(target)), '读取实例资料')
        ),
    })
  },

  async patch(
    target: InstanceTarget,
    patch: Partial<Omit<InstanceProfile, 'schemaVersion' | 'icon'>>
  ): Promise<InstanceProfile> {
    const profile = parseInstanceProfile(
      unwrapResponse(
        await backend.command('game_instance_profile_patch', { ...payload(target), patch }),
        '保存实例资料'
      )
    )
    setResourceSnapshot(profileKey(target), profile)
    return profile
  },

  async reset(target: InstanceTarget, fields: string[]): Promise<InstanceProfile> {
    const profile = parseInstanceProfile(
      unwrapResponse(
        await backend.command('game_instance_profile_reset', { ...payload(target), fields }),
        '恢复实例资料自动值'
      )
    )
    setResourceSnapshot(profileKey(target), profile)
    return profile
  },

  async setIcon(
    target: InstanceTarget,
    iconType: 'auto' | 'builtin' | 'loader' | 'local',
    options: { value?: string; sourcePath?: string } = {}
  ): Promise<InstanceProfile> {
    const profile = parseInstanceProfile(
      unwrapResponse(
        await backend.command('game_instance_icon_set', {
          ...payload(target),
          icon_type: iconType,
          value: options.value,
          source_path: options.sourcePath,
        }),
        '保存实例图标'
      )
    )
    setResourceSnapshot(profileKey(target), profile)
    return profile
  },

  async chooseLocalIcon(): Promise<string | null> {
    const result = unwrapResponse(await backend.command('select_image', { purpose: 'instance_icon' }), '选择实例图标')
    return result?.path || null
  },

  async setPinOrder(versions: ScannedVersion[]): Promise<void> {
    unwrapResponse(
      await backend.command('game_instance_pin_order_set', {
        entries: versions.map((version) => ({ game_path: version.path, version_id: version.versionId })),
      }),
      '保存置顶顺序'
    )
  },

  async categories(): Promise<InstanceCategory[]> {
    return readResource({
      queryKey: queryKeys.instanceCategories,
      staleTime: Infinity,
      load: async () =>
        parseInstanceCategories(unwrapResponse(await backend.command('game_instance_categories_get'), '读取实例分类')),
    })
  },

  acceptCategoriesSnapshot(value: unknown): void {
    setResourceSnapshot(queryKeys.instanceCategories, parseInstanceCategories(value))
  },

  async upsertCategory(category: Partial<InstanceCategory> & Pick<InstanceCategory, 'name' | 'color'>) {
    const result = unwrapResponse(
      await backend.command('game_instance_categories_upsert', {
        category_id: category.id,
        name: category.name,
        color: category.color,
        order: category.order,
      }),
      '保存实例分类'
    )
    const categories = queryClient.getQueryData<InstanceCategory[]>(queryKeys.instanceCategories)
    if (
      !categories?.some(
        (item) =>
          item.id === result.id &&
          item.name === result.name &&
          item.color === result.color &&
          item.order === result.order
      )
    ) {
      await invalidateResource(queryKeys.instanceCategories)
    }
    return result
  },

  async deleteCategory(categoryId: string): Promise<void> {
    unwrapResponse(
      await backend.command('game_instance_categories_delete', { category_id: categoryId }),
      '删除实例分类'
    )
    const categories = queryClient.getQueryData<InstanceCategory[]>(queryKeys.instanceCategories)
    if (!categories || categories.some((item) => item.id === categoryId))
      await invalidateResource(queryKeys.instanceCategories)
  },
}
