<template>
  <div class="launcher-log">
    <!-- 工具条：搜索 / 级别过滤 / 自动滚底 / 复制 / 清屏 -->
    <div class="ll-toolbar">
      <div class="ll-search">
        <UiIcon name="search" :size="14" class="ll-search-icon" />
        <input v-model="launcherQuery" class="ll-search-input" :placeholder="t('dev.log.searchPlaceholder')" />
      </div>

      <div class="ll-levels">
        <button
          v-for="level in LAUNCHER_LOG_LEVELS"
          :key="level"
          class="ll-level"
          :class="[`ll-level--${level.toLowerCase()}`, { 'll-level--on': launcherLevelsVisible[level] }]"
          @click="toggleLevel(level)"
        >
          [{{ level }}]
        </button>
      </div>

      <div class="ll-actions">
        <button
          class="ll-btn"
          :class="{ 'll-btn--active': launcherAutoScroll }"
          :title="t('dev.log.autoScroll')"
          @click="launcherAutoScroll = !launcherAutoScroll"
        >
          <UiIcon name="auto-scroll" :size="15" />
        </button>
        <button class="ll-btn" :title="t('dev.log.copy')" @click="copy">
          <UiIcon name="copy" :size="15" />
        </button>
        <button class="ll-btn" :title="t('dev.log.clear')" @click="clear">
          <UiIcon name="eraser" :size="15" />
        </button>
      </div>
    </div>

    <!-- 日志主体 -->
    <div ref="scrollEl" class="ll-body" @scroll="onScroll">
      <div v-if="launcherVisibleLogs.length === 0" class="ll-empty">
        <UiIcon name="terminal" :size="40" class="ll-empty-icon" />
        <p>{{ t('dev.log.empty') }}</p>
      </div>
      <div
        v-for="(row, index) in launcherVisibleLogs"
        :key="row.time + row.lineno + index"
        class="ll-line"
        :class="`ll-line--${row.level.toLowerCase()}`"
        @dblclick="copyLine(row)"
      >
        <span class="ll-time">{{ row.time }}</span>
        <span class="ll-level">[{{ row.level }}]</span>
        <span class="ll-loc">{{ row.filename }}:{{ row.lineno }}</span>
        <span class="ll-msg">
          <template v-for="(seg, i) in highlightSegments(row.message)" :key="i">
            <mark v-if="seg.hot" class="ll-mark">{{ seg.text }}</mark>
            <template v-else>{{ seg.text }}</template>
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { UiIcon } from '@/components/ui'
import type { TerminalLogEntry } from '@/types/system'
import { terminalApi } from '../api/terminalApi'
import {
  LAUNCHER_LOG_LEVELS,
  launcherAutoScroll,
  launcherLogs,
  launcherQuery,
  useLauncherLog,
} from '../composables/useLauncherLog'

defineOptions({ name: 'LauncherLogView' })

const { t } = useI18n()
const { launcherVisibleLogs, launcherLevelsVisible, pushLog, clearLogs, toggleLevel } = useLauncherLog()

const scrollEl = ref<HTMLElement | null>(null)
let userScrolledAway = false
let offLog: (() => void) | null = null

/** 依据日志消息切分关键词高亮片段 */
function highlightSegments(message: string): { text: string; hot: boolean }[] {
  const keyword = launcherQuery.value.trim()
  if (!keyword) return [{ text: message, hot: false }]
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = message.split(new RegExp(`(${escaped})`, 'i'))
  return parts.map((text) => ({ text, hot: text.toLowerCase() === keyword.toLowerCase() }))
}

/** 打包当前可见日志为可复制文本 */
function buildLogText(rows: TerminalLogEntry[]): string {
  return rows.map((row) => `${row.time} [${row.level}] ${row.filename}:${row.lineno} ${row.message}`).join('\n')
}

async function copy(): Promise<void> {
  const text = buildLogText(launcherVisibleLogs.value)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 剪贴板不可用时静默失败 */
  }
}

async function copyLine(row: TerminalLogEntry): Promise<void> {
  try {
    await navigator.clipboard.writeText(`${row.time} [${row.level}] ${row.filename}:${row.lineno} ${row.message}`)
  } catch {
    /* 剪贴板不可用时静默失败 */
  }
}

function clear(): void {
  clearLogs()
}

function onScroll(): void {
  const el = scrollEl.value
  if (!el) return
  userScrolledAway = el.scrollHeight - el.scrollTop - el.clientHeight > 16
}

watch(
  () => launcherVisibleLogs.value.length,
  async () => {
    if (!launcherAutoScroll.value || userScrolledAway) return
    await nextTick()
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  }
)

onMounted(() => {
  offLog = backend.on('launcher:log', pushLog)
  void terminalApi
    .getLogHistory()
    .then((entries) => {
      if (launcherLogs.value.length === 0) for (const entry of entries) pushLog(entry)
    })
    .catch(() => {
      /* 历史拉取失败不影响实时日志 */
    })
})

onUnmounted(() => {
  offLog?.()
  offLog = null
})
</script>

<style scoped>
.launcher-log {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.ll-toolbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--ecl-border, rgba(255, 255, 255, 0.08));
}

.ll-search {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
}

.ll-search-icon {
  flex-shrink: 0;
  color: var(--ecl-text-tertiary);
}

.ll-search-input {
  min-width: 0;
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--ecl-border, rgba(255, 255, 255, 0.08));
  border-radius: 6px;
  background: var(--ecl-surface-muted, rgba(127, 127, 127, 0.08));
  color: var(--ecl-text);
  font-size: 12px;
  outline: none;
}

.ll-search-input:focus {
  border-color: var(--ecl-primary, var(--ecl-border-strong));
}

.ll-levels {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.ll-level {
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ecl-text-tertiary);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.6;
}

.ll-level--debug.ll-level--on {
  color: #888;
  opacity: 1;
}

.ll-level--info.ll-level--on {
  color: #4ca6ff;
  opacity: 1;
}

.ll-level--warning.ll-level--on {
  color: #e8b339;
  opacity: 1;
}

.ll-level--error.ll-level--on,
.ll-level--critical.ll-level--on {
  color: #e5484d;
  opacity: 1;
}

.ll-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.ll-btn {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--ecl-border, rgba(255, 255, 255, 0.08));
  border-radius: 6px;
  background: transparent;
  color: var(--ecl-text-secondary);
  cursor: pointer;
}

.ll-btn:hover:not(:disabled) {
  background: var(--ecl-surface-muted, rgba(127, 127, 127, 0.08));
  color: var(--ecl-text);
}

.ll-btn--active {
  border-color: var(--ecl-primary, var(--ecl-border-strong));
  color: var(--ecl-primary, var(--ecl-text));
}

.ll-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
  font-family: var(--ecl-font-log, var(--font-mono));
  font-size: 12px;
  line-height: 1.55;
}

.ll-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--ecl-text-tertiary);
  font-family: var(--ecl-font-body, var(--font-body));
}

.ll-empty p {
  margin: 0;
}

.ll-empty-icon {
  opacity: 0.5;
}

.ll-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 4px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.ll-line:hover {
  background: rgba(127, 127, 127, 0.08);
}

.ll-time {
  flex-shrink: 0;
  color: var(--ecl-text-tertiary);
}

.ll-level {
  flex-shrink: 0;
}

.ll-line--debug .ll-level {
  color: #888;
}

.ll-line--info .ll-level {
  color: #4ca6ff;
}

.ll-line--warning .ll-level {
  color: #e8b339;
}

.ll-line--error .ll-level,
.ll-line--critical .ll-level {
  color: #e5484d;
}

.ll-loc {
  flex-shrink: 0;
  color: var(--ecl-text-tertiary);
  font-size: 11px;
}

.ll-msg {
  min-width: 0;
  flex: 1;
  color: var(--ecl-text);
}

.ll-mark {
  padding: 0 1px;
  border-radius: 2px;
  background: rgba(232, 179, 57, 0.3);
  color: inherit;
}
</style>
