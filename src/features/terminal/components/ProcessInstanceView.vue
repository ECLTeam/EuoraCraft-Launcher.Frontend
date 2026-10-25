<template>
  <div ref="viewEl" class="piv" tabindex="-1">
    <UiEmptyState
      v-if="sessions.length === 0"
      icon="cpu"
      :title="t('terminal.instances.emptyTitle')"
      :description="t('terminal.instances.emptyDesc')"
    />
    <template v-else>
      <!-- 左列：运行实例列表 -->
      <div class="piv-sidebar">
        <div class="piv-list-toolbar">
          <button
            type="button"
            class="piv-clear"
            :disabled="stoppedCount === 0"
            :title="t('terminal.instances.removeHint')"
            @click="clearRecords"
          >
            <UiIcon name="trash" :size="14" />
            <span>{{ t('terminal.instances.clearStopped') }}</span>
          </button>
        </div>
        <div class="piv-list">
          <div
            v-for="item in sessions"
            :key="item.processId"
            class="piv-item"
            :class="{ 'piv-item--active': item.processId === selectedProcessId }"
          >
            <button type="button" class="piv-select" :data-process-id="item.processId" @click="select(item.processId)">
              <span class="piv-item-dot" :class="{ 'piv-item-dot--stop': !item.isRunning }" />
              <span class="piv-item-name" :title="item.name">{{ item.name }}</span>
              <span class="piv-item-type" :title="sessionLabel(item)">{{ sessionLabel(item) }}</span>
            </button>
            <button
              v-if="item.state === 'stopped'"
              type="button"
              class="piv-remove"
              :title="t('terminal.instances.removeRecord', { name: item.name })"
              :aria-label="t('terminal.instances.removeRecord', { name: item.name })"
              @click="removeRecord(item.processId, $event)"
            >
              <UiIcon name="close" :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- 右列：选中实例输出 + 输入栏 -->
      <div class="piv-main">
        <div v-if="!activeInstance" class="piv-hint">
          <UiIcon name="terminal" :size="34" />
          <p>{{ t('terminal.instances.selectHint') }}</p>
        </div>
        <template v-else>
          <div ref="scrollEl" class="piv-output" @scroll="onScroll">
            <div v-for="(line, index) in selectedOutput" :key="index" class="piv-line" @dblclick="copyLine(line)">
              {{ line }}
            </div>
            <div v-if="selectedOutput.length === 0" class="piv-empty-output">
              {{ activeInstance.isRunning ? t('terminal.instances.selectHint') : t('terminal.instances.stopped') }}
            </div>
          </div>

          <div class="piv-footer">
            <button
              class="piv-btn piv-btn--stop"
              :title="t('terminal.instances.stop')"
              :aria-label="t('terminal.instances.stop')"
              :disabled="!activeInstance.isRunning"
              @click="stopSelected"
            >
              <UiIcon name="stop" :size="15" />
            </button>
            <template v-if="activeInstance.stdin">
              <input
                v-model="inputText"
                class="piv-input"
                :placeholder="t('terminal.instances.inputPlaceholder')"
                :disabled="!activeInstance.isRunning"
                @keydown.enter="onEnter"
              />
              <button
                class="piv-btn piv-btn--primary"
                :aria-label="t('terminal.instances.send')"
                :disabled="!canSend"
                @click="onEnter"
              >
                <UiIcon name="send" :size="15" />
              </button>
            </template>
            <span v-else class="piv-nostdin">{{ t('terminal.instances.noStdin') }}</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiEmptyState from '@/components/ui/EmptyState.vue'
import UiIcon from '@/components/ui/Icon.vue'
import type { TerminalSession } from '@/types/system'
import { useProcessInstances } from '../composables/useProcessInstances'
defineOptions({ name: 'ProcessInstanceView' })

const { t } = useI18n()
const process = useProcessInstances()
const { sessions, selectedProcessId, selectedOutput, stoppedCount, select, sendInput, stop } = process

const activeInstance = computed(() => process.active())

const inputText = ref('')
const viewEl = ref<HTMLDivElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
let userScrolledAway = false

const canSend = computed(() => {
  const instance = activeInstance.value
  return !!instance && instance.stdin && instance.isRunning && inputText.value.trim().length > 0
})

function sessionLabel(session: TerminalSession): string {
  if (session.state === 'stopped') return t('terminal.instances.stopped')
  if (session.state === 'unknown') return t('terminal.instances.awaitingSnapshot')
  return session.type === 'Minecraft' ? t('terminal.instances.gameType') : session.type
}

function onEnter(): void {
  if (!canSend.value) return
  const text = inputText.value.trim()
  const processId = selectedProcessId.value
  void sendInput(text).then((sent) => {
    if (sent && processId === selectedProcessId.value && inputText.value.trim() === text) inputText.value = ''
  })
}

function stopSelected(): void {
  const instance = activeInstance.value
  if (instance) void stop(instance.processId)
}

async function restoreRemovalFocus(previousFocus: Element | null): Promise<void> {
  await nextTick()
  // 不抢回用户在本次更新期间主动移动到其他控件的焦点。
  if (document.activeElement !== previousFocus && document.activeElement !== document.body) return
  const next = Array.from(viewEl.value?.querySelectorAll<HTMLButtonElement>('.piv-select') ?? []).find(
    (button) => button.dataset.processId === selectedProcessId.value
  )
  const focusTarget = next ?? viewEl.value
  focusTarget?.focus()
}

function removeRecord(processId: string, event: MouseEvent): void {
  const previousFocus = document.activeElement
  const hadFocus = event.currentTarget === previousFocus
  if (process.removeStopped(processId) && hadFocus) void restoreRemovalFocus(previousFocus)
}

function clearRecords(event: MouseEvent): void {
  const previousFocus = document.activeElement
  const hadFocus = event.currentTarget === previousFocus
  if (process.clearStopped() > 0 && hadFocus) void restoreRemovalFocus(previousFocus)
}

async function copyLine(line: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(line)
  } catch {
    /* 剪贴板不可用时静默失败 */
  }
}

function onScroll(): void {
  const el = scrollEl.value
  if (!el) return
  userScrolledAway = el.scrollHeight - el.scrollTop - el.clientHeight > 16
}

watch(selectedProcessId, () => {
  inputText.value = ''
  userScrolledAway = false
})

watch(
  () => selectedOutput.value.length + (selectedProcessId.value ?? ''),
  async () => {
    if (userScrolledAway) return
    await nextTick()
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  }
)
</script>

<style src="@/styles/components/panels/ProcessInstanceView.css"></style>
