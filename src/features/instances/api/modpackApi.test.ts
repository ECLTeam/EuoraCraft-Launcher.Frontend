import { beforeEach, describe, expect, it, vi } from 'vitest'
import { modpackApi, parseModpackResult } from './modpackApi'

const mocks = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { command: mocks.command } }))

beforeEach(() => mocks.command.mockReset())

describe('整合包接口输入边界', () => {
  it('拒绝其他预览的响应以及不完整的文件数据', async () => {
    mocks.command.mockResolvedValue({
      success: true,
      data: { preparationId: 'other', status: 'ready', expiresAt: 123, cleanupPending: false },
    })
    await expect(modpackApi.get('current')).rejects.toThrow()
    mocks.command.mockResolvedValue({
      success: true,
      data: {
        preparationId: 'current',
        status: 'ready',
        expiresAt: 123,
        cleanupPending: false,
        preview: { files: [{ fileId: 'file', path: 'mod.jar', size: -1, requirement: 'optional' }] },
      },
    })
    await expect(modpackApi.get('current')).rejects.toThrow()
  })

  it('任务缺少完整结果或包含负数时不能展示安装成功摘要', () => {
    const result = {
      versionId: 'Pack',
      format: 'mrpack',
      downloadedFiles: 1,
      excludedOptionalFiles: 2,
      unsupportedFiles: 1,
      overridesFiles: 0,
      baseVersion: '1.21.1',
      warnings: [],
    }
    expect(parseModpackResult({ versionId: 'Pack' })).toBeNull()
    expect(parseModpackResult({ ...result, downloadedFiles: -1 })).toBeNull()
    expect(parseModpackResult(result)).toEqual(result)
  })

  it('完整传递显式排除集合，服务拒绝时保留失败', async () => {
    mocks.command.mockResolvedValue({ success: false, message: 'Target exists' })
    await expect(modpackApi.install('current', 'D:/Game', 'Pack', ['optional'])).rejects.toThrow('Target exists')
    expect(mocks.command).toHaveBeenCalledWith('game_modpack_install', {
      preparation_id: 'current',
      game_path: 'D:/Game',
      new_version_id: 'Pack',
      excluded_file_ids: ['optional'],
    })
  })
})
