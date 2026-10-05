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
})
