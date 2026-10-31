import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import ToolsTab from './ToolsTab.vue'
const commands = vi.hoisted(() =>
  vi.fn(async (_name: string) => ({ success: true, data: { downloadDirectory: 'D:/QA', userAgent: 'QA' } }))
)
vi.mock('@/api/client', () => ({ default: { command: commands } }))
it('组合两张工具卡片，进入页面只读取下载默认值', async () => {
  const wrapper = mount(ToolsTab, { global: { plugins: [i18n] } })
  await flushPromises()
  expect(wrapper.findAll('.tools-grid > .ui-card').map((card) => card.get('.title-text').text())).toEqual([
    '自定义下载',
    '皮肤头像裁剪',
  ])
  expect(commands.mock.calls.map(([name]) => name)).toEqual(['custom_download_defaults'])
  wrapper.unmount()
})
