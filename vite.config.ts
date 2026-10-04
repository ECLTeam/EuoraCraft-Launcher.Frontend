// vite.config.ts
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import checker from 'vite-plugin-checker'
import inspect from 'vite-plugin-inspect'
import Components from 'unplugin-vue-components/vite'

const configDirectory = import.meta.dirname

const packageVersion = (
  JSON.parse(readFileSync(resolve(configDirectory, 'package.json'), 'utf8')) as {
    version?: string
  }
).version

/** Vite 8 使用 Rolldown，需用函数式分包规则替代 Rollup 的静态依赖表。 */
function getVendorChunkName(moduleId: string): string | undefined {
  const id = moduleId.replaceAll('\\', '/')
  if (id.includes('/node_modules/naive-ui/')) return 'naive-ui'
  if (id.includes('/node_modules/vue-i18n/')) return 'i18n'
  if (id.includes('/node_modules/@iconify-json/tabler/') || id.includes('/node_modules/@iconify/vue/')) {
    return 'tabler-icons'
  }
  if (id.includes('/node_modules/vue/') || id.includes('/node_modules/vue-router/')) return 'vue-vendor'
  return undefined
}

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  return {
    base: './',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageVersion ?? ''),
    },
    plugins: [
      vue(),
      // 自动导入 Vue / Router / Pinia / i18n / VueUse 的组合式 API，避免重复手写 import
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', 'vue-i18n', '@vueuse/core'],
        dts: resolve(configDirectory, 'src/auto-imports.d.ts'),
      }),
      ...(isDev ? [vueDevTools()] : []),
      Components(),
      // 仅开发模式：在浏览器内实时提示 TS / ESLint 错误，避免切终端看报错
      ...(isDev
        ? [
            checker({
              vueTsc: { tsconfigPath: './tsconfig.app.json' },
              eslint: { lintCommand: 'eslint "./src/**/*.{ts,vue}"' },
            }),
          ]
        : []),
      // 仅开发模式：可视化检查各 Vite 插件产物，便于排查 import / 转换问题
      ...(isDev ? [inspect()] : []),
    ],
    publicDir: 'public',
    resolve: {
      alias: {
        '@': resolve(configDirectory, './src'),
        vue: 'vue/dist/vue.esm-bundler.js',
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: false,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
      target: 'chrome100',
      // 保留标准 backdrop-filter；当前 Lightning CSS 会在 chrome100 下只输出 WebKit 前缀。
      cssMinify: 'esbuild',
      sourcemap: false,
      rolldownOptions: {
        output: {
          manualChunks: getVendorChunkName,
        },
      },
    },
  }
})
