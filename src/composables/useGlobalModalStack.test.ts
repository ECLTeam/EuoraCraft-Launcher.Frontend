import { describe, expect, it, vi } from 'vitest'
import { createGlobalModalStack, GLOBAL_MODAL_PRIORITY } from './useGlobalModalStack'

describe('useGlobalModalStack', () => {
  it('仅激活优先级最高的模态框，关闭后恢复等待项', () => {
    const stack = createGlobalModalStack()

    stack.register({ id: 'startup-update', title: '发现更新', priority: GLOBAL_MODAL_PRIORITY.automaticUpdate })
    stack.register({
      id: 'curseforge-key',
      title: 'CurseForge API Key 未配置',
      priority: GLOBAL_MODAL_PRIORITY.launcherWarning,
    })

    expect(stack.activeModalId.value).toBe('curseforge-key')

    stack.unregister('curseforge-key')

    expect(stack.activeModalId.value).toBe('startup-update')
  })

  it('启动器弹窗的关闭过渡会阻止低优先级更新提示抢占', () => {
    const stack = createGlobalModalStack()

    stack.register({ id: 'startup-update', title: '发现更新', priority: GLOBAL_MODAL_PRIORITY.automaticUpdate })
    stack.addBlocker('launcher-popup-leave', GLOBAL_MODAL_PRIORITY.launcherWarning)

    expect(stack.activeModalId.value).toBeNull()

    stack.unregister('launcher-popup-leave')

    expect(stack.activeModalId.value).toBe('startup-update')
  })

  it('严重错误可抢占其他类型，关闭后恢复原有全屏模态框', () => {
    const stack = createGlobalModalStack()
    const closeError = vi.fn()

    stack.register({ id: 'instance-detail', title: '实例详情', isFullscreen: true })
    stack.register({
      id: 'fatal-error',
      title: '启动器错误',
      priority: GLOBAL_MODAL_PRIORITY.error,
      onRequestClose: closeError,
    })

    expect(stack.activeModalId.value).toBe('fatal-error')
    expect(stack.isFullscreenActive.value).toBe(false)

    stack.closeActive()

    expect(closeError).toHaveBeenCalledOnce()
    expect(stack.activeModalId.value).toBe('instance-detail')
    expect(stack.isFullscreenActive.value).toBe(true)
  })

  it('关联子弹窗保留父全屏，但独立错误继续抢占，标题更新不丢失关联', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'account', title: '账户管理', isFullscreen: true })
    stack.register({ id: 'add', parentId: 'account', title: '添加账户' })
    expect(stack.activeModalId.value).toBe('add')
    expect(stack.currentFullscreenId.value).toBe('account')
    expect(stack.displayedModalIds.value).toEqual(['account', 'add'])
    expect(stack.activeTitle.value).toBe('账户管理')
    stack.register({ id: 'add', title: '添加账户（更新）' })
    expect(stack.currentFullscreenId.value).toBe('account')
    stack.register({ id: 'error', priority: GLOBAL_MODAL_PRIORITY.error })
    expect(stack.displayedModalIds.value).toEqual(['error'])
    expect(stack.isFullscreenActive.value).toBe(false)
    stack.unregister('error')
    expect(stack.displayedModalIds.value).toEqual(['account', 'add'])
  })

  it('关闭父级级联实际后代，保留独立弹窗，关闭回调只触发一次', () => {
    const stack = createGlobalModalStack()
    const childClose = vi.fn()
    const grandchildClose = vi.fn()
    stack.register({ id: 'account', isFullscreen: true })
    stack.register({ id: 'add', parentId: 'account', onRequestClose: childClose })
    stack.register({ id: 'profile', parentId: 'add', onRequestClose: grandchildClose })
    stack.register({ id: 'independent', priority: GLOBAL_MODAL_PRIORITY.error })
    stack.unregisterFullscreen('account')
    stack.unregisterFullscreen('account')
    expect(childClose).toHaveBeenCalledOnce()
    expect(grandchildClose).toHaveBeenCalledOnce()
    expect(stack.activeModalId.value).toBe('independent')
    expect(stack.isScrollLocked.value).toBe(true)
  })

  it('子弹窗关闭过渡期间继续锁定背景且禁止交互，结束后恢复父级', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'account', isFullscreen: true })
    stack.register({ id: 'add', parentId: 'account', lockScroll: false })
    stack.beginClose('add')
    expect(stack.displayedModalIds.value).toEqual(['account', 'add'])
    expect(stack.interactiveModalId.value).toBeNull()
    expect(stack.isScrollLocked.value).toBe(true)
    stack.unregister('add')
    expect(stack.interactiveModalId.value).toBe('account')
  })

  it('无效父级不会建立关系，已打开窗口的关系不可在属性更新时形成循环', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'missing', parentId: 'not-registered' })
    expect(stack.displayedModalIds.value).toEqual(['missing'])
    stack.register({ id: 'self', parentId: 'self' })
    expect(stack.displayedModalIds.value).toEqual(['self'])
    stack.register({ id: 'parent', isFullscreen: true })
    stack.register({ id: 'child', parentId: 'parent' })
    stack.register({ id: 'parent', isFullscreen: true, parentId: 'child', title: '已更新' })
    expect(stack.displayedModalIds.value).toEqual(['parent', 'child'])
    expect(stack.activeTitle.value).toBe('已更新')
  })

  it('全屏重置清理普通后代，独立提示保留，重复重置不重复回调', () => {
    const stack = createGlobalModalStack()
    const parentClose = vi.fn()
    const childClose = vi.fn()
    stack.register({ id: 'parent', isFullscreen: true, onRequestClose: parentClose })
    stack.register({ id: 'child', parentId: 'parent', onRequestClose: childClose })
    stack.register({ id: 'independent', priority: GLOBAL_MODAL_PRIORITY.error })
    stack.resetFullscreen()
    stack.resetFullscreen()
    expect(parentClose).toHaveBeenCalledOnce()
    expect(childClose).toHaveBeenCalledOnce()
    expect(stack.activeModalId.value).toBe('independent')
  })
})
