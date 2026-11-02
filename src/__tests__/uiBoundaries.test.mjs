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
