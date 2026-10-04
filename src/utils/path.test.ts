import { describe, expect, it } from 'vitest'
import { gamePathIdentity, normalizeGamePath, registerGamePathIdentity } from './path'

describe('游戏目录身份', () => {
  it('保留大小写敏感目录和路径根', () => {
    expect(normalizeGamePath('/games/Pack')).not.toBe(normalizeGamePath('/games/pack'))
    expect(normalizeGamePath('/')).toBe('/')
    expect(normalizeGamePath('C:\\')).toBe('C:/')
    expect(normalizeGamePath('\\\\server\\share\\')).toBe('//server/share')
  })
  it('服务端确认的别名采用相同根目录身份', () => {
    registerGamePathIdentity('D:/Games', 'D:\\Games')
    registerGamePathIdentity('d:/games', 'D:\\Games')
    expect(gamePathIdentity('D:/Games')).toBe(gamePathIdentity('d:/games'))
  })
})
