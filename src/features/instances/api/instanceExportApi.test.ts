import { describe, expect, it } from 'vitest'
import { parseExportPreview, parseExportResult, suggestedExportName } from './instanceExportApi'

const file = { fileId: '1'.repeat(64), path: 'mods/a.jar', size: 12, category: 'mods', recommended: true }
const preview = {
  sourceRevision: 'a'.repeat(64),
  versionId: 'Demo',
  isolated: true,
  dependencies: { minecraft: '1.21.1' },
  files: [file],
  excludedCount: 0,
}

describe('实例导出边界', () => {
  it('只接受服务器定义的有界文件和有效依赖', () => {
    expect(parseExportPreview(preview).files).toEqual([file])
    for (const patch of [
      { size: -1 },
      { fileId: 'invalid' },
      { category: 'credentials' },
      { path: '../secret' },
      { path: 'C:/secret' },
      { path: 'mods\\secret' },
    ]) {
      expect(() => parseExportPreview({ ...preview, files: [{ ...file, ...patch }] })).toThrow()
    }
    expect(() => parseExportPreview({ ...preview, dependencies: {} })).toThrow()
    expect(() => parseExportPreview({ ...preview, files: [file, file] })).toThrow()
  })
  it('文件名去除路径与控制字符，结果只能是当前格式', () => {
    expect(suggestedExportName('a/b:c', '2.0')).toBe('a-b-c-2.0.mrpack')
    expect(suggestedExportName('', '')).toBe('modpack-1.0.0.mrpack')
    expect(
      parseExportResult({
        path: 'pack.mrpack',
        format: 'modrinth',
        onlineFiles: 1,
        packedFiles: 2,
        selectedBytes: 3,
        warnings: [],
      })?.packedFiles
    ).toBe(2)
    expect(parseExportResult({ format: 'zip' })).toBeNull()
  })
})
