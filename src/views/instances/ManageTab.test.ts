import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { i18n } from '@/i18n'
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
