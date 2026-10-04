import { flushPromises, mount } from '@vue/test-utils'
import { NInput } from 'naive-ui'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { i18n } from '@/i18n'
import type { ScannedVersion } from '@/types/instances'
import InstanceDetailProfileTab from './InstanceDetailProfileTab.vue'

const mocks = vi.hoisted(() => ({ patch: vi.fn(), categories: vi.fn().mockResolvedValue([]), error: vi.fn() }))
vi.mock('@/features/instances/api/instanceProfileApi', () => ({
  instanceProfileApi: mocks,
  targetFromVersion: (version: ScannedVersion) => ({ gamePath: version.path, versionId: version.versionId }),
}))
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => ({ error: mocks.error }) }))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.useRealTimers()
})

describe('实例资料快照保存', () => {
  it('A 保存期间修改 B 并卸载，确认只对应 A，B 仍提交且不会变成已保存', async () => {
    vi.useFakeTimers()
    let finishA!: () => void
    let failB!: (error: Error) => void
    mocks.patch
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            failB = reject
          })
      )
    const version = { path: 'profile-race-root', versionId: 'profile-race', displayName: 'initial' } as ScannedVersion
    const make = () => {
      const wrapper = mount(InstanceDetailProfileTab, {
        props: { version, visible: true },
        global: { plugins: [i18n] },
      })
      wrappers.push(wrapper)
      return wrapper
    }
    const wrapper = make()
    await flushPromises()
    wrapper.findAllComponents(NInput)[0]!.vm.$emit('update:value', 'A')
    await nextTick()
    vi.advanceTimersByTime(301)
    await flushPromises()
    wrapper.findAllComponents(NInput)[0]!.vm.$emit('update:value', 'B')
    await nextTick()
    wrapper.unmount()
    finishA()
    await flushPromises()
    expect(version.displayName).toBe('A')
    expect(mocks.patch.mock.calls.map((call) => call[1].alias)).toEqual(['A', 'B'])
    const reopened = make()
    await flushPromises()
    expect(reopened.findAllComponents(NInput)[0]!.props('value')).toBe('B')
    failB(new Error('cannot save B'))
    await flushPromises()
    expect(version.displayName).toBe('A')
    expect(mocks.error).toHaveBeenCalledWith('cannot save B')
    // 清理时重试成功，避免失败草稿影响其他测试。
    mocks.patch.mockResolvedValue(undefined)
  })
})
