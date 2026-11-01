import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFlowDebug } from '@/composables/useFlowDebug'
import type { ConnectorStatus } from '@/types/connect'

type DebugStageKey = 'idle' | 'create-port' | 'starting' | 'host' | 'guest'

interface FlowDebugInputs {
  status: Ref<ConnectorStatus>
  hostStep: Ref<1 | 2>
  detectedPort: Ref<number | null>
  scanning: Ref<boolean>
}

/**
 * Connect 页面的流程调试状态。
 *
 * 开启流程调试后可用 mock 状态自由切换各阶段（idle / 创建端口 /
 * starting / host / guest），并派生 display* 计算属性供模板渲染。
 */
export function useConnectFlowDebug({ status, hostStep, detectedPort, scanning }: FlowDebugInputs) {
  const { t } = useI18n()
  const { flowDebug } = useFlowDebug()

  const debugStageIndex = ref(0)
  const stageOverride = ref<ConnectorStatus | null>(null)
  const hostStepOverride = ref<1 | 2>(1)

  const debugStages = computed<{ key: DebugStageKey; label: string }[]>(() => [
    { key: 'idle', label: t('connect.debug.idle') },
    { key: 'create-port', label: t('connect.debug.createPort') },
    { key: 'starting', label: t('connect.debug.starting') },
    { key: 'host', label: t('connect.debug.host') },
    { key: 'guest', label: t('connect.debug.guest') },
  ])

  function mockIdleStatus(): ConnectorStatus {
    return {
      mode: 'idle',
      roomCode: null,
      mcHost: null,
      mcPort: null,
      gameInfo: null,
      hostName: null,
      players: [],
      nodes: [],
      error: null,
    }
  }

  function mockRoomStatus(mode: 'starting' | 'host' | 'guest'): ConnectorStatus {
    const inRoom = mode !== 'starting'
    return {
      mode,
      roomCode: inRoom ? 'U/1234-5678-9012-3456' : null,
      mcHost: '127.0.0.1',
      mcPort: 25565,
      gameInfo: inRoom ? { gameVersion: '1.20.1', loader: 'fabric', loaderVersion: '0.15.11' } : null,
      hostName: null,
      players: inRoom
        ? [
            { name: 'HostPlayer', vendor: 'Fabric', iconBase64: null, kind: 'host', machineId: 'host-1' },
            { name: 'Alice', vendor: 'Fabric', iconBase64: null, kind: 'guest', machineId: 'guest-1' },
          ]
        : [],
      nodes: ['tcp://public.easytier.cn:11010'],
      error: null,
    }
  }

  function stageIndex(key: DebugStageKey): number {
    return debugStages.value.findIndex((stage) => stage.key === key)
  }

  function applyDebugStage(index: number): void {
    debugStageIndex.value = index
    const key = debugStages.value[index]!.key
    switch (key) {
      case 'idle':
        stageOverride.value = mockIdleStatus()
        hostStepOverride.value = 1
        break
      case 'create-port':
        stageOverride.value = mockIdleStatus()
        hostStepOverride.value = 2
        break
      case 'starting':
        stageOverride.value = mockRoomStatus('starting')
        break
      case 'host':
        stageOverride.value = mockRoomStatus('host')
        break
      case 'guest':
        stageOverride.value = mockRoomStatus('guest')
        break
    }
  }

  function prevDebugStage(): void {
    if (debugStageIndex.value > 0) applyDebugStage(debugStageIndex.value - 1)
  }

  function nextDebugStage(): void {
    if (debugStageIndex.value < debugStages.value.length - 1) applyDebugStage(debugStageIndex.value + 1)
  }

  function resetLiveStage(): void {
    stageOverride.value = null
    updateDebugStageIndexFromStatus()
  }

  function updateDebugStageIndexFromStatus(): void {
    const mode = status.value.mode
    if (mode === 'idle') debugStageIndex.value = hostStep.value === 2 ? stageIndex('create-port') : stageIndex('idle')
    else if (mode === 'starting') debugStageIndex.value = stageIndex('starting')
    else if (mode === 'host') debugStageIndex.value = stageIndex('host')
    else if (mode === 'guest') debugStageIndex.value = stageIndex('guest')
  }

  const displayStatus = computed<ConnectorStatus>(() => {
    if (flowDebug.value && stageOverride.value) return stageOverride.value
    return status.value
  })

  const displayHostStep = computed<1 | 2>(() =>
    flowDebug.value && stageOverride.value ? hostStepOverride.value : hostStep.value
  )

  const displayDetectedPort = computed<number | null>(() => {
    if (flowDebug.value && stageOverride.value && hostStepOverride.value === 2) return detectedPort.value ?? 25565
    return detectedPort.value
  })

  const displayScanning = computed<boolean>(() => {
    if (flowDebug.value && stageOverride.value) return false
    return scanning.value
  })

  return {
    flowDebug,
    debugStageIndex,
    stageOverride,
    debugStages,
    displayStatus,
    displayHostStep,
    displayDetectedPort,
    displayScanning,
    applyDebugStage,
    prevDebugStage,
    nextDebugStage,
    resetLiveStage,
    updateDebugStageIndexFromStatus,
    stageIndex,
  }
}
