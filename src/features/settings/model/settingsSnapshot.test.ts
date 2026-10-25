import { describe, expect, it } from 'vitest'
import { parseSettingsSnapshot } from './settingsSnapshot'

describe('调试工具配置输入', () => {
  it('接受缺省或合法显示偏好，保留同分区其他值', () => {
    expect(parseSettingsSnapshot({}).ui.debugTools).toBeUndefined()
    const ui = { locale: 'en-US', debugTools: { visible: false, minimizedShape: 'circle' } }
    expect(parseSettingsSnapshot({ ui }).ui).toEqual(ui)
  })

  it.each([{ visible: 'false' }, { minimizedShape: 'square' }, { minimizedShape: null }, []].map((value) => [value]))(
    '拒绝非法偏好 %j',
    (debugTools) => {
      expect(() => parseSettingsSnapshot({ ui: { debugTools } })).toThrow()
    }
  )
})
