import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPageRoots, checkViewRoot } from '../../scripts/check-page-root-class.mjs'

const check = (template) => checkViewRoot('src/views/Example.vue', `<template>${template}</template>`)

describe('页面根类约定', () => {
  it('接受公共页面骨架', () => {
    expect(check('<div class="example-page ecl-page"><section class="ecl-surface" /></div>').ok).toBe(true)
    expect(check('<div class="tab-pane example-settings" />').ok).toBe(true)
    expect(check('<div :class="\'ecl-page\'" />').ok).toBe(true)
  })

  it('接受自带骨架的布局与弹层组件', () => {
    expect(check('<SectionLayout title="t" :items="items" />').ok).toBe(true)
    expect(check('<FullscreenModal><div /></FullscreenModal>').ok).toBe(true)
  })

  it('拒绝自建页面根类', () => {
    const result = check('<div class="example-page"><section /></div>')
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('ecl-page')
  })

  it('拒绝无法静态判定的动态 class', () => {
    const interpolated = ['<div :class="`', '$', '{base} ecl-page', '`" />'].join('')
    expect(check('<div :class="rootClass" />').ok).toBe(false)
    expect(check('<div :class="[base, extra]" />').ok).toBe(false)
    expect(check(interpolated).ok).toBe(false)
  })

  it('根元素缺失或模板无法解析时明确失败', () => {
    expect(() => checkViewRoot('src/views/Empty.vue', '<template></template>')).toThrow()
    expect(() => checkViewRoot('src/views/NoTemplate.vue', '<script setup>const a = 1</script>')).toThrow()
  })
})

describe('全量视图与待迁移清单', () => {
  it('清单外没有新增不符合项，清单内没有已修复的过期条目', () => {
    const result = checkPageRoots(resolve(import.meta.dirname, '../..'))
    expect(result.unexpected).toEqual([])
    expect(result.stale).toEqual([])
    expect(result.checked).toBeGreaterThan(0)
  })
})
