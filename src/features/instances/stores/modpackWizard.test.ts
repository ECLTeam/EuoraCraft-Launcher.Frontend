import { flushPromises } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pinia } from '@/app/stores'
import { useTaskQueueStore } from '@/composables/useTaskQueue'
import type * as ModpackApiModule from '@/features/instances/api/modpackApi'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import type { ModpackPreparation } from '@/types/modpack'
import { useModpackImportStore } from './modpackImportStore'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), get: vi.fn(), release: vi.fn(), install: vi.fn() }))
vi.mock('@/features/instances/api/modpackApi', async (original) => ({
  ...(await original<typeof ModpackApiModule>()),
  modpackApi: mocks,
}))
vi.mock('@/features/settings/stores/settingsStore', () => ({
  useSettingsStore: () => ({ status: 'ready', game: { minecraft_paths: [{ path: 'D:/Game', name: 'Game' }] } }),
}))

const fixture: ModpackPreparation = {
  preparationId: 'preview',
  status: 'ready',
  expiresAt: 9999999999,
  cleanupPending: false,
  preview: {
    name: 'Pack',
    format: 'mrpack',
    source: 'local',
    summary: '',
    minecraftVersion: '1.21.1',
    loader: 'fabric',
    loaderVersion: '0.16',
    warnings: [],
    files: [
      { fileId: 'required', path: 'mods/required.jar', size: 100, requirement: 'required' },
      { fileId: 'optional-a', path: 'mods/a.jar', size: 200, requirement: 'optional' },
      { fileId: 'optional-b', path: 'resourcepacks/b.zip', size: null, requirement: 'optional' },
      { fileId: 'server', path: 'mods/server.jar', size: 300, requirement: 'unsupported' },
    ],
  },
}

beforeEach(() => {
  setActivePinia(pinia)
  vi.restoreAllMocks()
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.prepare.mockResolvedValue({ preparationId: 'preview', operationId: 'prepare' })
  mocks.get.mockResolvedValue(structuredClone(fixture))
  mocks.release.mockResolvedValue(undefined)
  mocks.install.mockResolvedValue({ operationId: 'install' })
  const operations = useApplicationOperationStore()
  operations.stop()
  operations.operations = {}
  operations.queryErrors = {}
  useTaskQueueStore(pinia).tasks = []
  vi.spyOn(operations, 'track').mockResolvedValue(undefined)
  useModpackImportStore().close()
})
afterEach(() => {
  useModpackImportStore().close()
  useApplicationOperationStore().stop()
})

async function ready() {
  const store = useModpackImportStore()
  await store.open({ sourcePath: 'D:/Pack.mrpack' })
  await store.prepare()
  useApplicationOperationStore().accept({ operationId: 'prepare', status: 'completed', kind: 'modpack_prepare' })
  await flushPromises()
  return store
}

describe('整合包安装向导', () => {
  it('默认选择全部可选文件，必需和不适用项不能改选；搜索保持选择', async () => {
    const store = await ready()
    expect(store.step).toBe('preview')
    expect(store.selectedFiles).toHaveLength(3)
    expect(store.knownBytes).toBe(300)
    expect(store.unknownSizeCount).toBe(1)
    store.selectFile('required', false)
    store.selectFile('server', false)
    expect(store.excludedFileIds).toEqual([])
    store.selectFile('optional-a', false)
    store.search = 'resourcepacks'
    expect(store.visibleOptionalFiles.map((file) => file.fileId)).toEqual(['optional-b'])
    expect(store.excludedFileIds).toEqual(['optional-a'])
    expect(store.knownBytes).toBe(100)
    store.selectAll(false)
    expect(store.selectedFiles.map((file) => file.fileId)).toEqual(['required'])
    store.selectAll(true)
    expect(store.excludedFileIds).toEqual([])
  })

  it('全无可选项跳过选择页；目录和实例名变更不重新解析', async () => {
    const fixtureWithoutOptional = structuredClone(fixture)
    fixtureWithoutOptional.preview!.files = fixtureWithoutOptional.preview!.files.filter(
      (file) => file.requirement !== 'optional'
    )
    mocks.get.mockResolvedValue(fixtureWithoutOptional)
    const store = await ready()
    expect(store.step).toBe('confirm')
    store.gamePath = 'D:/Other'
    store.versionName = 'Other'
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    expect(store.canImport).toBe(true)
  })

  it('关闭早于准备回执时释放迟到资源，不能重新打开旧预览', async () => {
    let resolve!: (value: { preparationId: string; operationId: string }) => void
    mocks.prepare.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const store = useModpackImportStore()
    await store.open({ sourcePath: 'D:/Old.mrpack' })
    const request = store.prepare()
    store.close()
    await store.open({ sourcePath: 'D:/New.mrpack' })
    resolve({ preparationId: 'old', operationId: 'old-operation' })
    await request
    expect(mocks.release).toHaveBeenCalledWith('old')
    expect(store.sourcePath).toBe('D:/New.mrpack')
    expect(store.preview).toBeNull()
    expect(store.step).toBe('source')
  })

  it('解析失败可以重试，保留目录和实例名，重试后重置选择', async () => {
    const store = await ready()
    store.versionName = 'Custom'
    store.gamePath = 'D:/Other'
    store.selectAll(false)
    store.backToSource()
    await store.prepare()
    expect(store.versionName).toBe('Custom')
    expect(store.gamePath).toBe('D:/Other')
    expect(store.excludedFileIds).toEqual([])
  })

  it('重复确认只提交一次，收起不取消安装，终态可重新查看', async () => {
    const store = await ready()
    store.selectFile('optional-b', false)
    store.step = 'confirm'
    let resolve!: (value: { operationId: string }) => void
    mocks.install.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const first = store.importPack()
    expect(await store.importPack()).toEqual({ ok: false })
    store.close()
    expect(store.visible).toBe(true)
    resolve({ operationId: 'install' })
    expect(await first).toEqual({ ok: true })
    expect(mocks.install).toHaveBeenCalledWith('preview', 'D:/Game', 'Pack', ['optional-b'])
    expect(store.step).toBe('installing')
    store.close()
    expect(store.visible).toBe(false)
    const operations = useApplicationOperationStore()
    operations.accept({
      operationId: 'install',
      kind: 'instance_import',
      status: 'completed',
      result: {
        versionId: 'Pack',
        format: 'mrpack',
        downloadedFiles: 2,
        excludedOptionalFiles: 1,
        unsupportedFiles: 1,
        overridesFiles: 0,
        baseVersion: '1.21.1',
        warnings: [],
      },
    })
    vi.spyOn(operations, 'refresh').mockResolvedValue(operations.operations.install!)
    await store.openResult('install')
    expect(store.step).toBe('result')
    expect(store.result?.excludedOptionalFiles).toBe(1)
    expect(mocks.install).toHaveBeenCalledTimes(1)
  })

  it('提交失败保留选择并恢复操作，不误报成功', async () => {
    const store = await ready()
    store.step = 'confirm'
    store.selectFile('optional-a', false)
    mocks.install.mockRejectedValue(new Error('Target exists'))
    expect((await store.importPack()).ok).toBe(false)
    expect(store.error).toBe('Target exists')
    expect(store.isSubmittingImport).toBe(false)
    expect(store.excludedFileIds).toEqual(['optional-a'])
    expect(store.step).toBe('confirm')
  })
})
