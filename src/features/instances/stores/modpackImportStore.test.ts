import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { modpackApi } from '@/features/instances/api/modpackApi'
import { derivePackName, extractPackPath, useModpackImportStore } from './modpackImportStore'

vi.mock('@/features/instances/api/modpackApi', () => ({
  modpackApi: {
    prepare: vi.fn(),
    get: vi.fn(),
    install: vi.fn(),
    release: vi.fn(),
  },
  parseModpackResult: (value: unknown) => value,
}))

const settingsState = vi.hoisted(() => ({ lastInstallPath: 'D:/default' }))

vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    status: 'ready',
    game: { minecraft_paths: [], last_install_path: settingsState.lastInstallPath },
    load: vi.fn(),
  }),
}))

vi.mock('@/features/operations/stores/applicationOperationStore', () => ({
  useApplicationOperationStore: () => ({
    operations: {},
    targets: {},
    track: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { t: (key: string) => key } },
}))

describe('extractPackPath 从拖放文件列表提取整合包', () => {
  const file = (path: string) => ({ path }) as unknown as File

  it('识别 .zip / .mrpack 路径', () => {
    expect(extractPackPath([file('D:/packs/My.zip')])).toBe('D:/packs/My.zip')
    expect(extractPackPath([file('/packs/Curse.zip')])).toBe('/packs/Curse.zip')
    expect(extractPackPath([file('C:/packs/Mr.mrpack')])).toBe('C:/packs/Mr.mrpack')
  })

  it('无 path 字段的 File 被忽略', () => {
    expect(extractPackPath([file(''), new File([], 'x.jar')])).toBeUndefined()
  })

  it('非整合包文件返回 undefined', () => {
    expect(extractPackPath([file('mods/sodium.jar')])).toBeUndefined()
  })

  it('空列表 / undefined 返回 undefined', () => {
    expect(extractPackPath([])).toBeUndefined()
    expect(extractPackPath(undefined)).toBeUndefined()
  })
})

describe('derivePackName 从整合包文件路径推导实例名', () => {
  it('去除目录前缀与 .zip/.mrpack 后缀', () => {
    expect(derivePackName('D:\\Modpacks\\My Pack.zip')).toBe('My Pack')
    expect(derivePackName('/home/user/packs/SkyBlock.mrpack')).toBe('SkyBlock')
  })

  it('大小写不敏感识别后缀', () => {
    expect(derivePackName('packs/Modern.ZIP')).toBe('Modern')
    expect(derivePackName('packs/Craft.MRPACK')).toBe('Craft')
  })

  it('清理非法文件名字符', () => {
    expect(derivePackName('packs/My:Pack*?.zip')).toBe('My Pack')
  })

  it('空路径返回空串', () => {
    expect(derivePackName('')).toBe('')
    expect(derivePackName('   ')).toBe('')
  })

  it('非整合包后缀不剥离', () => {
    expect(derivePackName('packs/backup.tar.gz')).toBe('backup.tar.gz')
  })
})

describe('installOnlineInBackground 在线整合包一键后台安装', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const target = { source: 'modrinth' as const, projectId: 'p1', fileId: 'f1', title: 'Test Pack' }

  it('准备就绪后提交安装成功，返回 operationId', async () => {
    vi.mocked(modpackApi.prepare).mockResolvedValue({
      preparationId: 'prep-1',
      operationId: 'op-prep',
    } as never)
    vi.mocked(modpackApi.get).mockResolvedValue({ status: 'ready', preview: { files: [] } } as never)
    vi.mocked(modpackApi.install).mockResolvedValue({ operationId: 'op-install' } as never)

    const store = useModpackImportStore()
    const result = await store.installOnlineInBackground(target)

    expect(result.ok).toBe(true)
    expect(result.operationId).toBe('op-install')
    expect(modpackApi.prepare).toHaveBeenCalledWith({ source: 'modrinth', project_id: 'p1', file_id: 'f1' })
    expect(modpackApi.install).toHaveBeenCalledWith('prep-1', 'D:/default', 'Test Pack', [])
  })

  it('准备阶段抛出异常时返回失败', async () => {
    vi.mocked(modpackApi.prepare).mockRejectedValue(new Error('boom'))

    const store = useModpackImportStore()
    const result = await store.installOnlineInBackground(target)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
    expect(modpackApi.install).not.toHaveBeenCalled()
  })

  it('预览就绪判定为失败（status=failed）时返回失败', async () => {
    vi.mocked(modpackApi.prepare).mockResolvedValue({
      preparationId: 'prep-1',
      operationId: 'op-prep',
    } as never)
    vi.mocked(modpackApi.get).mockResolvedValue({ status: 'failed' } as never)

    const store = useModpackImportStore()
    const result = await store.installOnlineInBackground(target)

    expect(result.ok).toBe(false)
    expect(modpackApi.install).not.toHaveBeenCalled()
  })

  it('未配置默认游戏目录时返回失败', async () => {
    settingsState.lastInstallPath = ''

    const store = useModpackImportStore()
    const result = await store.installOnlineInBackground(target)

    expect(result.ok).toBe(false)
    expect(modpackApi.prepare).not.toHaveBeenCalled()
  })
})
