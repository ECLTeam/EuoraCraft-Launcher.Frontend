import { afterEach, describe, expect, it, vi } from 'vitest'
import { getErrorMessage } from './error'
import { errorCodeMessageKeys, isBareErrorCode, resolveDisplayMessage, setErrorCodeResolver } from './errorCodeMessages'

afterEach(() => {
  setErrorCodeResolver(null)
  vi.restoreAllMocks()
})

describe('错误码识别', () => {
  it('把全大写加下划线的后端码识别为错误码', () => {
    expect(isBareErrorCode('PLUGIN_INSTALL_FAILED')).toBe(true)
    expect(isBareErrorCode('INVALID_REQUEST')).toBe(true)
  })

  it('不把普通词语和数字当成错误码', () => {
    expect(isBareErrorCode('OK')).toBe(false)
    expect(isBareErrorCode('404')).toBe(false)
    expect(isBareErrorCode('插件安装失败')).toBe(false)
  })
})

describe('错误提示解析', () => {
  it('本来就可读的说明原样返回', () => {
    expect(resolveDisplayMessage('插件依赖未满足：ECL-Plugin-QomicexCompatible', '安装插件失败')).toBe(
      '插件依赖未满足：ECL-Plugin-QomicexCompatible'
    )
  })

  it('已登记的错误码换成对应文案', () => {
    setErrorCodeResolver((code) => (code === 'PLUGIN_INSTALL_FAILED' ? '插件安装未完成' : null))
    expect(resolveDisplayMessage('PLUGIN_INSTALL_FAILED', '安装插件失败')).toBe('插件安装未完成')
  })

  it('未登记的错误码回退到业务说明并留下诊断记录', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setErrorCodeResolver(() => null)
    expect(resolveDisplayMessage('SOME_UNKNOWN_CODE', '安装插件失败')).toBe('安装插件失败')
    expect(warn).toHaveBeenCalledWith('[error] 未登记的错误码：SOME_UNKNOWN_CODE')
  })

  it('没有说明时使用调用方兜底，不返回错误码', () => {
    setErrorCodeResolver(() => null)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(resolveDisplayMessage('PLUGIN_RELOAD_FAILED', '重载插件失败')).toBe('重载插件失败')
    expect(resolveDisplayMessage('', '重载插件失败')).toBe('重载插件失败')
  })

  it('getErrorMessage 不会把错误码当成提示', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setErrorCodeResolver(() => null)
    expect(getErrorMessage(new Error('PLUGIN_UNLOAD_FAILED'), '卸载插件失败')).toBe('卸载插件失败')
    expect(getErrorMessage({ message: 'PLUGIN_INSTALL_FAILED' }, '安装插件失败')).toBe('安装插件失败')
  })

  it('先查通用码表再查插件页历史位置', () => {
    expect(errorCodeMessageKeys('PLUGIN_X_Y')).toEqual(['error.codes.PLUGIN_X_Y', 'plugins.errors.PLUGIN_X_Y'])
  })
})
