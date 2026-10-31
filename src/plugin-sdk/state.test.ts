import { beforeEach, expect, it, vi } from 'vitest'
import { configQuery } from '@/app/data'
import { getThemeState, refreshTheme } from './state'

vi.mock('@/app/data', () => ({
  configQuery: vi.fn(),
  accountsQuery: vi.fn(),
  launcherInfoQuery: vi.fn(),
}))

vi.mock('@/api/client', () => ({ default: { on: vi.fn(() => () => undefined) } }))

type ConfigSnapshot = Awaited<ReturnType<typeof configQuery>>

/** 构造带 ui 分区的有效配置快照；主题字段必须位于 ui.theme 分支。 */
function themeSnapshot(theme: Record<string, unknown>): ConfigSnapshot {
  return {
    ui: { theme },
    game: { minecraft_paths: [] },
    download: { mirror_source: 'official' },
    launcher: {},
    connector: { mode: 'automatic', nodes: [] },
  } as unknown as ConfigSnapshot
}

beforeEach(() => {
  vi.clearAllMocks()
})

it('从 ui.theme 分支读取主题模式、主色与透明度', async () => {
  vi.mocked(configQuery).mockResolvedValue(
    themeSnapshot({ mode: 'dark', primary_color: '#123456', background_opacity: 0.5 })
  )

  await refreshTheme()

  expect(getThemeState().value.mode).toBe('dark')
  expect(getThemeState().value.primaryColor).toBe('#123456')
  expect(getThemeState().value.backgroundOpacity).toBe(0.5)
  expect(getThemeState().value.isDark).toBe(true)
})

it('缺少 mode 时保留已生效的模式，不退回默认值', async () => {
  vi.mocked(configQuery).mockResolvedValue(themeSnapshot({ mode: 'light' }))
  await refreshTheme()

  vi.mocked(configQuery).mockResolvedValue(themeSnapshot({ primary_color: '#000000' }))
  await refreshTheme()

  expect(getThemeState().value.mode).toBe('light')
  expect(getThemeState().value.primaryColor).toBe('#000000')
  expect(getThemeState().value.isDark).toBe(false)
})

it('背景透明度为零时仍然生效', async () => {
  vi.mocked(configQuery).mockResolvedValue(themeSnapshot({ mode: 'system', background_opacity: 0 }))

  await refreshTheme()

  expect(getThemeState().value.backgroundOpacity).toBe(0)
})
