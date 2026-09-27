import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import UiSelect from '@/components/ui/Select.vue'
import { provideConnector, type ConnectorContext } from '@/features/connect/connectorContext'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { i18n } from '@/i18n'
import type { ConnectorStatus, EasyTierStatus } from '@/types/connect'
import type { GameInstance, ScannedVersion } from '@/types/instances'
import ConnectRoomTab from './ConnectRoomTab.vue'

const mocks = vi.hoisted(() => ({
  listRunningInstances: vi.fn(),
  onRunningChanged: vi.fn(),
  writeClipboard: vi.fn(),
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
  isBroken: false,
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
  useInstanceStore().scannedVersions = [scannedVersion]
  i18n.global.locale.value = 'zh-CN'

  return mount(Harness, {
    global: { plugins: [i18n, pinia] },
  })
}

describe('ConnectRoomTab', () => {
  beforeEach(() => {
    mocks.listRunningInstances.mockReset().mockResolvedValue([])
    mocks.onRunningChanged.mockReset().mockReturnValue(undefined)
    mocks.writeClipboard.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeClipboard },
    })
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
})
