import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import type { MicrosoftLoginStage } from '@/types/accounts'
import MicrosoftLoginPanel from './MicrosoftLoginPanel.vue'

let wrapper: VueWrapper
function mountPanel(
  status: 'pending' | 'loading' | 'error' = 'pending',
  stage: MicrosoftLoginStage = 'waiting_authorization'
) {
  wrapper = mount(MicrosoftLoginPanel, {
    props: {
      status,
      stage,
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://microsoft.com/link',
      copied: false,
      error: '',
    },
    global: {
      plugins: [i18n],
    },
  })
  return wrapper
}

describe('Microsoft login panel', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
  })
  afterEach(() => wrapper?.unmount())

  it('shows authorization code and copying without creating another dialog', async () => {
    mountPanel()
    expect(wrapper.get('code').text()).toBe('ABCD-EFGH')
    expect(wrapper.get('h4').text()).toBe('在浏览器中完成授权')
    await wrapper.get('button[aria-label="复制代码"]').trigger('click')
    expect(wrapper.emitted('copyCode')).toHaveLength(1)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it.each([
    ['profile', '正在读取 Minecraft 档案', 1],
    ['saving', '正在保存账户', 2],
    ['completed', '账户登录完成', 3],
  ] as const)('shows the current %s stage and completed steps', (stage, heading, completed) => {
    mountPanel('loading', stage)
    expect(wrapper.get('h4').text()).toBe(heading)
    expect(wrapper.findAll('.is-complete')).toHaveLength(completed)
    expect(wrapper.findAll('[aria-current="step"]')).toHaveLength(stage === 'completed' ? 0 : 1)
    expect(wrapper.find('code').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('keeps backend error details visible', async () => {
    mountPanel('error')
    await wrapper.setProps({ error: '网络连接中断' })
    expect(wrapper.text()).toContain('网络连接中断')
    expect(wrapper.find('.microsoft-login-steps').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(0)
  })
})
