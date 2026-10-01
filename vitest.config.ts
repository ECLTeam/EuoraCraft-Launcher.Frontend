import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const configDirectory = import.meta.dirname

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(configDirectory, './src'),
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    css: {
      // 背景回归测试需要真实样式，不能使用默认的空 CSS 替身。
      include: [/\/styles\/(?:app|folia)\.css/],
    },
    server: {
      deps: {
        // @material/material-color-utilities 为纯 ESM，内部存在无扩展名 import（color_spec_2025.js -> ./dynamic_color），
        // Node 直接加载会解析失败，需交由 Vite 管道处理（与生产构建一致）。
        inline: ['@material/material-color-utilities'],
      },
    },
  },
})
