import { dirname, relative, resolve, sep } from 'node:path'

const sourceRoot = resolve(import.meta.dirname, '../src')
const allowedDirectories = ['components/ui/', 'utils/', 'types/', 'i18n/']
const allowedFiles = new Set(['i18n', 'types', 'composables/useRequestScope', 'composables/useAsyncAction'])

export const uiBoundaryRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { boundary: '公共 Ui 层只能引用公共控件、通用工具、类型、国际化和已声明的交互 composable。' },
  },
  create(context) {
    function check(node, source) {
      if (!source || typeof source.value !== 'string') {
        context.report({ node, messageId: 'boundary' })
        return
      }
      const specifier = source.value
      if (!specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('/')) return
      const target = specifier.startsWith('@/')
        ? resolve(sourceRoot, specifier.slice(2))
        : resolve(dirname(context.filename), specifier)
      const file = relative(sourceRoot, target)
        .split(sep)
        .join('/')
        .replace(/\.(?:ts|js|mjs)$/, '')
      if (!allowedDirectories.some((prefix) => file.startsWith(prefix)) && !allowedFiles.has(file))
        context.report({ node, messageId: 'boundary' })
    }
    return {
      ImportDeclaration: (node) => check(node, node.source),
      TSImportType: (node) => check(node, node.source),
      TSImportEqualsDeclaration: (node) => {
        if (node.moduleReference.type === 'TSExternalModuleReference') check(node, node.moduleReference.expression)
      },
      ExportAllDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source)
      },
      ImportExpression: (node) => check(node, node.source),
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node, node.arguments[0])
      },
    }
  },
}
