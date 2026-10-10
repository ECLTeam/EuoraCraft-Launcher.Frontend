import { describe, expect, it, vi } from 'vitest'
import { createGlobalModalStack, GLOBAL_MODAL_PRIORITY } from './useGlobalModalStack'

describe('useGlobalModalStack', () => {
  it('抢占实际展示的更新时等待退场，关闭警告后恢复更新且不调用更新关闭回调', () => {
    const stack = createGlobalModalStack()
    const closeUpdate = vi.fn()
    stack.register({ id: 'update', priority: 60, onRequestClose: closeUpdate })
    stack.markDisplayed('update')
    stack.register({ id: 'client-id', priority: 75 })
    expect(stack.displayedModalIds.value).toEqual([])
    expect(stack.interactiveModalId.value).toBeNull()
    expect(stack.isScrollLocked.value).toBe(true)
    stack.finishLeave('update')
    expect(stack.activeModalId.value).toBe('client-id')
    stack.markDisplayed('client-id')
    stack.unregister('client-id')
    expect(stack.activeModalId.value).toBeNull()
    stack.finishLeave('client-id')
    expect(stack.activeModalId.value).toBe('update')
    expect(closeUpdate).not.toHaveBeenCalled()
  })

  it('退场期间使用最新请求，更高优先级错误和 blocker 也等待真实退场', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'update', priority: 60 })
    stack.markDisplayed('update')
    stack.register({ id: 'client-id', priority: 75 })
    stack.addBlocker('notification-gap', 75)
    stack.register({ id: 'error', priority: 100 })
    expect(stack.activeModalId.value).toBeNull()
    stack.finishLeave('update')
    expect(stack.activeModalId.value).toBe('error')
    stack.unregister('error')
    expect(stack.activeModalId.value).toBeNull()
    stack.unregister('notification-gap')
    expect(stack.activeModalId.value).toBe('client-id')
  })

  it('未显示的等待项可直接取消，退场中的更新取消后不会恢复', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'update', priority: 60 })
    stack.markDisplayed('update')
    stack.register({ id: 'client-id', priority: 75 })
    stack.unregister('client-id')
    stack.unregister('update')
    expect(stack.isScrollLocked.value).toBe(true)
    stack.finishLeave('update')
    expect(stack.hasActiveOverlay.value).toBe(false)
    expect(stack.isScrollLocked.value).toBe(false)
  })

  it('共同父级保留为背景，独立提示等待父子全部退场再入场', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'account', isFullscreen: true })
    stack.markDisplayed('account')
    stack.register({ id: 'add', parentId: 'account' })
    stack.markDisplayed('add')
    stack.register({ id: 'error', priority: 100 })
    expect(stack.displayedModalIds.value).toEqual([])
    expect(stack.isFullscreenActive.value).toBe(true)
    stack.finishLeave('add')
    expect(stack.activeModalId.value).toBeNull()
    stack.finishLeave('account')
    expect(stack.activeModalId.value).toBe('error')
    expect(stack.isFullscreenActive.value).toBe(false)
    stack.unregister('error')
    expect(stack.displayedModalIds.value).toEqual(['account', 'add'])
  })

  it('快速关闭再打开保留新请求，重复退场信号不关闭重新显示的窗口', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'update', priority: 60 })
    stack.markDisplayed('update')
    stack.unregister('update')
    stack.register({ id: 'update', priority: 60, title: '重新打开' })
    expect(stack.activeModalId.value).toBeNull()
    stack.finishLeave('update')
    stack.markDisplayed('update')
    stack.finishLeave('update')
    expect(stack.activeModalId.value).toBe('update')
    expect(stack.interactiveModalId.value).toBe('update')
  })

  it('已卸载实例的延迟动画回调不会提前完成同名新实例的退场', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'update', priority: 60 })
    stack.markDisplayed('update')
    stack.unregister('update')
    const finishOldLeave = stack.captureLeave('update')
    stack.detach('update')
    stack.register({ id: 'update', priority: 60 })
    stack.markDisplayed('update')
    stack.register({ id: 'warning', priority: 75 })
    finishOldLeave()
    expect(stack.activeModalId.value).toBeNull()
    stack.captureLeave('update')()
    expect(stack.activeModalId.value).toBe('warning')
  })

  it('卸载退场组件释放交接，reset 清理请求且在退场后释放锁', () => {
    const stack = createGlobalModalStack()
    stack.register({ id: 'update', priority: 60 })
    stack.markDisplayed('update')
    stack.register({ id: 'client-id', priority: 75 })
    stack.detach('update')
    expect(stack.activeModalId.value).toBe('client-id')
    stack.markDisplayed('client-id')
    stack.reset()
    stack.reset()
    expect(stack.isScrollLocked.value).toBe(true)
    stack.finishLeave('client-id')
    expect(stack.hasActiveOverlay.value).toBe(false)
    expect(stack.isScrollLocked.value).toBe(false)
  })

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
    stack.markDisplayed('account')
    stack.markDisplayed('add')
    stack.beginClose('add')
    expect(stack.displayedModalIds.value).toEqual(['account'])
    expect(stack.interactiveModalId.value).toBeNull()
    expect(stack.isScrollLocked.value).toBe(true)
    stack.finishLeave('add')
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
