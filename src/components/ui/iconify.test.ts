import { describe, expect, it } from 'vitest'
import { BUILTIN_THEMES } from '@/config/theme'
import { ICON_MAP } from './iconify'
import { icons } from './tabler-subset'

describe('图标映射', () => {
  it('ICON_MAP 中所有 Tabler 图标名均存在于运行时使用的 tabler-subset（含别名）', () => {
    const iconSet = icons as { icons: Record<string, unknown>; aliases?: Record<string, unknown> }
    for (const [short, tablerName] of Object.entries(ICON_MAP)) {
      const resolved = iconSet.icons[tablerName] ?? iconSet.aliases?.[tablerName]
      expect(resolved, `短名 ${short} -> tabler:${tablerName} 未包含在 tabler-subset`).toBeDefined()
    }
  })

  it('实例运行管理使用的图标短名均已注册', () => {
    for (const shortName of ['activity', 'game', 'refresh', 'shield', 'stop']) {
      expect(ICON_MAP[shortName], `实例运行管理图标 ${shortName} 未注册`).toBeDefined()
    }
  })

  it('实例列表工具栏和卡片使用的图标短名均已注册', () => {
    const iconNames = [
      'pin',
      'tags',
      'eye-off',
      'filter',
      'filter-off',
      'sort-ascending',
      'sort-descending',
      'layout-grid',
      'clock',
      'hourglass',
      'rocket',
    ]
    for (const shortName of iconNames) {
      expect(ICON_MAP[shortName], `实例列表图标 ${shortName} 未注册`).toBeDefined()
    }
  })

  it('Mod 版本页使用的图标短名均已注册', () => {
    for (const shortName of ['layers', 'packages', 'chevron-right']) {
      expect(ICON_MAP[shortName], `Mod 版本页图标 ${shortName} 未注册`).toBeDefined()
    }
  })

  it('联机页面使用的图标短名均已注册', () => {
    for (const shortName of ['wifi', 'network', 'login', 'logout', 'link', 'plus', 'alert-circle', 'users', 'crown']) {
      expect(ICON_MAP[shortName], `联机图标 ${shortName} 未注册`).toBeDefined()
    }
  })

  it('账户管理使用的图标短名均已注册', () => {
    for (const shortName of ['users', 'shirt']) {
      expect(ICON_MAP[shortName], `账户管理图标 ${shortName} 未注册`).toBeDefined()
    }
  })

  it('外观设置内置主题使用的图标短名均已注册', () => {
    for (const { id, icon } of BUILTIN_THEMES) {
      expect(ICON_MAP[icon], `主题 ${id} 的图标 ${icon} 未注册`).toBeDefined()
    }
  })
})
