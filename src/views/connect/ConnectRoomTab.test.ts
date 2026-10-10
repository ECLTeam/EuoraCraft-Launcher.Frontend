import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import ConnectorPlayerAvatar from '@/components/connect/ConnectorPlayerAvatar.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiSelect from '@/components/ui/Select.vue'
import { provideConnector, type ConnectorContext } from '@/features/connect/connectorContext'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { i18n } from '@/i18n'
import type { ConnectorStatus, EasyTierStatus } from '@/types/connect'
import type { GameInstance, ScannedVersion } from '@/types/instances'
import ConnectRoomTab from './ConnectRoomTab.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  listRunningInstances: vi.fn(),
  onRunningChanged: vi.fn(),
  writeClipboard: vi.fn(),
  readClipboard: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.navigate }) }))

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ error: mocks.showError, warning: vi.fn(), success: vi.fn() }),
}))

vi.mock('@/features/instances/api/instanceRuntimeApi', () => ({
  instanceRuntimeApi: {
    list: mocks.listRunningInstances,
    onChanged: mocks.onRunningChanged,
  },
}))

const runningInstance: GameInstance = {
  id: 'survival-1',
  name: '生存世界',
  type: 'instance',
  isRunning: true,
  pid: 1234,
  version: '1.21.5',
  versionId: 'Fabric 1.21.5',
  loader: 'Fabric',
  gamePath: 'C:\\Games\\.minecraft',
}

const scannedVersion: ScannedVersion = {
  id: 'fabric-1.21.5',
  versionId: 'Fabric 1.21.5',
  versionType: 'release',
  path: 'C:\\Games\\.minecraft',
  displayName: '生存世界',
  primaryLoader: 'Fabric',
  loaderVersion: '0.16.10',
  vanillaName: '1.21.5',
  hasForge: false,
  hasNeoForge: false,
  hasFabric: true,
  hasQuilt: false,
  jsonPath: 'C:\\Games\\.minecraft\\versions\\Fabric 1.21.5\\Fabric 1.21.5.json',
}

function idleStatus(): ConnectorStatus {
  return {
    mode: 'idle',
    roomCode: null,
    mcHost: null,
    mcPort: null,
    gameInfo: null,
    players: [],
    nodes: [],
    error: null,
  }
}

function connectorState(status: ConnectorStatus, available = true) {
  return {
    initialize: vi.fn(async () => {}),
    availability: ref(available ? 'available' : 'unavailable'),
    unavailableReason: ref(available ? '' : 'Unknown backend command: connector_status'),
    status: ref(status),
    easyTier: ref<EasyTierStatus | null>(
      available ? { installed: true, status: 'installed', progress: 100, speed: 0, error: null } : null
    ),
    busy: ref(false),
    scanning: ref(false),
    scanPhase: ref<'detecting' | 'searching'>('detecting'),
    detectedPort: ref<number | null>(null),
    retryAvailability: vi.fn(),
    hostPort: vi.fn().mockResolvedValue(true),
    hostInstance: vi.fn().mockResolvedValue(true),
    join: vi.fn().mockResolvedValue(true),
    leave: vi.fn().mockResolvedValue(true),
    kick: vi.fn().mockResolvedValue(true),
    startPortScan: vi.fn(),
    stopPortScan: vi.fn(),
    refreshStatus: vi.fn().mockResolvedValue(true),
  }
}

function mountRoomTab(state: ReturnType<typeof connectorState>) {
  const Harness = defineComponent({
    setup() {
      provideConnector(state as unknown as ConnectorContext)
      return () => h(ConnectRoomTab)
    },
  })
  const pinia = createPinia()
  setActivePinia(pinia)
  vi.spyOn(useSettingsStore(pinia), 'load').mockResolvedValue(undefined)
  useInstanceStore().scannedVersions = [scannedVersion]
  i18n.global.locale.value = 'zh-CN'

  return mount(Harness, {
    attachTo: document.body,
    global: { plugins: [i18n, pinia], components: { UiIcon } },
  })
}

describe('ConnectRoomTab', () => {
  beforeEach(() => {
    mocks.navigate.mockReset().mockResolvedValue(undefined)
    mocks.listRunningInstances.mockReset().mockResolvedValue([])
    mocks.onRunningChanged.mockReset().mockReturnValue(undefined)
    mocks.writeClipboard.mockReset().mockResolvedValue(undefined)
    mocks.readClipboard.mockReset().mockResolvedValue('')
    mocks.showError.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeClipboard, readText: mocks.readClipboard },
    })
  })

  it('快捷入口位于加入卡片标题内，忙碌时禁止跳转', async () => {
    const state = connectorState(idleStatus())
    const wrapper = mountRoomTab(state)
    await flushPromises()
    expect(wrapper.find('details.node-settings').exists()).toBe(false)
    expect(wrapper.find('.connect-settings-entry').exists()).toBe(false)
    expect(wrapper.get('.connect-idle-primary .connect-main-card .card-header').text()).toContain('联机设置')
    const entry = wrapper.get('[data-action="connector-settings"]')
    await entry.trigger('click')
    expect(mocks.navigate).toHaveBeenCalledWith({ path: '/settings/launcher', query: { section: 'connector' } })
    mocks.navigate.mockClear()
    state.busy.value = true
    await flushPromises()
    expect(entry.attributes('disabled')).toBeDefined()
    await entry.trigger('click')
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(state.leave).not.toHaveBeenCalled()
  })

  it.each(['starting', 'host', 'guest'] as const)('%s 状态下不保留独立设置入口', (mode) => {
    const wrapper = mountRoomTab(connectorState({ ...idleStatus(), mode }))
    expect(wrapper.find('[data-action="connector-settings"]').exists()).toBe(false)
  })

  it('保留双卡，将手动端口放在辅助区域并精简同行操作', async () => {
    const state = connectorState(idleStatus())
    const wrapper = mountRoomTab(state)
    await flushPromises()
    expect(wrapper.findAll('.connect-idle-primary .connect-main-card')).toHaveLength(2)
    expect(wrapper.get('.connect-join-row').findAll('button')).toHaveLength(2)
    expect(wrapper.get('.connect-instance-row').findAll('button')).toHaveLength(1)
    const manual = wrapper.get('.connect-create-assist button')
    expect(manual.text()).toBe('手动输入端口')
    expect(manual.attributes('disabled')).toBeUndefined()
    await manual.trigger('click')
    await flushPromises()
    expect(wrapper.find('#connect-port').exists()).toBe(true)
    expect(state.startPortScan).toHaveBeenCalledTimes(1)
  })

  it('输入框内清除仅有内容时展示，清除后恢复输入焦点', async () => {
    const wrapper = mountRoomTab(connectorState(idleStatus()))
    expect(wrapper.find('.connect-code-clear').exists()).toBe(false)
    await wrapper.get('#connect-room-code').setValue('U/YZ0P-UV89-9QG6-WVVT')
    const clear = wrapper.get('.connect-code-field .connect-code-clear')
    expect(clear.attributes('aria-label')).toBe('清除')
    await clear.trigger('click')
    await flushPromises()
    expect((wrapper.get('#connect-room-code').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('.connect-code-clear').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('#connect-room-code').element)
  })

  it('粘贴图标读取并修剪房间码，失败保留原值并提示', async () => {
    const wrapper = mountRoomTab(connectorState(idleStatus()))
    mocks.readClipboard.mockResolvedValue('  U/YZ0P-UV89-9QG6-WVVT  ')
    const paste = wrapper.get('.connect-code-paste')
    expect(paste.text()).toBe('')
    expect(paste.attributes('aria-label')).toBe('粘贴')
    await paste.trigger('click')
    await flushPromises()
    expect((wrapper.get('#connect-room-code').element as HTMLInputElement).value).toBe('U/YZ0P-UV89-9QG6-WVVT')
    mocks.readClipboard.mockRejectedValue(new Error('Clipboard denied'))
    await paste.trigger('click')
    await flushPromises()
    expect(mocks.showError).toHaveBeenCalledWith(i18n.global.t('connect.validation.pasteFailed'))
    expect((wrapper.get('#connect-room-code').element as HTMLInputElement).value).toBe('U/YZ0P-UV89-9QG6-WVVT')
  })

  it('服务不可用时禁止图标清除和粘贴，输入 Enter 沿用加入流程', async () => {
    const state = connectorState(idleStatus())
    const wrapper = mountRoomTab(state)
    await wrapper.get('#connect-room-code').setValue('U/YZ0P-UV89-9QG6-WVVT')
    await wrapper.get('#connect-room-code').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(state.join).toHaveBeenCalledWith('U/YZ0P-UV89-9QG6-WVVT')
    state.availability.value = 'unavailable'
    await flushPromises()
    expect(wrapper.get('.connect-code-clear').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.connect-code-paste').attributes('disabled')).toBeDefined()
    await wrapper.get('.connect-code-clear').trigger('click')
    await wrapper.get('.connect-code-paste').trigger('click')
    expect((wrapper.get('#connect-room-code').element as HTMLInputElement).value).toBe('U/YZ0P-UV89-9QG6-WVVT')
    expect(mocks.readClipboard).not.toHaveBeenCalled()
  })

  it('keeps the room choices visible when the backend is unavailable', () => {
    const wrapper = mountRoomTab(connectorState(idleStatus(), false))

    expect(wrapper.text()).toContain('加入联机房间')
    expect(wrapper.text()).toContain('创建房间')
    expect(wrapper.get('#connect-room-code').attributes('disabled')).toBeDefined()
  })

  it('加入房间进行中禁用创建房间功能', async () => {
    const state = connectorState(idleStatus())
    state.busy.value = true
    const wrapper = mountRoomTab(state)
    await flushPromises()

    const createCard = wrapper
      .findAll('.connect-main-card')
      .find((candidate) => candidate.text().includes('从已启动的实例创建联机房间'))

    expect(createCard?.attributes('aria-disabled')).toBe('true')
    expect(createCard?.findComponent(UiSelect).props('disabled')).toBe(true)
    expect(createCard?.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('无运行实例时禁用选择器并显示空状态占位文案', async () => {
    const wrapper = mountRoomTab(connectorState(idleStatus()))
    await flushPromises()

    const select = wrapper.getComponent(UiSelect)
    expect(select.props('disabled')).toBe(true)
    expect(select.get('.placeholder').text()).toBe('暂无运行实例')
    expect(wrapper.text()).toContain('没有检测到已启动的实例，请先在「游戏」页启动实例')

    await select.get('.select-trigger').trigger('click')
    expect(select.get('.ui-select').classes()).not.toContain('open')
  })

  it('展开运行实例列表时没有搜索框且可以选择实例', async () => {
    mocks.listRunningInstances.mockResolvedValue([runningInstance])
    const wrapper = mountRoomTab(connectorState(idleStatus()))
    await flushPromises()

    const select = wrapper.getComponent(UiSelect)
    expect(select.props('disabled')).toBe(false)
    expect(select.get('.placeholder').text()).toBe('请选择已启动的实例')
    await select.get('.select-trigger').trigger('click')

    expect(select.get('.ui-select').classes()).toContain('open')
    const dropdown = document.body.querySelector('.select-dropdown')
    expect(dropdown?.querySelector('.select-search')).toBeNull()
    expect(dropdown?.querySelector('input')).toBeNull()
    const option = dropdown?.querySelector<HTMLElement>('.select-option')
    expect(option?.textContent).toContain(runningInstance.name)
    option?.click()
    await wrapper.vm.$nextTick()

    expect(select.props('modelValue')).toBe(runningInstance.id)
    expect(select.get('.selected-text').text()).toBe(runningInstance.name)
    expect(select.get('.ui-select').classes()).not.toContain('open')
  })

  it('运行实例启动和退出时同步更新禁用状态与占位文案', async () => {
    const wrapper = mountRoomTab(connectorState(idleStatus()))
    await flushPromises()
    const select = wrapper.getComponent(UiSelect)
    const onChanged = mocks.onRunningChanged.mock.calls[0]?.[0] as () => void
    expect(select.props('disabled')).toBe(true)

    mocks.listRunningInstances.mockResolvedValue([runningInstance])
    onChanged()
    await flushPromises()
    expect(select.props('disabled')).toBe(false)
    expect(select.get('.placeholder').text()).toBe('请选择已启动的实例')
    await select.get('.select-trigger').trigger('click')
    document.body.querySelector<HTMLElement>('.select-option')?.click()
    await wrapper.vm.$nextTick()

    mocks.listRunningInstances.mockResolvedValue([])
    onChanged()
    await flushPromises()
    expect(select.props('disabled')).toBe(true)
    expect(select.get('.placeholder').text()).toBe('暂无运行实例')
    await select.get('.select-trigger').trigger('click')
    expect(select.get('.ui-select').classes()).not.toContain('open')
  })

  it.each([
    ['zh-CN', '暂无运行实例'],
    ['zh-TW', '暫無執行中的實例'],
    ['en-US', 'No running instances'],
    ['ja-JP', '実行中のインスタンスはありません'],
    ['de-DE', 'Keine laufenden Instanzen'],
    ['ru-RU', 'Нет запущенных экземпляров'],
  ] as const)('切换到 %s 时显示对应的空状态占位文案', async (locale, placeholder) => {
    const wrapper = mountRoomTab(connectorState(idleStatus()))
    await flushPromises()
    const messages = i18n.global.getLocaleMessage(locale)
    expect(messages.connect.create).toHaveProperty('noRunningInstancePlaceholder', placeholder)

    i18n.global.locale.value = locale
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(UiSelect).get('.placeholder').text()).toBe(placeholder)
  })

  it('加入房间成功后主动刷新一次成员', async () => {
    const state = connectorState(idleStatus())
    const wrapper = mountRoomTab(state)
    await wrapper.get('#connect-room-code').setValue('U/YZ0P-UV89-9QG6-WVVT')

    await wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('加入房间'))
      ?.trigger('click')
    await flushPromises()

    expect(state.join).toHaveBeenCalledWith('U/YZ0P-UV89-9QG6-WVVT')
    expect(state.refreshStatus).toHaveBeenCalledTimes(1)
  })

  it('加入房间时拒绝格式非法的房间码', async () => {
    const state = connectorState(idleStatus())
    const wrapper = mountRoomTab(state)
    await wrapper.get('#connect-room-code').setValue('2026-08-22 22:07:48 ERROR 无法找到联机大厅')

    await wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('加入房间'))
      ?.trigger('click')
    await flushPromises()

    expect(state.join).not.toHaveBeenCalled()
    expect(state.refreshStatus).not.toHaveBeenCalled()
  })

  it('renders launch failures as a stable starting-state card', () => {
    const wrapper = mountRoomTab(
      connectorState({
        ...idleStatus(),
        mode: 'starting',
        error: 'Minecraft process exited before opening a LAN port',
      })
    )

    expect(wrapper.text()).toContain('创建房间失败')
    expect(wrapper.text()).toContain('Minecraft process exited before opening a LAN port')
  })

  it('no longer exposes NAT detection inside the room flow', () => {
    const wrapper = mountRoomTab(connectorState(idleStatus()))

    expect(wrapper.findAll('button').some((candidate) => candidate.text().includes('NAT 检测'))).toBe(false)
  })

  it('selects a running instance and proceeds to port detection', async () => {
    const state = connectorState(idleStatus())
    mocks.listRunningInstances.mockResolvedValue([runningInstance])
    const wrapper = mountRoomTab(state)
    await flushPromises()

    wrapper.findComponent(UiSelect).vm.$emit('update:modelValue', runningInstance.id)
    await wrapper.vm.$nextTick()
    const button = wrapper.findAll('button').find((candidate) => candidate.text().includes('下一步'))
    await button?.trigger('click')
    await flushPromises()

    expect(state.startPortScan).toHaveBeenCalled()
  })

  it('starts port detection after entering the manual port step', async () => {
    const state = connectorState(idleStatus())
    const wrapper = mountRoomTab(state)

    const button = wrapper.findAll('button').find((candidate) => candidate.text().includes('输入端口'))
    expect(button).toBeDefined()
    await button?.trigger('click')
    await flushPromises()

    expect(state.startPortScan).toHaveBeenCalled()
  })

  it.each(['输入端口', '下一步', '快捷创建'] as const)(
    '通过%s切换步骤时替换过渡根节点并保留表单状态',
    async (entry) => {
      const state = connectorState(idleStatus())
      mocks.listRunningInstances.mockResolvedValue(entry === '输入端口' ? [] : [runningInstance])
      const wrapper = mountRoomTab(state)
      await flushPromises()
      const initialStep = wrapper.get('.connect-idle-layout').element
      await wrapper.get('#connect-room-code').setValue('U/YZ0P-UV89-9QG6-WVVT')

      if (entry === '下一步') {
        wrapper.getComponent(UiSelect).vm.$emit('update:modelValue', runningInstance.id)
        await wrapper.vm.$nextTick()
      }
      const entryButton =
        entry === '快捷创建'
          ? wrapper.get('.connect-running-game button')
          : wrapper
              .findAll('button')
              .find((button) => button.text() === (entry === '输入端口' ? '手动输入端口' : entry))
      expect(entryButton).toBeDefined()
      await entryButton?.trigger('click')
      await flushPromises()

      const portStep = wrapper.get('.connect-idle-layout').element
      expect(portStep).not.toBe(initialStep)
      expect(wrapper.find('#connect-instance').exists()).toBe(false)
      expect(state.startPortScan).toHaveBeenCalledTimes(1)
      await wrapper.get('#connect-port').setValue('25566')

      await wrapper.get('.connect-mode-link').trigger('click')
      await flushPromises()
      expect(wrapper.get('.connect-idle-layout').element).not.toBe(portStep)
      expect(wrapper.find('#connect-port').exists()).toBe(false)
      expect((wrapper.get('#connect-room-code').element as HTMLInputElement).value).toBe('U/YZ0P-UV89-9QG6-WVVT')
      expect(wrapper.getComponent(UiSelect).props('modelValue')).toBe(entry === '输入端口' ? '' : runningInstance.id)
      expect(state.stopPortScan).toHaveBeenCalledTimes(1)

      await wrapper
        .findAll('button')
        .find((button) => button.text() === '手动输入端口')
        ?.trigger('click')
      await flushPromises()
      expect((wrapper.get('#connect-port').element as HTMLInputElement).value).toBe('25566')
      expect(state.startPortScan).toHaveBeenCalledTimes(2)
    }
  )

  it('creates a room with a manually entered port', async () => {
    const state = connectorState(idleStatus())
    mocks.listRunningInstances.mockResolvedValue([runningInstance])
    const wrapper = mountRoomTab(state)
    await flushPromises()

    wrapper.findComponent(UiSelect).vm.$emit('update:modelValue', runningInstance.id)
    await wrapper.vm.$nextTick()
    await wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('下一步'))
      ?.trigger('click')
    await flushPromises()

    await wrapper.get('#connect-port').setValue('25566')
    await wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('创建房间'))
      ?.trigger('click')

    expect(state.hostPort).toHaveBeenCalledWith(25566)
  })

  it('shows host controls and passes the selected player to kick', async () => {
    const guest = {
      name: 'Guest',
      vendor: 'ECL',
      iconBase64: null,
      kind: 'guest' as const,
      machineId: 'guest-1',
    }
    const state = connectorState({
      ...idleStatus(),
      mode: 'host',
      roomCode: 'U/TEST-ROOM',
      players: [{ ...guest, name: 'Host', kind: 'host', machineId: 'host-1' }, guest],
    })
    const wrapper = mountRoomTab(state)

    await wrapper.get('[title="踢出玩家"]').trigger('click')

    expect(state.kick).toHaveBeenCalledWith(guest)
  })

  it('成员页不再显示游戏与模组匹配功能', () => {
    const state = connectorState({
      ...idleStatus(),
      mode: 'guest',
      roomCode: 'U/TEST-ROOM',
      mcHost: '127.0.0.1',
      mcPort: 25566,
      gameInfo: { gameVersion: '1.21.5', loader: 'Fabric', loaderVersion: '0.16.10' },
    })
    const wrapper = mountRoomTab(state)

    expect(wrapper.text()).not.toContain('游戏与模组匹配')
    expect(wrapper.text()).not.toContain('快捷启动')
  })

  it('成员页可以复制服务器地址', async () => {
    const wrapper = mountRoomTab(
      connectorState({
        ...idleStatus(),
        mode: 'guest',
        roomCode: 'U/TEST-ROOM',
        mcHost: '127.0.0.1',
        mcPort: 25566,
      })
    )

    await wrapper.get('.connect-copy-value button').trigger('click')

    expect(mocks.writeClipboard).toHaveBeenCalledWith('127.0.0.1:25566')
  })

  it.each(['host', 'guest'] as const)('紧凑的 %s 房间保留完整姓名提示和可访问的复制入口', async (mode) => {
    const name = 'HostPlayerWithAVeryLongName'.repeat(3)
    const roomCode = 'U/' + '1234-5678-9012-3456'.repeat(3)
    const wrapper = mountRoomTab(
      connectorState({
        ...idleStatus(),
        mode,
        roomCode,
        players: [{ name, vendor: 'Fabric', kind: 'host', machineId: 'host', iconBase64: null }],
      })
    )
    expect(wrapper.get('.connect-player-identity strong').attributes('title')).toBe(name)
    expect(wrapper.get('.connect-room-owner__identity strong').attributes('title')).toBe(name)
    expect(wrapper.findAllComponents(ConnectorPlayerAvatar).map((avatar) => avatar.props('size'))).toEqual([32, 32])
    expect(wrapper.findAll('.ui-tag')).toHaveLength(1)
    const copy = wrapper.get('.connect-room-code-block button')
    expect(copy.attributes('aria-label')).toBe('复制')
    await copy.trigger('click')
    expect(mocks.writeClipboard).toHaveBeenCalledWith(roomCode)
    expect(wrapper.find('[title="踢出玩家"]').exists()).toBe(false)
    if (mode === 'guest') {
      expect(wrapper.get('.connect-members-heading').text()).toContain('复制服务器地址，在游戏中加入')
      expect(wrapper.get('.connect-copy-value button').attributes('aria-label')).toBe('复制')
    }
  })

  it.each(['host', 'guest'] as const)('%s 的刷新及离开仍正确调用，忙碌时禁用操作', async (mode) => {
    const state = connectorState({ ...idleStatus(), mode, roomCode: 'U/TEST-ROOM' })
    const wrapper = mountRoomTab(state)
    await flushPromises()
    state.refreshStatus.mockClear()
    const actions = wrapper.get('.connect-room-operation-list').findAll('button')
    expect(actions.map((button) => button.text())).toEqual(['刷新玩家', mode === 'host' ? '关闭房间' : '退出房间'])
    await actions[0]!.trigger('click')
    await actions[1]!.trigger('click')
    expect(state.refreshStatus).toHaveBeenCalledTimes(1)
    expect(state.leave).toHaveBeenCalledTimes(1)
    state.busy.value = true
    await flushPromises()
    for (const action of actions) {
      expect(action.attributes('disabled')).toBeDefined()
      await action.trigger('click')
    }
    expect(state.refreshStatus).toHaveBeenCalledTimes(1)
    expect(state.leave).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.connect-empty-text').text()).toBe(i18n.global.t('connect.players.empty'))
  })

  it('房主忙碌时不能踢人，房客不能踢人且长服务器地址复制完整', async () => {
    const guest = { name: 'Guest', vendor: 'ECL', iconBase64: null, kind: 'guest' as const, machineId: 'guest' }
    const state = connectorState({ ...idleStatus(), mode: 'host', players: [guest] })
    const wrapper = mountRoomTab(state)
    state.busy.value = true
    await flushPromises()
    const kick = wrapper.get('[title="踢出玩家"]')
    expect(kick.attributes('disabled')).toBeDefined()
    await kick.trigger('click')
    expect(state.kick).not.toHaveBeenCalled()
    state.status.value = {
      ...idleStatus(),
      mode: 'guest',
      players: [guest],
      mcHost: '2001:db8:1234:5678:abcd:ef01:2345:6789',
      mcPort: 25566,
    }
    state.busy.value = false
    await flushPromises()
    expect(wrapper.find('[title="踢出玩家"]').exists()).toBe(false)
    await wrapper.get('.connect-copy-value button').trigger('click')
    expect(mocks.writeClipboard).toHaveBeenCalledWith(`${state.status.value.mcHost}:25566`)
  })
})
