import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

describe('import order with the patched minimatch dependency', () => {
  it('preserves builtin, external, alias, relative and type grouping', async () => {
    const source = [
      "import fs from 'node:fs'",
      "import { ref } from 'vue'",
      "import alias from '@/features/example'",
      "import parent from '../example'",
      "import sibling from './example'",
      "import type { Example } from './types'",
      'void [fs, ref, alias, parent, sibling]',
      'export type Result = Example',
    ].join('\n')
    const linter = new ESLint()
    const [ordered] = await linter.lintText(source, { filePath: 'src/governanceImportOrder.ts' })
    expect(ordered!.messages.filter((message) => message.severity === 2)).toEqual([])
    const [reversed] = await linter.lintText(
      source.replace(
        "import fs from 'node:fs'\nimport { ref } from 'vue'",
        "import { ref } from 'vue'\nimport fs from 'node:fs'"
      ),
      { filePath: 'src/governanceImportOrder.ts' }
    )
    expect(reversed!.messages.some((message) => message.ruleId === 'import-x/order' && message.severity === 2)).toBe(
      true
    )
  })
})
