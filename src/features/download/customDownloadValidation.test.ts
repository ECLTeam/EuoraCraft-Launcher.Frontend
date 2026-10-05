import { describe, expect, it } from 'vitest'
import { downloadValidationKey, isValidDownloadFilename } from './customDownloadValidation'
import filenameCases from './fixtures/downloadFilenameCases.json'

describe('跨平台下载文件名', () => {
  it.each(filenameCases)('前后端共同样本：$name', ({ name, valid }) =>
    expect(isValidDownloadFilename(name)).toBe(valid)
  )
  it.each([
    'CON .txt',
    'CON.txt',
    'lpt² .zip',
    'COM9',
    'CONOUT$.txt',
    '../x',
    'file.',
    'file ',
    'a\x7fb',
    '皮'.repeat(86),
  ])('拒绝 %s', (name) => expect(isValidDownloadFilename(name)).toBe(false))
  it.each(['archive.zip', 'CONtext.txt', '精确名称', '皮'.repeat(85)])('允许 %s', (name) =>
    expect(isValidDownloadFilename(name)).toBe(true)
  )
  it('拒绝重复、控制字符、非 ASCII 请求头值和 UA 冲突', () => {
    const options = {
      namingMode: 'original' as const,
      customName: '',
      userAgent: '',
      headerRows: [
        { id: 0, name: 'X-Test', value: 'a' },
        { id: 1, name: 'x-test', value: 'b' },
      ],
    }
    expect(downloadValidationKey(options)).toBe('advanced.downloadInvalidHeaders')
    expect(downloadValidationKey({ ...options, headerRows: [{ id: 0, name: 'User-Agent', value: 'a' }] })).toBe(
      'advanced.downloadUaHeader'
    )
    expect(downloadValidationKey({ ...options, headerRows: [], userAgent: '中文' })).toBe(
      'advanced.downloadInvalidHeaders'
    )
  })
})
