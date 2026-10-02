/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const loadingStyles = readFileSync('src/styles/components/ui/Loading.css', 'utf8')
const sidebarStyles = readFileSync('src/styles/components/layout/SideBar.css', 'utf8')
const onlineModsStyles = readFileSync('src/styles/views/OnlineMods.css', 'utf8')

describe('公共表面样式', () => {
  it('加载遮罩保留进度指示，不模糊底层内容', () => {
    expect(loadingStyles).not.toMatch(/backdrop-filter\s*:/)
    expect(loadingStyles).toContain('background: var(--ui-loading-overlay)')
  })
  it('资源搜索列表使用透明加载背景，覆盖公共组件默认值', () => {
    const resultsRule = onlineModsStyles.match(/\.mods-results-spin\.ui-loading\s*\{([^}]+)\}/)?.[1]
    expect(resultsRule).toMatch(/--ui-loading-overlay\s*:\s*transparent\s*;/)
    expect(loadingStyles).toMatch(/--ui-loading-overlay\s*:\s*color-mix\(/)
  })
  it('侧边栏只使用主题分隔线，不叠加固定白色阴影', () => {
    expect(sidebarStyles).toContain('border-right: 1px solid var(--glass-border)')
    expect(sidebarStyles).not.toContain('rgba(255, 255, 255, 0.35)')
  })
})
