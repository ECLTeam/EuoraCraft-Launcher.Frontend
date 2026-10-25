import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { i18n } from '@/i18n'
import type { InstanceExportPreview } from '@/types/instanceExport'
import InstanceExportModal from './InstanceExportModal.vue'

enableAutoUnmount(afterEach)
const fileId = '1'.repeat(64)
const preview: InstanceExportPreview = {
  sourceRevision: 'a'.repeat(64),
  versionId: 'Demo',
  isolated: true,
  dependencies: { minecraft: '1.21.1' },
  excludedCount: 1,
  files: [{ fileId, path: 'mods/example.jar', size: 100, category: 'mods', recommended: true }],
}
const store = reactive({
  visible: true,
  displayName: 'Demo',
  error: '',
  preview,
  scanOperationId: '',
  exportOperationId: '',
  scanOperation: undefined,
  exportOperation: undefined,
  selectedFileIds: [fileId],
  selectedBytes: 100,
  hasPersonalFiles: false,
  packName: 'Demo',
  packVersion: '1.0.0',
  summary: '',
  resourceMode: 'references',
  search: '',
  isSubmitting: false,
  isPreparing: false,
  isExporting: false,
  canExport: true,
  result: null,
  close: vi.fn(),
  detach: vi.fn(),
  scan: vi.fn(),
  selectAll: vi.fn(),
  setSelection: vi.fn(),
  selectCategory: vi.fn(),
  submit: vi.fn(),
  cancelExport: vi.fn(),
})
vi.mock('@/features/instances/stores/instanceExportStore', () => ({ useInstanceExportStore: () => store }))
vi.mock('@/features/operations/stores/applicationOperationStore', () => ({
  useApplicationOperationStore: () => ({ queryErrors: {}, cancellingOperations: [], refresh: vi.fn() }),
}))

function render() {
  return mount(InstanceExportModal, {
    global: {
      plugins: [i18n],
      stubs: {
        FullscreenModal: { props: ['visible'], template: '<section v-if="visible" role="dialog"><slot /></section>' },
        // naive-ui 的树组件名是 Tree，按导入名 NTree 声明 stub 不会命中；保留组件名以便按 NTree 查找。
        Tree: {
          name: 'NTree',
          props: ['data', 'checkedKeys'],
          emits: ['update:checkedKeys'],
          template: '<div class="tree" />',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.global.locale.value = 'zh-CN'
  store.hasPersonalFiles = false
  store.isSubmitting = false
})

it('文件树接收服务器文件身份，只有点击导出才提交', async () => {
  const wrapper = render()
  expect(wrapper.text()).toContain('Demo')
  expect(wrapper.text()).toContain('原始大小')
  expect(store.submit).not.toHaveBeenCalled()
  const tree = wrapper.getComponent({ name: 'NTree' })
  expect(tree.props('checkedKeys')).toEqual([fileId])
  tree.vm.$emit('update:checkedKeys', [])
  expect(store.setSelection).toHaveBeenCalledWith([])
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '导出')!
    .trigger('click')
  expect(store.submit).toHaveBeenCalledOnce()
})

it('选择个人数据后提示分享影响，提交期间关闭按钮不可用', async () => {
  store.hasPersonalFiles = true
  store.isSubmitting = true
  const wrapper = render()
  expect(wrapper.text()).toContain('可能含个人信息')
  const close = wrapper.get('button[aria-label="关闭"]')
  expect(close.attributes('disabled')).toBeDefined()
})
