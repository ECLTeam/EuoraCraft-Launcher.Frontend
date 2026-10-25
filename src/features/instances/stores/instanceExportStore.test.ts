import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import type { InstanceExportPreview } from '@/types/instanceExport'
import type { InstanceTargetPayload } from '@/types/instances'
import type { ApplicationOperation } from '@/types/operations'
import { useInstanceExportStore } from './instanceExportStore'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), chooseOutput: vi.fn(), export: vi.fn() }))
vi.mock('@/features/instances/api/instanceExportApi', async (original) => ({
  ...(await original<typeof import('@/features/instances/api/instanceExportApi')>()),
  instanceExportApi: mocks,
}))
vi.mock('@/features/operations/stores/applicationOperationStore', () => ({
  useApplicationOperationStore: () => operations,
}))
const previewId = 'a'.repeat(32)
const exportId = 'b'.repeat(32)
const firstFile = '1'.repeat(64)
const secondFile = '2'.repeat(64)
const source = { game_path: '/game', version_id: 'Demo' }
const results = new Map<string, InstanceExportPreview>()
const operations = reactive({
  operations: {} as Record<string, ApplicationOperation>,
  targets: {} as Record<string, InstanceTargetPayload>,
  queryErrors: {} as Record<string, string>,
  cancellingOperations: [] as string[],
  track: vi.fn(),
  cancel: vi.fn(),
})
function makePreview(versionId = 'Demo'): InstanceExportPreview {
  return {
    sourceRevision: 'c'.repeat(64),
    versionId,
    isolated: true,
    dependencies: { minecraft: '1.21.1' },
    excludedCount: 0,
    files: [
      { fileId: firstFile, path: 'mods/a.jar', size: 100, category: 'mods', recommended: true },
      { fileId: secondFile, path: 'saves/World/level.dat', size: 200, category: 'saves', recommended: false },
    ],
  }
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  operations.operations = {}
  operations.targets = {}
  results.clear()
  results.set(previewId, makePreview())
  mocks.preview.mockResolvedValue({ operationId: previewId })
  mocks.chooseOutput.mockResolvedValue('/output/pack.mrpack')
  mocks.export.mockResolvedValue({ operationId: exportId })
  operations.cancel.mockResolvedValue(true)
  operations.track.mockImplementation(async (operation: ApplicationOperation) => {
    operations.operations[operation.operationId] =
      operation.kind === 'instance_export_preview'
        ? { ...operation, status: 'completed', result: results.get(operation.operationId) }
        : operation
  })
})

describe('实例导出流程', () => {
  it('推荐选择排除个人内容，搜索不改变选择，空选择仍可提交依赖', async () => {
    const store = useInstanceExportStore()
    await store.open(source, 'Demo Pack')
    await flushPromises()
    expect(store.selectedFileIds).toEqual([firstFile])
    store.search = 'World'
    expect(store.selectedFileIds).toEqual([firstFile])
    store.selectCategory('saves', true)
    expect(store.hasPersonalFiles).toBe(true)
    expect(store.selectedBytes).toBe(300)
    store.setSelection(['directory:mods', 'untrusted', secondFile])
    expect(store.selectedFileIds).toEqual([secondFile])
    store.selectAll('none')
    expect(store.canExport).toBe(true)
    store.resourceMode = 'bundled'
    await store.submit()
    expect(mocks.export).toHaveBeenCalledWith(
      expect.objectContaining({ selected_file_ids: [], resource_mode: 'bundled', pack_version: '1.0.0' })
    )
  })
  it('原生保存期间阻止重复提交，卸载后迟到路径不能创建任务', async () => {
    let finish!: (path: string) => void
    mocks.chooseOutput.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const store = useInstanceExportStore()
    await store.open(source, 'Demo')
    await flushPromises()
    const first = store.submit()
    await store.submit()
    store.close()
    expect(store.visible).toBe(true)
    expect(mocks.chooseOutput).toHaveBeenCalledOnce()
    store.detach()
    finish('/old-output.mrpack')
    await first
    expect(mocks.export).not.toHaveBeenCalled()
    expect(store.visible).toBe(false)
  })
  it('关闭已提交导出不取消任务，再次打开同实例恢复操作', async () => {
    const store = useInstanceExportStore()
    await store.open(source, 'Demo')
    await flushPromises()
    await store.submit()
    store.close()
    await flushPromises()
    expect(operations.cancel).not.toHaveBeenCalledWith(exportId)
    await store.open(source, 'Demo')
    expect(store.exportOperationId).toBe(exportId)
    expect(store.isExporting).toBe(true)
  })
  it('切换目标后，旧预览响应不会覆盖当前文件选择', async () => {
    let finish!: (operation: { operationId: string }) => void
    mocks.preview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const newId = 'd'.repeat(32)
    results.set(newId, makePreview('Other'))
    mocks.preview.mockResolvedValueOnce({ operationId: newId })
    const store = useInstanceExportStore()
    const first = store.open(source, 'Demo')
    await store.open({ ...source, version_id: 'Other' }, 'Other')
    await flushPromises()
    finish({ operationId: previewId })
    await first
    await flushPromises()
    expect(store.preview?.versionId).toBe('Other')
    expect(operations.cancel).toHaveBeenCalledWith(previewId)
  })
})
