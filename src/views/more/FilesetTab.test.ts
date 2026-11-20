import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UiIcon } from '@/components/ui'
import { i18n } from '@/i18n'
import type { FileSetItem } from '@/types/fileset'
import FilesetTab from './FilesetTab.vue'

const listMock = vi.fn<() => Promise<FileSetItem[]>>()
const thumbnailMock = vi.fn<(id: string) => Promise<{ path: string | null; url: string | null }>>()

vi.mock('@/features/fileset/api/filesetApi', () => ({
  filesetApi: {
    list: () => listMock(),
    thumbnail: (id: string) => thumbnailMock(id),
    resolve: vi.fn(async () => ({ path: '', url: '', kind: 'video' })),
    selectFiles: vi.fn(async () => []),
    importFiles: vi.fn(async () => ({ imported: [], duplicated: [], failed: [] })),
    rename: vi.fn(),
    remove: vi.fn(async () => ({ deleted: [], inUse: [] })),
  },
}))

function makeItem(overrides: Partial<FileSetItem>): FileSetItem {
  return {
    id: 'item-1',
    kind: 'image',
    name: '示例图片',
    sha256: 'a'.repeat(64),
    extension: '.png',
    byteSize: 2048,
    width: 1920,
    height: 1080,
    createdAt: '2026-11-20T00:00:00Z',
    updatedAt: '2026-11-20T00:00:00Z',
    ...overrides,
  }
}

function mountTab() {
  // UiButton 依赖 UiIcon 的全局注册（main.ts 里注册），测试里补一份避免解析告警。
  return mount(FilesetTab, { global: { plugins: [i18n], components: { UiIcon } } })
}

describe('文件集页面', () => {
  beforeEach(() => {
    listMock.mockReset()
    thumbnailMock.mockReset()
    thumbnailMock.mockResolvedValue({ path: null, url: 'blob:thumb' })
  })

  it('有条目时在面板内渲染卡片，并标注文件类型', async () => {
    listMock.mockResolvedValue([
      makeItem({ id: 'item-1', name: '背景图' }),
      makeItem({ id: 'item-2', name: '封面图', byteSize: 4096 }),
      makeItem({
        id: 'item-3',
        name: '开场动画',
        kind: 'video',
        extension: '.mp4',
        byteSize: 3_000_000,
        width: null,
        height: null,
      }),
    ])
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('.fileset-panel.ecl-surface').exists()).toBe(true)
    expect(wrapper.findAll('.fileset-card')).toHaveLength(3)
    expect(wrapper.text()).toContain('背景图')
    expect(wrapper.text()).toContain('PNG · 1920×1080 · 2 KB')
    expect(wrapper.text()).toContain('PNG · 1920×1080 · 4 KB')
    expect(wrapper.text()).toContain('MP4 · 2.9 MB')
    // 视频才有角标，图片不显示
    expect(wrapper.findAll('.fileset-kind')).toHaveLength(1)
    wrapper.unmount()
  })

  it('没有条目时在面板内显示空状态', async () => {
    listMock.mockResolvedValue([])
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('.fileset-panel.ecl-surface').exists()).toBe(true)
    expect(wrapper.find('.ui-empty-state').exists()).toBe(true)
    expect(wrapper.findAll('.fileset-card')).toHaveLength(0)
    wrapper.unmount()
  })
})
