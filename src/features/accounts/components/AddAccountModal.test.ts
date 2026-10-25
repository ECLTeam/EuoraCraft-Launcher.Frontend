import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useAccountManager } from '@/composables/useAccountManager'
import { globalModalStack } from '@/composables/useGlobalModalStack'
import { accountsApi } from '@/features/accounts/api/accountsApi'
import { i18n } from '@/i18n'
import AddAccountModal from './AddAccountModal.vue'

vi.mock('@/composables/useLauncherMessage', () => ({
  useLauncherMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

let wrapper: VueWrapper<InstanceType<typeof AddAccountModal>>
let account: ReturnType<typeof useAccountManager>

function activeDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('.modal-overlay[aria-modal="true"]')
  expect(dialog).not.toBeNull()
  return dialog!
}

/** 重新打开要等上一次退场动画真正结束，模态框栈才会把新展示链放回页面。 */
async function reopenedDialog(): Promise<HTMLElement> {
  await vi.waitFor(() => expect(document.querySelector('.modal-overlay[aria-modal="true"]')).not.toBeNull())
  return activeDialog()
}

function choice(index: number): HTMLButtonElement {
  return document.querySelectorAll<HTMLButtonElement>('.account-type-option')[index]!
}

async function settle(): Promise<void> {
  await flushPromises()
  await nextTick()
}

async function openDialog(): Promise<void> {
  wrapper = mount(AddAccountModal, {
    props: {
      account,
      visible: false,
      'onUpdate:visible': (value: boolean) => void wrapper.setProps({ visible: value }),
    },
    attachTo: document.body,
    global: { plugins: [i18n], stubs: { transition: false } },
  })
  await wrapper.setProps({ visible: true })
  await settle()
}

describe('添加账户弹窗', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'zh-CN'
    vi.spyOn(accountsApi, 'onMicrosoftLoginStatus').mockReturnValue(vi.fn())
    account = useAccountManager((key) => key)
    account.microsoftLoginConfig = { available: true, needs_client_id: false }
    account.authlibLoginConfig = { available: true }
    vi.spyOn(account, 'loadMicrosoftLoginConfig').mockResolvedValue(undefined)
    vi.spyOn(account, 'loadAuthlibServers').mockResolvedValue(undefined)
    vi.spyOn(account, 'loadOfflineSkins').mockResolvedValue(undefined)
    vi.spyOn(account, 'startMicrosoftLogin').mockResolvedValue(undefined)
    vi.spyOn(account, 'addOfflineAccount').mockResolvedValue(undefined)
    vi.spyOn(account, 'addAuthlibAccount').mockResolvedValue(undefined)
    vi.spyOn(account, 'selectAuthlibProfile').mockResolvedValue(undefined)
    vi.spyOn(account, 'addPluginAccount').mockResolvedValue(undefined)
    vi.spyOn(account, 'cancelMicrosoftLogin').mockImplementation(async () => {
      account.showMicrosoftLoginModal = false
      account.microsoftLoginStatus = 'pending'
      account.microsoftLoginStage = 'waiting_authorization'
      return true
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    account.reset()
    globalModalStack.reset()
    vi.restoreAllMocks()
  })

  it('选择页仅展示三个入口，不包含表单或额外的登录按钮', async () => {
    await openDialog()
    const dialog = activeDialog()
    expect(dialog.querySelectorAll('.account-type-option')).toHaveLength(3)
    expect(dialog.querySelector('input')).toBeNull()
    expect(dialog.querySelector('.account-form')).toBeNull()
    expect(dialog.textContent).not.toContain(i18n.global.t('game.continueMicrosoftLogin'))
    expect(account.startMicrosoftLogin).not.toHaveBeenCalled()
  })

  it('UUID 自动预览直接显示在输入框内，手动修改与清空保持独立语义', async () => {
    const generated = '5627dd98-e6be-3c21-b8a8-e92344183641'
    const custom = '0123456789abcdef0123456789abcdef'
    vi.spyOn(accountsApi, 'previewOfflineUuid').mockResolvedValue({ player_name: 'Steve', uuid: generated })
    await openDialog()
    choice(1).click()
    await settle()
    expect(activeDialog().querySelector('.offline-advanced-toggle')).toBeNull()
    account.newOfflineUsername = 'Steve'
    await vi.waitFor(() => expect(account.offlineUuidPreview).toBe(generated))
    const input = () => activeDialog().querySelector<HTMLInputElement>('.offline-uuid-field input')!
    expect(input().value).toBe(generated)
    expect(account.newOfflineUuid).toBe('')
    input().value = custom
    input().dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    expect(account.newOfflineUuid).toBe(custom)
    account.newOfflineUsername = 'Alex'
    await settle()
    expect(input().value).toBe(custom)
    vi.mocked(accountsApi.previewOfflineUuid).mockResolvedValue({ player_name: 'Alex', uuid: generated })
    input().value = ''
    input().dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    await vi.waitFor(() => expect(input().value).toBe(generated))
    expect(account.newOfflineUuid).toBe('')
    input().value = 'invalid'
    input().dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    expect(activeDialog().querySelector('.offline-uuid-field small.error')?.textContent).toContain(
      'game.invalidOfflineUuid'
    )
    expect(
      [...activeDialog().querySelectorAll('button')].find((button) =>
        button.textContent?.includes(i18n.global.t('game.addOfflineAccount'))
      )?.disabled
    ).toBe(true)
  })

  it.each([1, 2, 3])('登录入口 %s 在同一个弹窗内切换，返回后恢复选择焦点', async (index) => {
    account.authProviders = [
      {
        id: 'demo',
        title: 'Demo',
        description: '',
        fields: [{ key: 'username', label: 'Username', type: 'text', required: true, placeholder: '' }],
      },
    ]
    await openDialog()
    const selector = activeDialog()
    const trigger = choice(index)
    trigger.focus()
    trigger.click()
    await settle()
    expect(activeDialog()).toBe(selector)
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1)
    expect(globalModalStack.displayedModalIds.value).toHaveLength(1)
    expect(activeDialog().querySelector('input')).not.toBeNull()
    expect(activeDialog().querySelector('.account-type-options')).toBeNull()
    expect(selector.hasAttribute('inert')).toBe(false)
    const back = [...selector.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === i18n.global.t('common.back')
    )!
    back.click()
    await settle()
    expect(activeDialog()).toBe(selector)
    expect(selector.querySelector('.account-type-options')).not.toBeNull()
    expect(document.activeElement).toBe(choice(index))
  })

  it('返回选择不重置表单，Esc 结束整个流程，重新打开回到选择页', async () => {
    await openDialog()
    choice(1).click()
    await settle()
    account.newOfflineUsername = 'KeepPlayer'
    account.newOfflineUuid = '0123456789abcdef0123456789abcdef'
    const back = [...activeDialog().querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === i18n.global.t('common.back')
    )!
    back.click()
    await settle()
    choice(1).click()
    await settle()
    expect(account.newOfflineUsername).toBe('KeepPlayer')
    expect(account.newOfflineUuid).toBe('0123456789abcdef0123456789abcdef')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(wrapper.props('visible')).toBe(false)
    await wrapper.setProps({ visible: true })
    await settle()
    expect((await reopenedDialog()).querySelector('.account-type-options')).not.toBeNull()
    expect(account.newOfflineUuid).toBe('')
  })

  it('直接启动微软授权，准备期间不能重复启动或切换其他方式', async () => {
    let finishStart: () => void = () => undefined
    vi.mocked(account.startMicrosoftLogin).mockImplementation(async () => {
      account.startingMicrosoftLogin = true
      await new Promise<void>((resolve) => {
        finishStart = resolve
      })
      account.startingMicrosoftLogin = false
      account.showMicrosoftLoginModal = true
      return true
    })
    await openDialog()
    const selector = activeDialog()
    choice(0).click()
    choice(0).click()
    choice(1).click()
    await nextTick()
    expect(account.startMicrosoftLogin).toHaveBeenCalledTimes(1)
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('.account-type-option')].every((button) => button.disabled)
    ).toBe(true)
    finishStart()
    await settle()
    expect(activeDialog().querySelector('.microsoft-login-content')).not.toBeNull()
    expect(activeDialog().querySelector('.account-type-options')).toBeNull()
    expect(activeDialog()).toBe(selector)
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1)
    const cancel = [...activeDialog().querySelectorAll('button')].find(
      (button) => button.textContent === i18n.global.t('common.cancel')
    )!
    cancel.click()
    await settle()
    await vi.waitFor(() =>
      expect(document.querySelector('.modal-overlay[aria-modal="true"] .account-type-options')).not.toBeNull()
    )
  })

  it('微软启动失败保留入口，可再次发起', async () => {
    await openDialog()
    choice(0).click()
    await settle()
    expect(wrapper.props('visible')).toBe(true)
    choice(0).click()
    await settle()
    expect(account.startMicrosoftLogin).toHaveBeenCalledTimes(2)
  })

  it('微软账户保存完成后收起选择页', async () => {
    vi.mocked(account.startMicrosoftLogin).mockImplementation(async () => {
      account.showMicrosoftLoginModal = true
      return true
    })
    await openDialog()
    choice(0).click()
    await settle()
    account.microsoftLoginStatus = 'loading'
    account.microsoftLoginStage = 'completed'
    account.completingMicrosoftLogin = true
    await settle()
    expect(wrapper.props('visible')).toBe(true)
    account.showMicrosoftLoginModal = false
    account.completingMicrosoftLogin = false
    await settle()
    expect(wrapper.props('visible')).toBe(false)
  })

  it('微软取消失败保留授权步骤，取消成功后回到选择列表', async () => {
    vi.mocked(account.startMicrosoftLogin).mockImplementation(async () => {
      account.showMicrosoftLoginModal = true
      return true
    })
    vi.mocked(account.cancelMicrosoftLogin).mockResolvedValueOnce(false)
    await openDialog()
    choice(0).click()
    await settle()
    const cancel = () =>
      [...activeDialog().querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === i18n.global.t('common.cancel')
      )!
    cancel().click()
    await settle()
    expect(activeDialog().querySelector('.microsoft-login-content')).not.toBeNull()
    cancel().click()
    await settle()
    expect(activeDialog().querySelector('.account-type-options')).not.toBeNull()
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1)
  })

  it('准备微软授权期间外层关闭再打开，旧准备结果不能替换新的选择页', async () => {
    let finish!: () => void
    vi.mocked(account.startMicrosoftLogin).mockImplementation(async () => {
      account.startingMicrosoftLogin = true
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      account.startingMicrosoftLogin = false
      account.showMicrosoftLoginModal = true
      return true
    })
    await openDialog()
    choice(0).click()
    await settle()
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    finish()
    await settle()
    expect(account.cancelMicrosoftLogin).toHaveBeenCalledOnce()
    expect(wrapper.props('visible')).toBe(true)
    const reopened = await reopenedDialog()
    expect(reopened.querySelector('.account-type-options')).not.toBeNull()
    expect(reopened.querySelector('.microsoft-login-content')).toBeNull()
  })

  it('缺少微软配置时禁用入口并保留配置提示', async () => {
    account.microsoftLoginConfig = { available: false, needs_client_id: true }
    await openDialog()
    expect(choice(0).disabled).toBe(true)
    expect(activeDialog().textContent).toContain('MICROSOFT_CLIENT_ID=your_client_id_here')
    expect(choice(1).disabled).toBe(false)
  })

  it('离线提交期间阻止连续回车，失败后保留表单并允许重试', async () => {
    let finishAdd: () => void = () => undefined
    vi.mocked(account.addOfflineAccount).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishAdd = resolve
        })
    )
    await openDialog()
    choice(1).click()
    await settle()
    const input = activeDialog().querySelector('input')!
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(account.addOfflineAccount).toHaveBeenCalledTimes(1)
    const back = [...activeDialog().querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === i18n.global.t('common.back')
    )!
    expect(back.disabled).toBe(true)
    back.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(activeDialog().querySelector('input')).toBe(input)
    finishAdd()
    await settle()
    expect(wrapper.props('visible')).toBe(true)
    vi.mocked(account.addOfflineAccount).mockImplementation(async () => {
      account.accounts = [{ id: 'offline-player', alias: 'Player', type: 'offline', isCurrent: true }]
    })
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await settle()
    expect(account.addOfflineAccount).toHaveBeenCalledTimes(2)
    expect(wrapper.props('visible')).toBe(false)
  })

  it('旧表单提交完成不关闭外层重新打开的添加流程', async () => {
    let finish!: () => void
    vi.mocked(account.addOfflineAccount).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      account.accounts = [{ id: 'old-flow', alias: 'Player', type: 'offline', isCurrent: true }]
    })
    await openDialog()
    choice(1).click()
    await settle()
    activeDialog()
      .querySelector('input')!
      .dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await settle()
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    finish()
    await settle()
    expect(wrapper.props('visible')).toBe(true)
    expect((await reopenedDialog()).querySelector('.account-type-options')).not.toBeNull()
  })

  it('Authlib 需要选择角色时保留弹窗，角色确认后关闭', async () => {
    vi.mocked(account.addAuthlibAccount).mockImplementation(async () => {
      account.pendingAuthlibAccountId = 'pending-profile'
      account.authlibProfiles = [{ id: 'profile-1', name: 'Player' }]
      account.selectedAuthlibProfileId = 'profile-1'
      account.accounts = [{ id: 'pending-profile', alias: 'Player', type: 'authlib', isCurrent: true }]
    })
    await openDialog()
    choice(2).click()
    await settle()
    const form = activeDialog()
    form.querySelectorAll('input')[1]!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await settle()
    expect(wrapper.props('visible')).toBe(true)
    expect(activeDialog()).toBe(form)
    expect(form.textContent).toContain(i18n.global.t('auth.selectProfileHint'))
    vi.mocked(account.selectAuthlibProfile).mockImplementation(async () => {
      account.pendingAuthlibAccountId = ''
    })
    ;[...form.querySelectorAll('button')]
      .find((button) => button.textContent === i18n.global.t('auth.loginSelectedProfile'))!
      .click()
    await settle()
    expect(account.selectAuthlibProfile).toHaveBeenCalledOnce()
    expect(wrapper.props('visible')).toBe(false)
  })

  it('待选 Authlib 角色不会覆盖插件登录表单', async () => {
    account.pendingAuthlibAccountId = 'pending-profile'
    account.authProviders = [
      {
        id: 'demo',
        title: 'Demo Login',
        description: '',
        fields: [{ key: 'username', label: 'Username', type: 'text', required: true, placeholder: '' }],
      },
    ]
    await openDialog()
    choice(3).click()
    await settle()
    expect(activeDialog().textContent).toContain('Username')
    expect(activeDialog().textContent).not.toContain(i18n.global.t('auth.selectProfileHint'))
  })
})
