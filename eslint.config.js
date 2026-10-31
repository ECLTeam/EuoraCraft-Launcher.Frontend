import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import importOrder from 'eslint-plugin-import-x/rules/order'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import ts from 'typescript-eslint'

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      // 仅加载项目采用的公开排序规则；其他规则仍依赖 minimatch 11 已移除的 makeRe。
      'import-x': { rules: { order: importOrder } },
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: ts.parser,
      },
    },
    rules: {
      // ── Vue ──
      'vue/multi-word-component-names': 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase', { registeredComponentsOnly: false }],
      'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
      'vue/attribute-hyphenation': ['error', 'never'],
      'vue/v-on-event-hyphenation': ['error', 'never'],
      'vue/order-in-components': 'off',
      'vue/define-macros-order': ['error', { order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'] }],

      // ── TypeScript ──
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // ── General ──
      // ESLint 10 recommended 新增；核心规则感知不到 script-setup 绑定的模板读取，
      // 对 Vue SFC 响应式状态会全量误报（约 400 处），待有 Vue 感知的替代规则再启用。
      'no-useless-assignment': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-duplicate-imports': 'error',
      'no-template-curly-in-string': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // ── Import order ──
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
    settings: {
      'import-x/resolver': {
        typescript: true,
      },
    },
  },
  eslintConfigPrettier,
  {
    ignores: [
      'dist',
      'node_modules',
      '*.d.ts',
      '*.tsbuildinfo',
      'vite.config.*',
      'tailwind.config.*',
      'postcss.config.*',
    ],
  }
)
