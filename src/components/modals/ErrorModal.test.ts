import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import type { BackendMockState } from '@/test/mockBackend'
import ErrorModal from './ErrorModal.vue'
import errorModalSource from './ErrorModal.vue?raw'

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))
const mock = vi.hoisted<{ state?: BackendMockState }>(() => ({ state: undefined }))
vi.mock('@/api/client', async () => {
  const { createMockBackend } = await import('@/test/mockBackend')
  mock.state = createMockBackend()
  return mock.state.backend
})
vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: mocks.success, error: mocks.error }),
}))

const { mocks: backendMocks } = mock.state!

describe('ErrorModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the correlated error id and detail', () => {
    const wrapper = mount(ErrorModal, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: {
        visible: true,
        title: 'Storage error',
        message: 'Unable to save data',
        detail: 'Safe detail',
        errorId: 'error-123',
      },
    })

    const overlay = document.body.querySelector<HTMLElement>('.modal-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.style.display).not.toBe('none')
    expect(errorModalSource).toContain('<Modal')
    expect(errorModalSource).not.toContain('<Teleport')
    expect(document.body.textContent).toContain('error-123')
    expect(document.body.textContent).toContain('Safe detail')
    wrapper.unmount()
  })

  it('renders structured game crash reasons, evidence, and actions', () => {
    const wrapper = mount(ErrorModal, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: {
        visible: true,
        title: 'Minecraft crash',
        message: 'Instance exited with code 1',
        errorId: 'a'.repeat(32),
        kind: 'game_crash',
        crash: {
          reportId: 'a'.repeat(32),
          versionId: '1.21.8-Fabric',
          exitCode: 1,
          detectedBy: ['exit_code'],
          reasons: [
            {
              code: 'mod.missing_dependency',
              confidence: 'certain',
              evidence: ['depends on example-lib which is missing'],
              parameters: { target_mod: 'example-lib' },
              mods: ['Example Mod'],
            },
          ],
          sourceFiles: ['latest.log'],
          hasOutput: true,
        },
      },
    })

    expect(document.body.textContent).toContain('1.21.8-Fabric')
    expect(document.body.textContent).toContain('模组依赖缺失')
    expect(document.body.textContent).toContain('depends on example-lib which is missing')
    expect(document.body.textContent).toContain('可疑模组')
    expect(document.body.textContent).toContain('Example Mod')
    expect(document.body.textContent).toContain('查看输出')
    expect(document.body.textContent).toContain('导出崩溃报告')
    wrapper.unmount()
  })

  it('loads output on demand and exports the crash report', async () => {
    backendMocks.command.mockImplementation(async (command: string) => {
      if (command === 'game_crash_output') {
        return { success: true, data: { name: 'game-output.log', content: 'captured game output' } }
      }
      if (command === 'select_save_file') {
        return { success: true, data: { path: 'D:/Reports/crash.zip' } }
      }
      return { success: true, data: { path: 'D:/Reports/crash.zip' } }
    })
    const wrapper = mount(ErrorModal, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: {
        visible: true,
        kind: 'game_crash',
        message: 'Crashed',
        errorId: 'c'.repeat(32),
        crash: {
          reportId: 'c'.repeat(32),
          versionId: 'Test',
          exitCode: 1,
          detectedBy: ['exit_code'],
          reasons: [],
          sourceFiles: [],
          hasOutput: true,
        },
      },
    })

    const outputButton = [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('查看输出')
    )
    outputButton?.click()
    await flushPromises()
    expect(document.body.textContent).toContain('captured game output')

    const exportButton = [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('导出崩溃报告')
    )
    exportButton?.click()
    await flushPromises()
    expect(backendMocks.command).toHaveBeenCalledWith('select_save_file', { purpose: 'crash-report' })
    expect(backendMocks.command).toHaveBeenCalledWith('game_crash_export', {
      report_id: 'c'.repeat(32),
      output_path: 'D:/Reports/crash.zip',
    })
    expect(mocks.success).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not export when the save dialog is cancelled', async () => {
    backendMocks.command.mockResolvedValue({ success: true, data: { path: '' } })
    const wrapper = mount(ErrorModal, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { visible: true, message: 'Failure' },
    })

    const exportButton = [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('导出日志')
    )
    exportButton?.click()
    await flushPromises()

    expect(backendMocks.command).toHaveBeenCalledWith('select_save_file', { purpose: 'launcher-logs' })
    expect(backendMocks.command).not.toHaveBeenCalledWith('export_logs', expect.anything())
    expect(mocks.error).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
