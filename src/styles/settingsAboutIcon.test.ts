import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const aboutCss = readFileSync('src/styles/views/settings/AboutTab.css', 'utf8')

describe('关于页启动器图标', () => {
  it('调试模式开启后悬停顺时针旋转一圈，移出后沿原路径转回', () => {
    expect(aboutCss).toContain('.launcher-summary__logo-cell.is-debug .launcher-summary__logo {')
    expect(aboutCss).toContain('.launcher-summary__logo-cell.is-debug:hover .launcher-summary__logo,')
    expect(aboutCss).toContain('transform: rotate(360deg);')
    expect(aboutCss).toContain('transition: transform var(--duration-slower) var(--ease-emphasized);')
  })

  it('未开启调试模式时图标不旋转，避免暴露连点入口', () => {
    expect(aboutCss).not.toContain('.launcher-summary__logo-cell:hover .launcher-summary__logo')
    expect(aboutCss).not.toContain('.launcher-summary__logo-cell:focus-visible .launcher-summary__logo')
  })

  it('系统要求减少动态效果时不旋转也不过渡', () => {
    const reducedMotion = aboutCss.slice(aboutCss.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedMotion).toContain('.launcher-summary__logo-cell.is-debug:hover .launcher-summary__logo,')
    expect(reducedMotion).toContain('transition: none;')
    expect(reducedMotion).toContain('transform: none;')
  })
})
