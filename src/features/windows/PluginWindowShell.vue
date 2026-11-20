<template>
  <div class="plugin-window-shell" :data-plugin-window="windowContext.label">
    <header data-tauri-drag-region>
      <span>{{ windowContext.title || 'Plugin Window' }}</span
      ><button data-no-drag @click="close">×</button>
    </header>
    <main><RouterView /></main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import backend from '@/api/client'
import { windowApi } from './api/windowApi'
import { windowContext } from './model/windowContext'

const router = useRouter()
onMounted(async () => {
  if (windowContext.route) await router.replace(windowContext.route)
  await backend.command('frontend_ready', { window_type: 'plugin', session_id: windowContext.sessionId })
})
async function close(): Promise<void> {
  try {
    await windowApi.close(windowContext.label)
  } catch {
    window.close()
  }
}
</script>

<style scoped>
.plugin-window-shell {
  min-height: 100vh;
  color: var(--text-primary);
  /* 跟随主窗口表面不透明度；插件子窗口没有透明标志时 alpha 不产生实际效果。 */
  background: color-mix(in srgb, var(--bg-primary) calc(var(--window-surface-alpha, 1) * 100%), transparent);
}
header {
  display: flex;
  height: var(--titlebar-h, 38px);
  align-items: center;
  justify-content: space-between;
  padding-left: 12px;
  border-bottom: 1px solid var(--ecl-border);
}
header button {
  width: 42px;
  height: 100%;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
header button:hover {
  background: rgba(220, 38, 38, 0.16);
}
main {
  min-height: calc(100vh - var(--titlebar-h, 38px));
}
</style>
