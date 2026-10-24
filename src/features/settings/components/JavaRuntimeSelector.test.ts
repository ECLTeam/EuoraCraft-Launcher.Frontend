import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { i18n } from '@/i18n'
import { javaRuntime } from '@/test/javaFixtures'
import type { JavaRuntime } from '@/types/java'
import JavaRuntimeSelector from './JavaRuntimeSelector.vue'
const mocks = vi.hoisted(() => ({ scan: vi.fn(), select: vi.fn() }))
const runtimes = reactive<JavaRuntime[]>([])
vi.mock('@/features/java/stores/javaRuntimeStore', () => ({
  useJavaRuntimeStore: () => ({
    get runtimes() {
      return runtimes
    },
    isLoading: false,
    load: mocks.scan,
  }),
}))
vi.mock('@/features/java/api/javaApi', () => ({ javaApi: { select: mocks.select } }))
enableAutoUnmount(afterEach)
function mountSelector(props = {}) {
  return mount(JavaRuntimeSelector, { props, global: { plugins: [i18n], stubs: { JavaManagerModal: true } } })
}
describe('JavaRuntimeSelector', () => {
  beforeEach(() => {
    mocks.scan.mockReset().mockResolvedValue(undefined)
    mocks.select.mockReset().mockImplementation(async (runtime) => runtime)
    runtimes.splice(
      0,
      runtimes.length,
      javaRuntime({ vendor: 'Microsoft', runtimeKind: 'JDK' }),
      javaRuntime({ executablePath: 'C:/Disabled/java.exe', isEnabled: false }),
      javaRuntime({ executablePath: 'C:/Broken/java.exe', validationStatus: 'invalid' })
    )
    i18n.global.locale.value = 'zh-CN'
  })
  it('only offers enabled validated registered Java and does not inject an unknown configured path', async () => {
    const wrapper = mountSelector({ value: 'D:/Unknown/java.exe' })
    await flushPromises()
    const options = wrapper.getComponent(NSelect).props('options')
    expect(options).toHaveLength(1)
    expect(options?.[0]).toMatchObject({ value: 'C:/Java/bin/java.exe', label: expect.stringContaining('Microsoft') })
    expect(wrapper.text()).not.toContain('浏览')
    expect(wrapper.get('[role="alert"]').text()).toContain('D:/Unknown/java.exe')
    expect(wrapper.getComponent(NSelect).props('value')).toBe('D:/Unknown/java.exe')
    expect(mocks.scan).toHaveBeenCalledWith(false)
  })
  it('validates the chosen runtime with the instance context before emitting', async () => {
    const wrapper = mountSelector({ requiredMajor: 21, gamePath: 'C:/Game', versionId: 'A' })
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'C:/Java/bin/java.exe')
    await flushPromises()
    expect(mocks.select).toHaveBeenCalledWith(expect.objectContaining({ executablePath: 'C:/Java/bin/java.exe' }), 21, {
      gamePath: 'C:/Game',
      versionId: 'A',
    })
    expect(wrapper.emitted('update:value')).toEqual([['C:/Java/bin/java.exe']])
  })
  it('rejects duplicate selection and ignores validation from an old target', async () => {
    let resolve!: (runtime: JavaRuntime) => void
    mocks.select.mockReturnValue(
      new Promise<JavaRuntime>((done) => {
        resolve = done
      })
    )
    const wrapper = mountSelector({ contextKey: 'A' })
    const select = wrapper.getComponent(NSelect)
    select.vm.$emit('update:value', 'C:/Java/bin/java.exe')
    select.vm.$emit('update:value', 'C:/Java/bin/java.exe')
    expect(mocks.select).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ contextKey: 'B' })
    resolve(javaRuntime())
    await flushPromises()
    expect(wrapper.emitted('update:value')).toBeUndefined()
    expect(select.props('disabled')).toBe(false)
  })
  it('keeps the old value when validation fails, and allows retry', async () => {
    mocks.select.mockRejectedValueOnce(new Error('Java 无法运行'))
    const wrapper = mountSelector({ value: 'C:/Previous/java.exe' })
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'C:/Java/bin/java.exe')
    await flushPromises()
    expect(wrapper.emitted('update:value')).toBeUndefined()
    expect(wrapper.text()).toContain('Java 无法运行')
    wrapper.getComponent(NSelect).vm.$emit('update:value', 'C:/Java/bin/java.exe')
    await flushPromises()
    expect(wrapper.emitted('update:value')).toEqual([['C:/Java/bin/java.exe']])
  })
  it('allows clearing only for an inheritable instance setting', async () => {
    const wrapper = mountSelector({ inheritedValue: 'C:/Java/bin/java.exe' })
    expect(wrapper.getComponent(NSelect).props('clearable')).toBe(true)
    wrapper.getComponent(NSelect).vm.$emit('update:value', null)
    expect(wrapper.emitted('update:value')).toEqual([['']])
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it('shows empty and refresh failure states with a management entry', async () => {
    runtimes.splice(0)
    const wrapper = mountSelector()
    await flushPromises()
    expect(wrapper.text()).toContain('暂无可用 Java')
    expect(wrapper.text()).toContain('管理')
    mocks.scan.mockRejectedValueOnce(new Error('读取失败'))
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('刷新'))!
      .trigger('click')
    await flushPromises()
    expect(mocks.scan).toHaveBeenLastCalledWith(true)
    expect(wrapper.text()).toContain('读取失败')
  })
})
