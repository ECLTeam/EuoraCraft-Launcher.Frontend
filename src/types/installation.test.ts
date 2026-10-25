import { expect, it } from 'vitest'
import { installationPercentage, parseInstallation } from './installation'
import { installationFixture } from './installation.fixture'

it('字节百分比不被文件数覆盖，总量未知时没有虚假百分比', () => {
  const installation = installationFixture()
  expect(installationPercentage(installation)).toBe(60)
  installation.stages[1]!.progress = { unit: 'unknown', completed: 60, total: null }
  expect(installationPercentage(installation)).toBeNull()
})

it.each([NaN, Infinity, -1, 1.5])('拒绝无效进度值 %s', (value) => {
  const installation = installationFixture()
  installation.stages[1]!.progress.completed = value
  expect(parseInstallation(installation)).toBeNull()
})

it('拒绝重复阶段和不存在的活动阶段', () => {
  const installation = installationFixture()
  installation.stages.push(installation.stages[0]!)
  expect(parseInstallation(installation)).toBeNull()
  expect(parseInstallation({ ...installationFixture(), currentStageId: 'install_loader' })).toBeNull()
})
