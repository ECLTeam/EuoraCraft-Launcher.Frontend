import { describe, expect, it } from 'vitest'
import type { ScannedVersion } from '@/types/instances'
import { resolveInitialResourceTarget } from './useResourceInstallTarget'

const versions = [
  { path: 'D:/Game', versionId: '1.21.1', vanillaName: '1.21.1', primaryLoader: 'fabric' },
  { path: 'E:/Game', versionId: '1.20.1', vanillaName: '1.20.1', primaryLoader: 'forge' },
] as ScannedVersion[]

describe('下载资源默认安装目标', () => {
  it('已扫描实例不因旧健康标记被排除', () => {
    const version = Object.assign({ ...versions[0], versionId: '26.4-snapshot-3' } as ScannedVersion, {
      isBroken: true,
    })
    expect(resolveInitialResourceTarget([version], undefined, version.versionId, version.path)).toBe(version)
  })
  it('优先使用资源分类保存的目标，其次使用全局选中实例', () => {
    expect(
      resolveInitialResourceTarget(versions, { gamePath: 'E:/Game', versionId: '1.20.1' }, '1.21.1', 'D:/Game')
    ).toBe(versions[1])
    expect(resolveInitialResourceTarget(versions, undefined, '1.20.1', 'E:/Game')).toBe(versions[1])
  })

  it('尊重显式无实例，旧目标失效时回退首个可安装实例', () => {
    expect(resolveInitialResourceTarget(versions, { gamePath: '', versionId: '' }, '1.21.1', 'D:/Game')).toBeNull()
    expect(resolveInitialResourceTarget(versions, { gamePath: 'X:/Gone', versionId: 'old' }, '', '')).toBe(versions[0])
  })
})
