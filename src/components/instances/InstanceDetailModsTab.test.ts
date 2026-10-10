import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NSwitch } from 'naive-ui'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import { instanceWorkspaceApi } from '@/features/instances/api/instanceWorkspaceApi'
import { modApi } from '@/features/mods/api/modApi'
import { i18n } from '@/i18n'
import type { ScannedVersion } from '@/types/instances'
import type { ModItem } from '@/types/mods'
import InstanceDetailModsTab from './InstanceDetailModsTab.vue'

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  return createMockBackend().backend
})
const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useLauncherMessage', () => ({ useLauncherMessage: () => messages }))

const version: ScannedVersion = {
  id: '1.21.1',
  versionId: '1.21.1',
  versionType: 'release',
  path: 'D:/Games/.minecraft',
  displayName: '1.21.1',
  primaryLoader: 'Fabric',
  vanillaName: '1.21.1',
  hasForge: false,
  hasNeoForge: false,
  hasFabric: true,
  hasQuilt: false,
  jsonPath: 'D:/Games/.minecraft/versions/1.21.1/1.21.1.json',
}
const target = { game_path: version.path, version_id: version.versionId }

function modItem(filename = 'sample.jar', enabled = true): ModItem {
  return {
    filename,
    enabled,
    name: 'Sample Mod',
    display_name: '测试模组',
    english_name: 'Sample Mod',
    mcmod_url: '',
    version: '1.0',
    author: 'ECLTeam',
    loader_type: 'Fabric',
    game_version: '1.21.1',
    project_id: '',
    dependencies: [],
    size: 10,
    icon_data: '',
    modified_at: '',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

let wrapper: VueWrapper
async function mountTab() {
  wrapper = mount(InstanceDetailModsTab, {
    props: { version },
    global: { plugins: [createPinia(), i18n], stubs: { Teleport: true, ConfirmDialog: true } },
  })
  await flushPromises()
  return wrapper
}

async function toggle() {
  wrapper.getComponent(NSwitch).vm.$emit('update:value', !wrapper.getComponent(NSwitch).props('value'))
  await flushPromises()
}

describe('实例模组文件名与启用状态', () => {
  it('来源未知时按名称搜索，不把加载器 ID 当作 Modrinth 项目', async () => {
    vi.mocked(instanceWorkspaceApi.mods).mockResolvedValue([{ ...modItem(), project_id: 'loader-only-id' }])
    const open = vi.spyOn(modApi, 'openUrl').mockResolvedValue(undefined)
    await mountTab()
    await wrapper.get('.btn-action:not(.btn-delete)').trigger('click')
    await flushPromises()
    expect(open).not.toHaveBeenCalled()
    expect(wrapper.emitted('openOnlineSearch')).toEqual([[{ type: 'mod', worldId: null, query: 'Sample Mod' }]])
  })

  it('确认来源后使用平台项目 ID，并呈现禁用依赖诊断', async () => {
    vi.mocked(instanceWorkspaceApi.mods).mockResolvedValue([
      {
        ...modItem(),
        project_id: 'loader-id',
        source: 'modrinth',
        source_project_id: 'actual-project',
        diagnostics: [{ code: 'disabled_provider', modId: 'api', severity: 'error', providers: ['api.jar.disabled'] }],
      },
    ])
    const open = vi.spyOn(modApi, 'openUrl').mockResolvedValue(undefined)
    await mountTab()
    expect(wrapper.text()).toContain('已安装但被禁用：api')
    await wrapper.get('.btn-action:not(.btn-delete)').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalledWith('https://modrinth.com/mod/actual-project')
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(instanceWorkspaceApi, 'mods').mockResolvedValue([modItem()])
    vi.spyOn(instanceWorkspaceApi, 'removeMod').mockResolvedValue(undefined)
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
  })

  it('连续禁用、启用、再禁用使用当前真实文件名且不重新加载列表', async () => {
    const request = vi
      .spyOn(instanceWorkspaceApi, 'toggleMod')
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: true })
      .mockResolvedValueOnce({ enabled: false })
    await mountTab()

    await toggle()
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar.disabled')
    expect(wrapper.getComponent(NSwitch).props('value')).toBe(false)
    await toggle()
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar')
    expect(wrapper.getComponent(NSwitch).props('value')).toBe(true)
    await toggle()
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar.disabled')
    expect(request.mock.calls).toEqual([
      [target, 'sample.jar'],
      [target, 'sample.jar.disabled'],
      [target, 'sample.jar'],
    ])
    expect(instanceWorkspaceApi.mods).toHaveBeenCalledTimes(4)
  })

  it('启用初始禁用文件只去除末尾的后缀', async () => {
    vi.mocked(instanceWorkspaceApi.mods).mockResolvedValue([modItem('sample.disabled.jar.disabled', false)])
    const request = vi.spyOn(instanceWorkspaceApi, 'toggleMod').mockResolvedValue({ enabled: true })
    await mountTab()
    await toggle()

    expect(request).toHaveBeenCalledWith(target, 'sample.disabled.jar.disabled')
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.disabled.jar')
    expect(wrapper.getComponent(NSwitch).props('value')).toBe(true)
  })

  it('禁用后删除提交禁用文件名并移除对应条目', async () => {
    vi.spyOn(instanceWorkspaceApi, 'toggleMod').mockResolvedValue({ enabled: false })
    await mountTab()
    await toggle()
    await wrapper.get('.btn-delete').trigger('click')
    wrapper.getComponent(ConfirmDialog).vm.$emit('confirm')
    await flushPromises()

    expect(instanceWorkspaceApi.removeMod).toHaveBeenCalledWith(target, 'sample.jar.disabled')
    expect(wrapper.find('.mod-list-row').exists()).toBe(false)
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('请求期间锁定当前模组且重复事件只提交一次，失败后保留状态并恢复操作', async () => {
    const pending = deferred<{ enabled: boolean }>()
    const request = vi.spyOn(instanceWorkspaceApi, 'toggleMod').mockReturnValueOnce(pending.promise)
    await mountTab()
    await toggle()

    expect(wrapper.getComponent(NSwitch).props('disabled')).toBe(true)
    expect(wrapper.get('.btn-delete').attributes('disabled')).toBeDefined()
    await toggle()
    expect(request).toHaveBeenCalledTimes(1)
    pending.reject(new Error('切换失败'))
    await flushPromises()
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar')
    expect(wrapper.getComponent(NSwitch).props('value')).toBe(true)
    expect(wrapper.getComponent(NSwitch).props('disabled')).toBe(false)
    expect(wrapper.get('.btn-delete').attributes('disabled')).toBeUndefined()
    expect(messages.error).toHaveBeenCalledWith('切换失败')

    request.mockResolvedValueOnce({ enabled: false })
    await toggle()
    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar.disabled')
  })

  it('一个模组切换期间其他模组仍可操作', async () => {
    vi.mocked(instanceWorkspaceApi.mods).mockResolvedValue([modItem(), modItem('other.jar')])
    const pending = deferred<{ enabled: boolean }>()
    vi.spyOn(instanceWorkspaceApi, 'toggleMod')
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ enabled: false })
    await mountTab()
    await toggle()

    const other = wrapper.findAllComponents(NSwitch)[1]!
    expect(other.props('disabled')).toBe(false)
    other.vm.$emit('update:value', false)
    await flushPromises()
    expect(wrapper.findAll('.mod-list-filename').map((entry) => entry.text())).toEqual([
      'sample.jar',
      'other.jar.disabled',
    ])
    pending.resolve({ enabled: false })
    await flushPromises()
    expect(wrapper.findAllComponents(NSwitch).every((entry) => !entry.props('disabled'))).toBe(true)
  })

  it('启用与禁用筛选立即更新并保留搜索文字', async () => {
    vi.spyOn(instanceWorkspaceApi, 'toggleMod')
      .mockResolvedValueOnce({ enabled: false })
      .mockResolvedValueOnce({ enabled: true })
    await mountTab()
    await wrapper.get('input').setValue('测试模组')
    await wrapper.findAll('.mods-filter-btn')[1]!.trigger('click')
    await toggle()
    expect(wrapper.find('.mod-list-row').exists()).toBe(false)
    await wrapper.findAll('.mods-filter-btn')[2]!.trigger('click')
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar.disabled')
    await toggle()
    expect(wrapper.find('.mod-list-row').exists()).toBe(false)
    await wrapper.findAll('.mods-filter-btn')[1]!.trigger('click')
    expect(wrapper.get('.mod-list-filename').text()).toBe('sample.jar')
    expect(wrapper.get('input').element.value).toBe('测试模组')
  })
})
