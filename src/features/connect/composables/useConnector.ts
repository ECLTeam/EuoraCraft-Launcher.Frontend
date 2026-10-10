import { defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { pinia } from '@/app/stores'
import { connectorApi } from '@/features/connect/api/connectorApi'
import type { ConnectorPlayer, ConnectorStatus } from '@/types/connect'
import type { InstanceTargetPayload } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'

const statusPollMs = 2000
const portScanMs = 1000
const maxSearchMisses = 5

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

const defineConnectorSession = defineStore('connectorSession', () => {
  const availability = ref<'checking' | 'available' | 'unavailable'>('checking')
  const unavailableReason = ref('')
  const status = ref<ConnectorStatus>(idleStatus())
  const busy = ref(false)
  const scanning = ref(false)
  const detectedPort = ref<number | null>(null)
  const scanPhase = ref<'detecting' | 'searching'>('detecting')
  const candidatePorts = ref<number[]>([])
  let onError: UseConnectorOptions['onError']
  let isDisposed = false
  let isInitialized = false
  let sessionRevision = 0
  let scanRevision = 0
  let searchMisses = 0
  let statusTimer: ReturnType<typeof setTimeout> | undefined
  let scanTimer: ReturnType<typeof setTimeout> | undefined
  let statusRequest: { revision: number; promise: Promise<boolean> } | null = null
  let initialization: Promise<void> | null = null
  let scanRequest: Promise<void> | null = null

  function setErrorHandler(handler: UseConnectorOptions['onError']): void {
    onError = handler
  }
  function report(error: unknown): void {
    onError?.(getErrorMessage(error))
  }

  function scheduleStatusPoll(): void {
    clearTimeout(statusTimer)
    statusTimer = undefined
    if (isDisposed || !isInitialized || status.value.mode === 'idle') return
    statusTimer = setTimeout(() => {
      statusTimer = undefined
      void refreshStatus()
    }, statusPollMs)
  }

  async function refreshStatus(initial = false): Promise<boolean> {
    if (isDisposed) return false
    const revision = sessionRevision
    if (statusRequest) {
      if (statusRequest.revision === revision) return statusRequest.promise
      await statusRequest.promise
      if (isDisposed || revision !== sessionRevision) return false
      return refreshStatus(initial)
    }
    const promise = (async () => {
      try {
        const next = await connectorApi.status()
        if (isDisposed || revision !== sessionRevision) return false
        status.value = next
        availability.value = 'available'
        unavailableReason.value = ''
        return true
      } catch (error) {
        if (isDisposed || revision !== sessionRevision) return false
        if (initial || availability.value === 'checking') {
          availability.value = 'unavailable'
          unavailableReason.value = getErrorMessage(error)
          status.value = idleStatus()
        }
        return false
      }
    })()
    const tracked = promise.finally(() => {
      if (statusRequest?.promise === tracked) statusRequest = null
      if (!isDisposed && revision === sessionRevision) scheduleStatusPoll()
    })
    statusRequest = { revision, promise: tracked }
    return tracked
  }

  function initialize(force = false): Promise<void> {
    if (initialization) return initialization
    if (isInitialized && !force && !isDisposed) return Promise.resolve()
    isDisposed = false
    isInitialized = true
    const revision = ++sessionRevision
    availability.value = 'checking'
    const promise = (async () => {
      await refreshStatus(true)
    })()
    const tracked = promise.finally(() => {
      if (initialization === tracked) initialization = null
      if (revision === sessionRevision) scheduleStatusPoll()
    })
    initialization = tracked
    return tracked
  }

  function retryAvailability(): Promise<void> {
    return initialize(true)
  }

  async function runAction(action: () => Promise<unknown>): Promise<boolean> {
    if (busy.value || isDisposed) return false
    const revision = ++sessionRevision
    busy.value = true
    clearTimeout(statusTimer)
    try {
      await action()
      if (isDisposed || revision !== sessionRevision) return false
      await refreshStatus()
      return !isDisposed && revision === sessionRevision
    } catch (error) {
      if (!isDisposed && revision === sessionRevision) report(error)
      return false
    } finally {
      if (!isDisposed && revision === sessionRevision) {
        busy.value = false
        scheduleStatusPoll()
      }
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
  function kick(player: ConnectorPlayer): Promise<boolean> {
    return runAction(() => connectorApi.kick(player.machineId))
  }

  async function leave(): Promise<boolean> {
    stopPortScan()
    const succeeded = await runAction(() => connectorApi.leave())
    if (succeeded) {
      detectedPort.value = null
      candidatePorts.value = []
      scanPhase.value = 'detecting'
      searchMisses = 0
    }
    return succeeded
  }

  async function scanPortOnce(revision: number): Promise<void> {
    const isCurrent = () => !isDisposed && scanning.value && revision === scanRevision
    if (scanRequest) {
      await scanRequest
      if (isCurrent()) return scanPortOnce(revision)
      return
    }
    const promise = (async () => {
      try {
        if (scanPhase.value === 'detecting') {
          const result = await connectorApi.detectPorts()
          if (!isCurrent()) return
          if (result.ports.length) {
            candidatePorts.value = result.ports
            scanPhase.value = 'searching'
            searchMisses = 0
          }
        } else {
          const result = await connectorApi.searchMcPort([...candidatePorts.value])
          if (!isCurrent()) return
          if (result.port !== null) {
            detectedPort.value = result.port
            stopPortScan()
            return
          }
          if (++searchMisses >= maxSearchMisses) {
            candidatePorts.value = []
            scanPhase.value = 'detecting'
            searchMisses = 0
          }
        }
      } catch (error) {
        if (isCurrent()) {
          stopPortScan()
          report(error)
        }
      }
    })()
    const tracked = promise.finally(() => {
      if (scanRequest === tracked) scanRequest = null
      if (isCurrent()) scanTimer = setTimeout(() => void scanPortOnce(revision), portScanMs)
    })
    scanRequest = tracked
    await tracked
  }

  function startPortScan(): void {
    if (isDisposed) return
    stopPortScan()
    detectedPort.value = null
    candidatePorts.value = []
    scanPhase.value = 'detecting'
    searchMisses = 0
    scanning.value = true
    void scanPortOnce(scanRevision)
  }

  function stopPortScan(): void {
    scanRevision++
    clearTimeout(scanTimer)
    scanTimer = undefined
    scanning.value = false
  }

  function dispose(): void {
    isDisposed = true
    sessionRevision++
    isInitialized = false
    initialization = null
    clearTimeout(statusTimer)
    statusTimer = undefined
    stopPortScan()
    busy.value = false
    onError = undefined
  }

  watch(() => status.value.mode, scheduleStatusPoll)
  return {
    availability,
    unavailableReason,
    status,
    busy,
    scanning,
    scanPhase,
    detectedPort,
    initialize,
    refreshStatus,
    retryAvailability,
    hostPort,
    hostInstance,
    join,
    leave,
    kick,
    startPortScan,
    stopPortScan,
    dispose,
    setErrorHandler,
  }
})

/** 应用唯一的联机会话；获取状态不会启动查询，由联机页显式初始化。 */
export function useConnector(options: UseConnectorOptions = {}) {
  const session = defineConnectorSession(pinia)
  if (options.onError) session.setErrorHandler(options.onError)
  return {
    ...storeToRefs(session),
    initialize: session.initialize,
    refreshStatus: session.refreshStatus,
    retryAvailability: session.retryAvailability,
    hostPort: session.hostPort,
    hostInstance: session.hostInstance,
    join: session.join,
    leave: session.leave,
    kick: session.kick,
    startPortScan: session.startPortScan,
    stopPortScan: session.stopPortScan,
    dispose: session.dispose,
  }
}
