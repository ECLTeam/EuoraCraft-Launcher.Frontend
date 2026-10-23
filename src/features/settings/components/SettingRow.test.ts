import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import SettingRow from './SettingRow.vue'

enableAutoUnmount(afterEach)

function mountRow(details?: string) {
  return mount(SettingRow, {
    attachTo: '#app',
    props: { label: '启动前执行命令', description: '失败时取消启动', details },
    slots: { default: '<input aria-label="命令" />' },
    global: { plugins: [i18n] },
  })
}

describe('设置说明详情', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'zh-CN'
    const app = document.createElement('div')
    app.id = 'app'
    document.body.appendChild(app)
  })

  it('简单项保留摘要与控件，不显示帮助按钮', () => {
    const wrapper = mountRow()
    expect(wrapper.get('.setting-desc').text()).toBe('失败时取消启动')
    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('默认只显示摘要，点击后可以读取完整纯文本，Esc 关闭并恢复焦点', async () => {
    const details = '每行一条，按顺序执行。\n<b>这是参数原文</b>'
    const wrapper = mountRow(details)
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('查看「启动前执行命令」的详细说明')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.querySelector('.setting-details')).toBeNull()
    await button.trigger('click')
    await flushPromises()
    const content = document.querySelector<HTMLElement>('.setting-details')!
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(content.id).toBe(button.attributes('aria-controls'))
    expect(content.textContent).toBe(details)
    expect(content.querySelector('b')).toBeNull()
    content.focus()
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
  })

  it('再次点击及点击外部关闭，不干扰输入控件', async () => {
    const wrapper = mountRow('完整说明')
    const button = wrapper.get('button')
    await button.trigger('click')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    await flushPromises()
    const input = wrapper.get('input')
    input.element.focus()
    // Naive UI 在按下与抬起均发生于外部时判定为外部点击。
    input.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    input.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    input.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('echo ready')
    expect(input.element.value).toBe('echo ready')
  })

  it('卸载后移除浮层并释放 Esc 拦截', async () => {
    const wrapper = mountRow('完整说明')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(document.querySelector('.setting-details')).not.toBeNull()
    wrapper.unmount()
    await flushPromises()
    expect(document.querySelector('.setting-details')).toBeNull()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('每行详情使用独立的辅助技术关联标识', async () => {
    const wrapper = mount(
      {
        components: { SettingRow },
        template: '<div><SettingRow label="甲" details="说明甲" /><SettingRow label="乙" details="说明乙" /></div>',
      },
      { attachTo: '#app', global: { plugins: [i18n] } }
    )
    const buttons = wrapper.findAll('button')
    expect(buttons[0]!.attributes('aria-controls')).not.toBe(buttons[1]!.attributes('aria-controls'))
  })

  it('六种语言的详情保留参数原文并可直接显示，无缺失插值', () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      for (const locale of ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'de-DE', 'ru-RU'] as const) {
        i18n.global.locale.value = locale
        expect(i18n.global.t('settings.viewDetails', { label: 'Java' })).toContain('Java')
        const title = i18n.global.t('settings.windowTitleDetails')
        for (const placeholder of ['{instance}', '{version}', '{account}']) expect(title).toContain(placeholder)
        const example = i18n.global.t('settings.windowTitlePlaceholder')
        expect(example).toContain('{instance}')
        expect(example).toContain('{account}')
        expect(i18n.global.t('settings.wrapperCommandDetails')).toContain('{}')
        expect(i18n.global.t('settings.envVarsDetails')).toContain('KEY=VALUE')
        expect(i18n.global.t('settings.scheduleEnabledDetails')).not.toBe('settings.scheduleEnabledDetails')
      }
      expect(warnings).not.toHaveBeenCalled()
    } finally {
      warnings.mockRestore()
      i18n.global.locale.value = 'zh-CN'
    }
  })
})
