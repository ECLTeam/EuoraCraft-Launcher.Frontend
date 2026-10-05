import { mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import InstanceInstallModal from './InstanceInstallModal.vue'

const loaders = [
  { value: 'vanilla', label: '原版', icon: 'cube', image: '/img/item/grass.png' },
  { value: 'fabric', label: 'Fabric', icon: 'lab', image: '/img/item/fabric.png' },
  { value: 'forge', label: 'Forge', icon: 'fire', image: '/img/item/forge.png' },
  { value: 'neoforge', label: 'NeoForge', icon: 'fire', image: '/img/item/neoforge.png' },
  { value: 'quilt', label: 'Quilt', icon: 'grid', image: '/img/item/quilt.png' },
]

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(InstanceInstallModal, {
    global: {
      plugins: [i18n],
      stubs: { Teleport: true },
    },
    props: {
      visible: true,
      mcVersion: '1.21.5',
      versionTypeLabel: '正式版',
      versionImage: '/img/item/grass.png',
      versionName: '',
      defaultVersionName: '1.21.5',
      loader: 'vanilla',
      loaderVersion: '',
      loaderVersionOptions: [],
      loaderVersionsLoading: false,
      fabricApiVersion: '',
      fabricApiVersionOptions: [],
      fabricApiVersionsLoading: false,
      gamePath: 'D:/Minecraft',
      gamePaths: [{ value: 'D:/Minecraft', label: 'Minecraft' }],
      loaders,
      isSubmittingInstall: false,
      ...overrides,
    },
  })
}

describe('InstanceInstallModal', () => {
  it('renders the version and loader item images', () => {
    const wrapper = mountModal()

    expect(wrapper.get('.install-version-icon img').attributes('src')).toBe('/img/item/grass.png')
    expect(wrapper.findAll('.install-loader-card')).toHaveLength(5)
    expect(wrapper.get('img[src="/img/item/forge.png"]').attributes('alt')).toBe('Forge')
  })

  it('emits loader selection and install actions', async () => {
    const wrapper = mountModal()

    await wrapper.findAll('.install-loader-card')[2]?.trigger('click')
    const installButton = wrapper.findAll('button').find((button) => button.text().includes('开始安装'))
    await installButton?.trigger('click')

    expect(wrapper.emitted('selectLoader')).toContainEqual(['forge'])
    expect(wrapper.emitted('install')).toHaveLength(1)
  })

  it('shows fabric api version dropdown beside loader version when fabric is selected', () => {
    const wrapper = mountModal({
      loader: 'fabric',
      loaderVersionOptions: [
        { label: '默认安装最新版本', value: '' },
        { label: '0.16.14', value: '0.16.14' },
      ],
      fabricApiVersionOptions: [
        { label: '默认安装最新版本', value: '' },
        { label: '0.119.2', value: '0.119.2' },
      ],
    })

    const labels = wrapper.findAll('.install-field > span').map((node) => node.text())
    expect(labels).toContain('加载器版本')
    expect(labels).toContain('Fabric API 版本')
  })

  it('emits fabric api version updates', async () => {
    const wrapper = mountModal({ loader: 'fabric' })

    const fabricApiField = wrapper.findAll('.install-field')[3]
    const fabricApiSelect = fabricApiField?.findComponent(NSelect)
    fabricApiSelect?.vm.$emit('update:value', '0.119.2')

    expect(wrapper.emitted('update:fabricApiVersion')).toContainEqual(['0.119.2'])
  })
})
