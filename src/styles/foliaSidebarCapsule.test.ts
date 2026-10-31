import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const foliaCss = readFileSync('src/styles/folia.css', 'utf8')
const sidebarCss = readFileSync('src/styles/components/layout/SideBar.css', 'utf8')

describe('侧边栏激活背景', () => {
  it('两种皮肤共用背景和竖条，Folia 保留自己的背景颜色', () => {
    expect(sidebarCss).toContain('.sidebar-active-indicator {')
    expect(sidebarCss).toContain('.sidebar-active-bg {')
    expect(foliaCss).toContain("[data-ui-skin='folia'] .sidebar-active-bg {")
    expect(foliaCss).not.toContain("[data-ui-skin='folia'] .sidebar-item.active::before")
  })
})
