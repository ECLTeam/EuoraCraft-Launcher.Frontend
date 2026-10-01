<template>
  <div class="piv">
    <UiEmptyState
      v-if="instances.length === 0"
      icon="cpu"
      :title="t('terminal.instances.emptyTitle')"
      :description="t('terminal.instances.emptyDesc')"
    />
    <template v-else>
      <!-- 左列：运行实例列表 -->
      <div class="piv-list">
        <button
          v-for="item in instances"
          :key="item.id"
          class="piv-item"
          :class="{ 'piv-item--active': item.id === selectedId }"
          @click="select(item.id)"
        >
          <span class="piv-item-dot" :class="{ 'piv-item-dot--stop': !item.running }" />
          <span class="piv-item-name" :title="item.name">{{ item.name }}</span>
          <span class="piv-item-type">{{ typeLabel(item.type) }}</span>
        </button>
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
              {{ activeInstance.running ? t('terminal.instances.selectHint') : t('terminal.instances.stopped') }}
            </div>
          </div>

          <div class="piv-footer">
            <button
              class="piv-btn piv-btn--stop"
              :title="t('terminal.instances.stop')"
              :disabled="!activeInstance.running"
              @click="stopSelected"
            >
              <UiIcon name="stop" :size="15" />
            </button>
            <template v-if="activeInstance.stdin">
              <input
                v-model="inputText"
                class="piv-input"
                :placeholder="t('terminal.instances.inputPlaceholder')"
                :disabled="!activeInstance.running"
                @keydown.enter="onEnter"
              />
              <button class="piv-btn piv-btn--primary" :disabled="!canSend" @click="onEnter">
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
import { useProcessInstances } from '../composables/useProcessInstances'
defineOptions({ name: 'ProcessInstanceView' })

const { t } = useI18n()
const process = useProcessInstances()
const { instances, selectedId, selectedOutput, select, sendInput, stop } = process

const activeInstance = computed(() => process.active())

const inputText = ref('')
const scrollEl = ref<HTMLElement | null>(null)
let userScrolledAway = false

const canSend = computed(() => {
  const instance = activeInstance.value
  return !!instance && instance.stdin && instance.running && inputText.value.trim().length > 0
})

function typeLabel(type: string): string {
  return type === 'Minecraft' ? t('terminal.instances.gameType') : type
}

function onEnter(): void {
  if (!canSend.value) return
  const text = inputText.value.trim()
  void sendInput(text).then((sent) => {
    if (sent) inputText.value = ''
  })
}

function stopSelected(): void {
  const instance = activeInstance.value
  if (instance) void stop(instance.id)
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

watch(
  () => selectedOutput.value.length + (selectedId.value ?? ''),
  async () => {
    if (userScrolledAway) return
    await nextTick()
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  }
)
</script>

<style src="@/styles/components/panels/ProcessInstanceView.css"></style>
