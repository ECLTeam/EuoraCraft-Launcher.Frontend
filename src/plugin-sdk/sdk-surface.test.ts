import { describe, expect, it } from 'vitest'
import * as widgets from './widgets'
import * as sdk from './index'

/**
 * SDK 公开面契约快照：新增或删除模块/方法必须在此显式更新，
 * 防止无意识扩面或缩面（对应门面收敛的快照模式）。
 */

const WIDGET_NAMES = [
  'badge',
  'button',
  'card',
  'emptyState',
  'group',
  'input',
  'list',
  'listItem',
  'metric',
  'progress',
  'table',
  'textarea',
  'toggle',
] as const

const STATE_FUNCTIONS = [
  'getAccountState',
  'getInstancesState',
  'getLauncherState',
  'getPluginsState',
  'getSidebarState',
  'getTasksState',
  'getThemeState',
  'refreshAccounts',
  'refreshInstances',
  'refreshLauncher',
  'refreshPlugins',
  'refreshTasks',
  'refreshTheme',
  'setSidebarState',
  'watchAccount',
  'watchInstances',
  'watchLauncher',
  'watchPlugins',
  'watchSidebar',
  'watchTasks',
  'watchTheme',
] as const

const SLOT_FUNCTIONS = ['getSlotContext', 'onPageChanged'] as const

const ROUTER_FUNCTIONS = [
  'beforeRouteLeave',
  'getCurrentRoute',
  'goBack',
  'goForward',
  'isPluginRoute',
  'matchPluginRoute',
  'navigateTo',
  'onRouteChange',
  'replaceTo',
] as const

describe('plugin sdk surface', () => {
  it('widgets factory surface is explicit', () => {
    const names = Object.keys(widgets).sort()
    expect(names).toEqual([...WIDGET_NAMES].sort())
  })

  it('state slices expose the promised getters, watchers and refreshers', () => {
    const names = Object.keys(sdk)
    for (const expected of STATE_FUNCTIONS) {
      expect(names).toContain(expected)
    }
  })

  it('slot context and page notifications are exported', () => {
    for (const name of SLOT_FUNCTIONS) {
      expect(typeof (sdk as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('router surface is explicit', () => {
    for (const name of ROUTER_FUNCTIONS) {
      expect(typeof (sdk as Record<string, unknown>)[name]).toBe('function')
    }
  })
})
