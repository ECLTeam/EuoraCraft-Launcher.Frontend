import { computed, ref } from 'vue'
import backend from '@/api/client'
import type { ProcessInstance, ProcessLogEntry, TerminalSession } from '@/types/system'
import { terminalApi } from '../api/terminalApi'

const sessionLineLimit = 300
const stoppedSessionLimit = 20
const sessions = ref<TerminalSession[]>([])
const outputByProcessId = ref<Record<string, string[]>>({})
const selectedProcessId = ref<string | null>(null)
const loading = ref(false)
const stoppedOrderById = new Map<string, number>()
const evictedProcessIds: string[] = []
let stoppedOrder = 0
let initialized = false
let generation = 0
let snapshotRevision = 0
let refreshRevision = 0
let offLog: (() => void) | null = null
let offChanged: (() => void) | null = null

function trim(lines: string[]): void {
  if (lines.length > sessionLineLimit) lines.splice(0, lines.length - sessionLineLimit)
}

function reclaimStoppedSessions(): void {
  const stopped = sessions.value
    .filter((session) => session.state !== 'running')
    .sort((a, b) => (stoppedOrderById.get(a.processId) ?? 0) - (stoppedOrderById.get(b.processId) ?? 0))
  let excess = stopped.length - stoppedSessionLimit
  for (const session of stopped) {
    if (excess <= 0) break
    if (session.processId === selectedProcessId.value) continue
    sessions.value = sessions.value.filter((item) => item.processId !== session.processId)
    delete outputByProcessId.value[session.processId]
    stoppedOrderById.delete(session.processId)
    evictedProcessIds.push(session.processId)
    if (evictedProcessIds.length > 64) evictedProcessIds.shift()
    excess--
  }
}

function onLog(entry: ProcessLogEntry): void {
  if (evictedProcessIds.includes(entry.instanceId)) return
  if (!sessions.value.some((session) => session.processId === entry.instanceId)) {
    stoppedOrderById.set(entry.instanceId, ++stoppedOrder)
    sessions.value.push({
      processId: entry.instanceId,
      name: entry.name,
      type: entry.type,
      pid: null,
      stdin: false,
      isRunning: false,
      state: 'unknown',
    })
  }
  const lines = outputByProcessId.value[entry.instanceId] ?? (outputByProcessId.value[entry.instanceId] = [])
  lines.push(entry.line)
  trim(lines)
  reclaimStoppedSessions()
}

function syncList(list: ProcessInstance[]): void {
  snapshotRevision++
  const byId = new Map(sessions.value.map((session) => [session.processId, session]))
  const incoming = new Set(list.map((item) => item.id))
  for (const item of list) {
    byId.set(item.id, {
      processId: item.id,
      name: item.name,
      type: item.type,
      pid: item.pid,
      stdin: item.stdin,
      isRunning: item.running,
      state: item.running ? 'running' : 'stopped',
    })
    if (!outputByProcessId.value[item.id]) {
      outputByProcessId.value[item.id] = [...item.lines]
      trim(outputByProcessId.value[item.id]!)
    }
    if (item.running) stoppedOrderById.delete(item.id)
  }
  for (const session of byId.values()) {
    if (!incoming.has(session.processId)) {
      session.isRunning = false
      session.state = 'stopped'
    }
    if (session.state === 'stopped' && !stoppedOrderById.has(session.processId))
      stoppedOrderById.set(session.processId, ++stoppedOrder)
  }
  sessions.value = [...byId.values()]
  reclaimStoppedSessions()
  if (!selectedProcessId.value && sessions.value.length) selectedProcessId.value = sessions.value[0]!.processId
}

async function refresh(): Promise<void> {
  const requestGeneration = generation
  const listRevision = snapshotRevision
  const requestRevision = ++refreshRevision
  loading.value = true
  try {
    const list = await terminalApi.getProcessInstances()
    if (requestGeneration === generation && requestRevision === refreshRevision && listRevision === snapshotRevision)
      syncList(list)
  } finally {
    if (requestGeneration === generation && requestRevision === refreshRevision) loading.value = false
  }
}

function select(processId: string): void {
  if (sessions.value.some((session) => session.processId === processId)) selectedProcessId.value = processId
  reclaimStoppedSessions()
}
function active(): TerminalSession | null {
  return sessions.value.find((item) => item.processId === selectedProcessId.value) ?? null
}
const selectedOutput = computed(() =>
  selectedProcessId.value ? (outputByProcessId.value[selectedProcessId.value] ?? []) : []
)

async function sendInput(text: string): Promise<boolean> {
  const session = active()
  if (!session?.stdin || !session.isRunning) return false
  return terminalApi.sendProcessInput(session.processId, text)
}
async function stop(processId: string, force = false): Promise<void> {
  if (sessions.value.find((session) => session.processId === processId)?.state === 'stopped') return
  await terminalApi.stopProcess(processId, force)
}

function init(): void {
  if (initialized) return
  initialized = true
  const currentGeneration = ++generation
  offLog = backend.on('process:instance_log', (entry) => {
    if (initialized && generation === currentGeneration) onLog(entry)
  })
  offChanged = backend.on('process:instances_changed', (list) => {
    if (initialized && generation === currentGeneration) syncList(list)
  })
  void refresh().catch((error) => console.warn('读取进程会话失败', error))
}
function dispose(): void {
  generation++
  initialized = false
  offLog?.()
  offChanged?.()
  offLog = null
  offChanged = null
  loading.value = false
}

const controller = {
  sessions,
  outputByProcessId,
  selectedProcessId,
  loading,
  selectedOutput,
  onLog,
  syncList,
  refresh,
  select,
  active,
  sendInput,
  stop,
  init,
  dispose,
}
/** 应用会话中的终端控制器；运行快照消失后保留有界的已退出会话。 */
export function useProcessInstances() {
  return controller
}
export const globalProcessInstances = controller
