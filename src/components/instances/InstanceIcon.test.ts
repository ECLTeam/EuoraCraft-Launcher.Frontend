import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { UiIcon } from '@/components/ui'
import InstanceIcon from './InstanceIcon.vue'

vi.mock('@/api/client', () => ({
  default: {
    file: {
      toUrl: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
    },
  },
}))

describe('InstanceIcon', () => {
  it('falls back to loader icon when local image fails', async () => {
    const wrapper = mount(InstanceIcon, {
      props: {
        source: {
          icon: { type: 'local', value: 'icon.png' },
          primaryLoader: 'Forge',
          versionType: 'release',
        },
        size: 32,
      },
    })

    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.findComponent(UiIcon).exists()).toBe(false)

    await wrapper.find('img').trigger('error')
    await flushPromises()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findComponent(UiIcon).exists()).toBe(true)
    wrapper.unmount()
  })
})
