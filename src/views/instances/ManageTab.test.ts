import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { computed, defineComponent, reactive, ref, type PropType } from 'vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import { instanceWorkspaceApi } from '@/features/instances/api/instanceWorkspaceApi'
import { i18n } from '@/i18n'
import type { ScannedVersion } from '@/types/instances'
import ManageTab from './ManageTab.vue'

const actions = vi.hoisted(() => ({ scan: vi.fn(), switchPath: vi.fn(), load: vi.fn(), patchGame: vi.fn() }))
const store = reactive({
  scannedVersions: [],
  selectedVersion: '',
  currentGamePath: '/A',
  scanPath: actions.scan,
  switchPath: actions.switchPath,
})
const settings = reactive({
  game: {
    minecraft_paths: [
      { name: 'A', path: '/A' },
      { name: 'B', path: '/B' },
    ],
    last_manage_path: '/A',
  },
  load: actions.load,
  patchGame: actions.patchGame,
})
vi.mock('@/features/instances/stores/instanceStore', () => ({ useInstanceStore: () => store }))
vi.mock('@/features/settings/stores/settingsStore', () => ({ useSettingsStore: () => settings }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  actions.scan.mockResolvedValue([])
  actions.load.mockResolvedValue(undefined)
  actions.patchGame.mockResolvedValue(undefined)
  actions.switchPath.mockImplementation(async (path: string) => {
    store.currentGamePath = path
  })
})

const fixture = {
  id: 'fixture',
  versionId: 'fixture',
  path: '/A',
  displayName: 'Fixture',
  primaryLoader: 'Vanilla',
  vanillaName: '1.21.1',
} as ScannedVersion

async function mountConfirmFlow() {
  const detailStub = defineComponent({
    name: 'InstanceDetailModal',
    components: { FullscreenModal },
    props: {
      visible: Boolean,
      version: { type: Object as PropType<ScannedVersion>, default: null },
      initialTab: { type: String, default: 'overview' },
    },
    emits: ['update:visible', 'action', 'delete', 'launch', 'updated'],
    setup(_, { expose }) {
      const modal = ref<InstanceType<typeof FullscreenModal> | null>(null)
      expose({ modalId: computed(() => modal.value?.modalId ?? null) })
      return { modal }
    },
    template:
      '<FullscreenModal ref="modal" :visible="visible" title="实例详情" @update:visible="$emit(\'update:visible\', $event)"><button>详情操作</button></FullscreenModal>',
  })
  const wrapper = mount(ManageTab, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        InstancePathSidebar: true,
        InstalledInstanceList: true,
        PluginSlotHost: true,
        InstanceDetailModal: detailStub,
        transition: false,
      },
    },
  })
  await flushPromises()
  const list = wrapper.findComponent({ name: 'InstalledInstanceList' })
  list.vm.$emit('detail', fixture)
  await flushPromises()
  return { wrapper, list, detail: wrapper.findComponent(detailStub) }
}

it('详情复制确认保留真实父窗口，随后列表操作不残留详情关联', async () => {
  const { wrapper, list, detail } = await mountConfirmFlow()
  try {
    detail.vm.$emit('action', 'clone', fixture)
    await flushPromises()
    const parent = document.querySelector<HTMLElement>('.fullscreen-modal')!
    expect(parent.style.display).not.toBe('none')
    expect(parent.hasAttribute('inert')).toBe(true)
    expect(globalModalStack.displayedModalIds.value).toHaveLength(2)
    wrapper.findComponent(ConfirmDialog).vm.$emit('update:visible', false)
    await flushPromises()
    await vi.waitFor(() => expect(parent.hasAttribute('inert')).toBe(false))
    detail.vm.$emit('update:visible', false)
    await flushPromises()
    await vi.waitFor(() => expect(globalModalStack.hasActiveOverlay.value).toBe(false))
    list.vm.$emit('action', 'clone', fixture)
    await flushPromises()
    expect(wrapper.findComponent(ConfirmDialog).props('parentId')).toBeNull()
    expect(globalModalStack.displayedModalIds.value).toHaveLength(1)
  } finally {
    wrapper.unmount()
    globalModalStack.reset()
  }
})

it('详情修复检查返回前关闭再打开时丢弃旧结果', async () => {
  let finish!: (value: { issues: unknown[]; downloadBytes: number; canRepair: boolean }) => void
  const check = vi.spyOn(instanceWorkspaceApi, 'checkFiles').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const { wrapper, list, detail } = await mountConfirmFlow()
  try {
    detail.vm.$emit('action', 'repair', fixture)
    await flushPromises()
    detail.vm.$emit('update:visible', false)
    await flushPromises()
    list.vm.$emit('detail', fixture)
    await flushPromises()
    finish({ issues: ['missing'], downloadBytes: 1, canRepair: true })
    await flushPromises()
    expect(wrapper.findComponent(ConfirmDialog).props('visible')).toBe(false)
  } finally {
    wrapper.unmount()
    globalModalStack.reset()
    check.mockRestore()
  }
})

it.each([false, true])('详情删除取消保持父页，仅删除成功关闭：失败 %s', async (shouldFail) => {
  const remove = vi.spyOn(instanceWorkspaceApi, 'deleteInstance')
  if (shouldFail) remove.mockRejectedValue(new Error('测试实例正在运行'))
  else remove.mockResolvedValue(undefined)
  const { wrapper, detail } = await mountConfirmFlow()
  try {
    detail.vm.$emit('delete', fixture)
    await flushPromises()
    expect(detail.props('visible')).toBe(true)
    const dialog = wrapper.findComponent(ConfirmDialog)
    dialog.vm.$emit('update:visible', false)
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()
    expect(detail.props('visible')).toBe(true)
    detail.vm.$emit('delete', fixture)
    await flushPromises()
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(remove).toHaveBeenCalledOnce()
    expect(detail.props('visible')).toBe(shouldFail)
    expect(dialog.props('visible')).toBe(shouldFail)
  } finally {
    wrapper.unmount()
    globalModalStack.reset()
    remove.mockRestore()
  }
})

it('外层扫描乱序不把较早选择重新提交给实例 store，卸载也使选择失效', async () => {
  const wrapper = mount(ManageTab, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: {
        InstancePathSidebar: true,
        InstalledInstanceList: true,
        PluginSlotHost: true,
        Modal: true,
        ConfirmDialog: true,
        InstanceDetailModal: true,
      },
    },
  })
  await flushPromises()
  const sidebar = wrapper.findComponent({ name: 'InstancePathSidebar' })
  let finish!: () => void
  actions.scan.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  sidebar.vm.$emit('select', 0)
  await flushPromises()
  sidebar.vm.$emit('select', 1)
  await flushPromises()
  expect(store.currentGamePath).toBe('/B')
  finish()
  await flushPromises()
  expect(store.currentGamePath).toBe('/B')
  actions.scan.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  sidebar.vm.$emit('select', 0)
  wrapper.unmount()
  finish()
  await flushPromises()
  expect(store.currentGamePath).toBe('/B')
})
