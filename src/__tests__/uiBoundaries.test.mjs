import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const linter = new ESLint()
async function messages(source, filePath = 'src/components/ui/GovernanceExample.ts') {
  const [result] = await linter.lintText(source, { filePath })
  return result.messages.filter((item) => item.ruleId === 'ecl-design/ui-boundary')
}

describe('公共 Ui 依赖方向', () => {
  it.each([
    "import store from '@/features/plugins/stores/pluginStore'",
    "import store from '../../features/plugins/stores/pluginStore'",
    "export { store } from '@/app/stores'",
    "export * from '@/api/client'",
    "import Component from '@/views/Game.vue'",
    "const load = () => import('../game/GameInfoCard.vue')",
    'const load = (name) => import(name)',
    "const api = require('@/features/game/api')",
    "import api = require('@/features/game/api')",
    "type Api = import('@/features/game/api').Api",
    "import Card from '@/components/ui/../game/GameInfoCard.vue'",
  ])('拒绝反向导入及替代写法：%s', async (source) => {
    expect(await messages(source)).toHaveLength(1)
  })

  it.each([
    "import { ref } from 'vue'",
    "import UiIcon from './Icon.vue'",
    "import { renderMarkdown } from '@/utils/markdown'",
    "import type { PluginInfo } from '@/types/plugins'",
    "import { useI18n } from 'vue-i18n'",
    "import { useRequestScope } from '@/composables/useRequestScope'",
  ])('允许现有公共入口：%s', async (source) => {
    expect(await messages(source)).toEqual([])
  })

  it('SFC 中同样生效，业务页面不受 Ui 层规则限制', async () => {
    const source = `<template><div /></template><script setup lang="ts">import { store } from '@/features/plugins/stores/pluginStore'</script>`
    expect(await messages(source, 'src/components/ui/GovernanceExample.vue')).toHaveLength(1)
    expect(
      await messages("import { store } from '@/features/plugins/stores/pluginStore'", 'src/views/Governance.ts')
    ).toEqual([])
    expect(
      await messages(
        "import { store } from '@/features/plugins/stores/pluginStore'",
        'src/components/ui/Governance.test.ts'
      )
    ).toEqual([])
  })
})

async function entryMessages(source, filePath = 'src/views/Governance.ts') {
  const [result] = await linter.lintText(source, { filePath })
  return result.messages.filter((item) => item.ruleId === 'ecl-design/ui-entry')
}

describe('公共 Ui 唯一入口', () => {
  it.each([
    "import UiIcon from '@/components/ui/Icon.vue'",
    "import { UiButton, UiCard } from '@/components/ui/Button.vue'",
    "const load = () => import('@/components/ui/Select.vue')",
    "export { default as UiTag } from '@/components/ui/Tag.vue'",
    "import helper from '@/components/ui/iconify'",
  ])('拒绝绕过 barrel 的深层引用：%s', async (source) => {
    expect(await entryMessages(source)).toHaveLength(1)
  })

  it.each([
    "import { UiButton, UiCard, UiIcon } from '@/components/ui'",
    "import type { UiCardProps } from '@/components/ui'",
    "import { ref } from 'vue'",
  ])('允许唯一入口与无关导入：%s', async (source) => {
    expect(await entryMessages(source)).toEqual([])
  })

  it('Ui 目录内部仍可直接引用文件，避免与 barrel 形成循环依赖', async () => {
    expect(await entryMessages("import UiIcon from '@/components/ui/Icon.vue'", 'src/components/ui/Card.vue')).toEqual(
      []
    )
    expect(
      await entryMessages("import UiIcon from '@/components/ui/Icon.vue'", 'src/components/ui/Card.test.ts')
    ).toEqual([])
  })
})
