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

// 公共 Ui 的对外入口只有 `@/components/ui`。深层引用会让调用方依赖文件布局，
// 也让「这里能放控件」变成各处自行拼装的入口；`components/ui/` 内部不受此限，
// 否则与 barrel 形成循环依赖。
const uiEntryMessage = '公共 Ui 组件统一从 @/components/ui 导入，不直接引用目录内的文件。'

export const uiEntryRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: { entry: uiEntryMessage },
  },
  create(context) {
    function check(node, source) {
      if (!source || typeof source.value !== 'string') return
      const specifier = source.value
      if (!specifier.startsWith('@/components/ui/')) return
      context.report({ node, messageId: 'entry' })
    }
    return {
      ImportDeclaration: (node) => check(node, node.source),
      TSImportType: (node) => check(node, node.source),
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
