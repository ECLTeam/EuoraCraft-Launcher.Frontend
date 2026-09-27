import { onMounted, onUnmounted, ref, watch } from 'vue'
import { connectorApi } from '@/features/connect/api/connectorApi'
import type { ConnectorPlayer, ConnectorStatus, EasyTierStatus } from '@/types/connect'
import type { InstanceTargetPayload } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'

const STATUS_POLL_MS = 2_000
const PORT_SCAN_MS = 1_000
const MAX_SEARCH_MISSES = 5

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

interface UseConnectorOptions {
  onError?: (message: string) => void
}

export function useConnector(options: UseConnectorOptions = {}) {
  const availability = ref<'checking' | 'available' | 'unavailable'>('checking')
  const unavailableReason = ref('')
  const status = ref<ConnectorStatus>(idleStatus())
  const easyTier = ref<EasyTierStatus | null>(null)
  const busy = ref(false)
  const scanning = ref(false)
  const detectedPort = ref<number | null>(null)
  const scanPhase = ref<'detecting' | 'searching'>('detecting')
  const candidatePorts = ref<number[]>([])
  let searchMisses = 0

  let statusTimer: ReturnType<typeof setInterval> | null = null
  let portScanTimer: ReturnType<typeof setInterval> | null = null

  function report(error: unknown): void {
    options.onError?.(getErrorMessage(error))
  }

  function clearTimer(timer: ReturnType<typeof setInterval> | null): void {
    if (timer) clearInterval(timer)
  }

  async function refreshStatus(initial = false): Promise<boolean> {
    try {
      status.value = await connectorApi.status()
      availability.value = 'available'
      unavailableReason.value = ''
      return true
    } catch (error) {
      if (initial || availability.value === 'checking') {
        availability.value = 'unavailable'
        unavailableReason.value = getErrorMessage(error)
        status.value = idleStatus()
      }
      return false
    }
  }

  async function refreshEasyTier(silent = true): Promise<void> {
    try {
      easyTier.value = await connectorApi.easyTierStatus()
    } catch (error) {
      if (!silent) report(error)
    }
  }

  async function initialize(): Promise<void> {
    availability.value = 'checking'
    if (await refreshStatus(true)) await refreshEasyTier()
  }

  async function retryAvailability(): Promise<void> {
    await initialize()
  }

  async function runAction(action: () => Promise<unknown>): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      await action()
      await refreshStatus()
      return true
    } catch (error) {
      report(error)
      return false
    } finally {
      busy.value = false
    }
  }

  function hostPort(port: number): Promise<boolean> {
    return runAction(() => connectorApi.hostPort(port))
  }

  function hostInstance(target: InstanceTargetPayload): Promise<boolean> {
    return runAction(() => connectorApi.hostInstance(target))
  }

  function join(code: string): Promise<boolean> {
    return runAction(() => connectorApi.join(code))
  }

  async function leave(): Promise<boolean> {
    const succeeded = await runAction(() => connectorApi.leave())
    if (succeeded) {
      detectedPort.value = null
      candidatePorts.value = []
      scanPhase.value = 'detecting'
      searchMisses = 0
    }
    return succeeded
  }

  function kick(player: ConnectorPlayer): Promise<boolean> {
    return runAction(() => connectorApi.kick(player.machineId))
  }

  async function scanPortOnce(): Promise<void> {
    try {
      if (scanPhase.value === 'detecting') {
        const result = await connectorApi.detectPorts()
        if (result.ports.length > 0) {
          candidatePorts.value = result.ports
          scanPhase.value = 'searching'
          searchMisses = 0
        }
        return
      }
      const result = await connectorApi.searchMcPort(candidatePorts.value)
      if (result.port !== null) {
        detectedPort.value = result.port
        stopPortScan()
        return
      }
      searchMisses += 1
      // 连续未命中说明候选端口可能过期（游戏在探测后才开启局域网），重新探测
      if (searchMisses >= MAX_SEARCH_MISSES) {
        candidatePorts.value = []
        scanPhase.value = 'detecting'
        searchMisses = 0
      }
    } catch (error) {
      stopPortScan()
      report(error)
    }
  }

  function startPortScan(): void {
    clearTimer(portScanTimer)
    detectedPort.value = null
    candidatePorts.value = []
    scanPhase.value = 'detecting'
    searchMisses = 0
    scanning.value = true
    void scanPortOnce()
    portScanTimer = setInterval(() => void scanPortOnce(), PORT_SCAN_MS)
  }

  function stopPortScan(): void {
    clearTimer(portScanTimer)
    portScanTimer = null
    scanning.value = false
  }

  watch(
    () => status.value.mode,
    (mode) => {
      clearTimer(statusTimer)
      statusTimer = mode === 'idle' ? null : setInterval(() => void refreshStatus(), STATUS_POLL_MS)
    }
  )

  onMounted(() => void initialize())
  onUnmounted(() => {
    clearTimer(statusTimer)
    clearTimer(portScanTimer)
  })

  return {
    availability,
    unavailableReason,
    status,
    easyTier,
    busy,
    scanning,
    scanPhase,
    detectedPort,
    refreshStatus,
    refreshEasyTier,
    retryAvailability,
    hostPort,
    hostInstance,
    join,
    leave,
    kick,
    startPortScan,
    stopPortScan,
  }
}
