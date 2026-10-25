import { beforeEach, describe, expect, it, vi } from 'vitest'
import { globalProcessInstances as inst } from './useProcessInstances'

const hoisted = vi.hoisted(() => {
  const getInstancesMock = vi.fn()
  const sendInputMock = vi.fn()
  const stopMock = vi.fn()
  return { getInstancesMock, sendInputMock, stopMock }
})

vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  return createMockBackend().backend
})

vi.mock('../api/terminalApi', () => ({
  terminalApi: {
    getProcessInstances: hoisted.getInstancesMock,
    sendProcessInput: hoisted.sendInputMock,
    stopProcess: hoisted.stopMock,
  },
}))

function sampleInstance(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `proc-${id}`,
    type: 'plugin:test',
    pid: 123,
    stdin: true,
    running: true,
    lines: [],
    ...overrides,
  }
}

describe('useProcessInstances 子进程实例状态', () => {
  beforeEach(() => {
    inst.dispose()
    inst.sessions.value = []
    inst.outputByProcessId.value = {}
    inst.selectedProcessId.value = null
    inst.loading.value = false
    hoisted.getInstancesMock.mockReset()
    hoisted.getInstancesMock.mockResolvedValue([])
    hoisted.sendInputMock.mockReset()
    hoisted.stopMock.mockReset()
  })

  it('历史上限保护当前选中会话和活跃进程，切换后回收旧历史', () => {
    inst.syncList([sampleInstance('selected')])
    inst.select('selected')
    inst.syncList([])
    for (let index = 0; index < 30; index++) {
      inst.syncList([sampleInstance(`exit-${index}`), sampleInstance('active')])
    }
    inst.syncList([sampleInstance('active')])
    expect(inst.sessions.value.filter((session) => !session.isRunning)).toHaveLength(20)
    expect(inst.selectedProcessId.value).toBe('selected')
    expect(inst.sessions.value.some((session) => session.processId === 'active')).toBe(true)
    inst.select('active')
    expect(inst.sessions.value.length).toBeLessThanOrEqual(21)
  })

  it('refresh 拉取快照并初始化输出，未选中时自动选第一个', async () => {
    const a = sampleInstance('a', { lines: ['line-1'] })
    hoisted.getInstancesMock.mockResolvedValue([a])
    await inst.refresh()
    expect(inst.sessions.value).toHaveLength(1)
    expect(inst.outputByProcessId.value.a).toEqual(['line-1'])
    expect(inst.selectedProcessId.value).toBe('a')
  })

  it('onLog 按实例追加输出并裁剪到上限', () => {
    inst.syncList([sampleInstance('a')])
    const limit = 300
    for (let i = 0; i < limit + 5; i++) {
      inst.onLog({ instanceId: 'a', name: 'proc-a', type: 'plugin:test', line: `row-${i}` })
    }
    expect(inst.outputByProcessId.value.a).toHaveLength(limit)
    expect(inst.outputByProcessId.value.a?.[0]).toBe('row-5')
    expect(inst.outputByProcessId.value.a?.[limit - 1]).toBe(`row-${limit + 4}`)
  })

  it('select 切换选中实例并暴露其输出', () => {
    inst.syncList([sampleInstance('a'), sampleInstance('b', { std_in: false })])
    inst.select('b')
    inst.onLog({ instanceId: 'b', name: 'proc-b', type: 'plugin:test', line: 'hello' })
    expect(inst.selectedProcessId.value).toBe('b')
    expect(inst.selectedOutput.value).toContain('hello')
  })

  it('sendInput 仅在 stdin 且运行中时发送，否则返回 false', async () => {
    const a = sampleInstance('a', { stdin: true, running: true })
    inst.syncList([a])
    inst.select('a')
    hoisted.sendInputMock.mockResolvedValue(true)
    await expect(inst.sendInput('hello')).resolves.toBe(true)
    expect(hoisted.sendInputMock).toHaveBeenCalledWith('a', 'hello')

    inst.syncList([sampleInstance('a', { stdin: false, running: true })])
    await expect(inst.sendInput('x')).resolves.toBe(false)
    expect(hoisted.sendInputMock).toHaveBeenCalledTimes(1)
  })

  it('stop 转发给后端停止接口', async () => {
    hoisted.stopMock.mockResolvedValue(true)
    await inst.stop('a', true)
    expect(hoisted.stopMock).toHaveBeenCalledWith('a', true)
  })

  it('退出后保留名称、选择与输出，多次空快照和迟到日志仍可查看', () => {
    inst.syncList([sampleInstance('a'), sampleInstance('b')])
    inst.onLog({ instanceId: 'a', name: 'proc-a', type: 'plugin:test', line: 'a-1' })
    inst.onLog({ instanceId: 'b', name: 'proc-b', type: 'plugin:test', line: 'b-1' })
    inst.select('a')
    inst.syncList([sampleInstance('b')])
    // a 被移除但选中保留其输出
    expect(inst.outputByProcessId.value.a).toEqual(['a-1'])
    // b 仍存在，输出保留
    expect(inst.outputByProcessId.value.b).toEqual(['b-1'])
    // 选中项 a 已不在列表，selection 复位
    expect(inst.selectedProcessId.value).toBe('a')
    expect(inst.active()?.isRunning).toBe(false)
    inst.syncList([])
    inst.syncList([])
    inst.onLog({ instanceId: 'a', name: 'proc-a', type: 'plugin:test', line: 'final line' })
    expect(inst.selectedOutput.value).toEqual(['a-1', 'final line'])
    expect(inst.sessions.value).toHaveLength(2)
  })

  it('移除选中的停止记录时清理输出并优先选择运行会话', () => {
    inst.syncList([
      sampleInstance('old', { running: false, lines: ['old output'] }),
      sampleInstance('stopped', { running: false }),
      sampleInstance('running'),
    ])
    inst.select('old')
    expect(inst.removeStopped('old')).toBe(true)
    expect(inst.sessions.value.map((session) => session.processId)).toEqual(['stopped', 'running'])
    expect(inst.outputByProcessId.value.old).toBeUndefined()
    expect(inst.selectedProcessId.value).toBe('running')
    expect(inst.stoppedCount.value).toBe(1)
    expect(hoisted.stopMock).not.toHaveBeenCalled()
    expect(inst.removeStopped('old')).toBe(false)
  })

  it('运行中和待确认会话不能移除，批量清除仅影响已确认停止记录', () => {
    inst.syncList([sampleInstance('stopped', { running: false }), sampleInstance('running')])
    inst.onLog({ instanceId: 'unknown', name: 'pending', type: 'Minecraft', line: 'waiting' })
    expect(inst.removeStopped('running')).toBe(false)
    expect(inst.removeStopped('unknown')).toBe(false)
    expect(inst.clearStopped()).toBe(1)
    expect(inst.sessions.value.map((session) => session.processId)).toEqual(['running', 'unknown'])
    expect(inst.selectedProcessId.value).toBe('running')
    expect(inst.outputByProcessId.value.unknown).toEqual(['waiting'])
    expect(inst.clearStopped()).toBe(0)
    expect(hoisted.stopMock).not.toHaveBeenCalled()
  })

  it('没有运行会话时选相邻记录，清空后复位选择与输出', () => {
    inst.syncList([sampleInstance('first', { running: false }), sampleInstance('next', { running: false })])
    inst.removeStopped('first')
    expect(inst.selectedProcessId.value).toBe('next')
    expect(inst.clearStopped()).toBe(1)
    expect(inst.selectedProcessId.value).toBeNull()
    expect(inst.selectedOutput.value).toEqual([])
    expect(inst.sessions.value).toEqual([])
    expect(inst.outputByProcessId.value).toEqual({})
  })

  it('移除未选中记录不会切换选择，迟到日志和停止快照不会恢复历史', () => {
    inst.syncList([sampleInstance('selected'), sampleInstance('removed', { running: false })])
    inst.select('selected')
    inst.removeStopped('removed')
    inst.onLog({ instanceId: 'removed', name: 'removed', type: 'Minecraft', line: 'late' })
    inst.syncList([sampleInstance('selected'), sampleInstance('removed', { running: false, lines: ['stale'] })])
    expect(inst.selectedProcessId.value).toBe('selected')
    expect(inst.sessions.value.map((session) => session.processId)).toEqual(['selected'])
    expect(inst.outputByProcessId.value.removed).toBeUndefined()
    inst.syncList([sampleInstance('selected'), sampleInstance('removed')])
    inst.onLog({ instanceId: 'removed', name: 'removed', type: 'Minecraft', line: 'running output' })
    expect(inst.sessions.value.find((session) => session.processId === 'removed')?.isRunning).toBe(true)
    expect(inst.outputByProcessId.value.removed).toEqual(['running output'])
  })

  it('移除前发起的刷新不能恢复旧记录或旧运行状态', async () => {
    inst.syncList([sampleInstance('removed', { running: false })])
    let finish!: (instances: ReturnType<typeof sampleInstance>[]) => void
    hoisted.getInstancesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = inst.refresh()
    inst.removeStopped('removed')
    finish([sampleInstance('removed')])
    await pending
    expect(inst.sessions.value).toEqual([])
    expect(inst.outputByProcessId.value.removed).toBeUndefined()
    expect(inst.loading.value).toBe(false)
  })

  it('批量清除的记录也屏蔽迟到事件，应用释放后清理移除标记', () => {
    inst.syncList([sampleInstance('cleared', { running: false })])
    inst.clearStopped()
    inst.onLog({ instanceId: 'cleared', name: 'cleared', type: 'Minecraft', line: 'late' })
    expect(inst.sessions.value).toEqual([])
    inst.dispose()
    inst.syncList([sampleInstance('cleared', { running: false })])
    expect(inst.sessions.value).toHaveLength(1)
  })
})
