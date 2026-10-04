import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import type { MicrosoftLoginStage } from '@/types/accounts'
import MicrosoftLoginModal from './MicrosoftLoginModal.vue'

let wrapper: VueWrapper
function mountDialog(
  status: 'pending' | 'loading' | 'error' = 'pending',
  stage: MicrosoftLoginStage = 'waiting_authorization'
) {
  wrapper = mount(MicrosoftLoginModal, {
    props: {
      visible: true,
      parentId: 'account-management',
      status,
      stage,
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://microsoft.com/link',
      copied: false,
      error: '',
    },
    global: {
      plugins: [i18n],
      stubs: {
        Modal: {
          name: 'Modal',
          props: ['visible', 'parentId', 'closable'],
          template: '<div><slot /><footer><slot name="footer" /></footer></div>',
        },
      },
    },
  })
  return wrapper
}

describe('Microsoft login dialog', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })
  afterEach(() => wrapper?.unmount())

  it('offers code copying, browser opening and cancellation during authorization', async () => {
    mountDialog()
    expect(wrapper.get('code').text()).toBe('ABCD-EFGH')
    expect(wrapper.get('h4').text()).toBe('在浏览器中完成授权')
    const buttons = wrapper.findAll('button')
    await wrapper.get('button[aria-label="复制代码"]').trigger('click')
    await buttons.find((button) => button.text() === '打开授权页面')!.trigger('click')
    await buttons.find((button) => button.text() === '取消')!.trigger('click')
    expect(wrapper.emitted('copyCode')).toHaveLength(1)
    expect(wrapper.emitted('openBrowser')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.getComponent({ name: 'Modal' }).props('parentId')).toBe('account-management')
  })

  it.each([
    ['profile', '正在读取 Minecraft 档案', 1],
    ['saving', '正在保存账户', 2],
    ['completed', '账户登录完成', 3],
  ] as const)('shows the current %s stage and completed steps', (stage, heading, completed) => {
    mountDialog('loading', stage)
    expect(wrapper.get('h4').text()).toBe(heading)
    expect(wrapper.findAll('.is-complete')).toHaveLength(completed)
    expect(wrapper.findAll('[aria-current="step"]')).toHaveLength(stage === 'completed' ? 0 : 1)
    expect(wrapper.find('code').exists()).toBe(false)
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['取消'])
  })

  it('keeps backend error details visible with a cancellation action', async () => {
    mountDialog('error')
    await wrapper.setProps({ error: '网络连接中断' })
    expect(wrapper.text()).toContain('网络连接中断')
    expect(wrapper.find('.microsoft-login-steps').exists()).toBe(false)
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['取消'])
  })
})
