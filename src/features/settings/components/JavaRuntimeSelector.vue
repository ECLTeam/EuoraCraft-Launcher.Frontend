<template>
  <div class="java-runtime-selector">
    <div class="java-runtime-controls">
      <NSelect
        :value="value || null"
        :options="options"
        :placeholder="inheritedValue || t('settings.javaPathPlaceholder')"
        :fallbackOption="false"
        :clearable="inheritedValue !== undefined"
        :disabled="selecting"
        :loading="store.isLoading || selecting"
        filterable
        @update:value="chooseRuntime"
      />
      <NButton size="small" :loading="store.isLoading" :disabled="selecting" @click="scan(true)">{{
        t('common.refresh')
      }}</NButton>
      <NButton size="small" :disabled="selecting" @click="managerVisible = true">{{ t('javaManager.manage') }}</NButton>
    </div>
    <span v-if="!store.isLoading && !availableRuntimes.length" class="java-runtime-hint">{{
      t('settings.javaEmpty')
    }}</span>
    <span v-if="unavailableSelection" class="java-runtime-error" role="alert">{{
      t('settings.javaUnavailable', { path: value || inheritedValue })
    }}</span>
    <span v-if="error" class="java-runtime-error" role="alert">{{ error }}</span>
  </div>
  <JavaManagerModal
    v-model:visible="managerVisible"
    :requiredMajor="requiredMajor"
    :scopeKey="contextKey"
    :gamePath="gamePath"
    :versionId="versionId"
    @selected="selectRuntime"
  />
</template>

<script setup lang="ts">
import { NButton, NSelect } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { javaApi } from '@/features/java/api/javaApi'
import JavaManagerModal from '@/features/java/components/JavaManagerModal.vue'
import { useJavaRuntimeStore } from '@/features/java/stores/javaRuntimeStore'
import type { JavaRuntime } from '@/types/java'
import { getErrorMessage } from '@/utils/error'

const props = withDefaults(
  defineProps<{
    value?: string | null
    inheritedValue?: string
    requiredMajor?: number | null
    gamePath?: string
    versionId?: string
    contextKey?: string
  }>(),
  { value: null, inheritedValue: undefined, requiredMajor: null, contextKey: 'global', gamePath: '', versionId: '' }
)
const emit = defineEmits<{ 'update:value': [value: string] }>()
const { t } = useI18n()
const store = useJavaRuntimeStore()
const error = ref('')
const selecting = ref(false)
const managerVisible = ref(false)
let selectionRevision = 0
const availableRuntimes = computed(() =>
  store.runtimes.filter(
    (runtime) =>
      runtime.isEnabled &&
      runtime.validationStatus === 'valid' &&
      (!props.requiredMajor || runtime.majorVersion >= props.requiredMajor)
  )
)
const options = computed(() =>
  availableRuntimes.value.map((runtime) => ({
    value: runtime.executablePath,
    label: `Java ${runtime.majorVersion} · ${runtime.vendor || t('javaManager.unknownVendor')} · ${runtime.runtimeKind} · ${runtime.fullVersion} · ${runtime.architecture} · ${runtime.executablePath}`,
  }))
)
const unavailableSelection = computed(() => {
  const path = props.value || props.inheritedValue
  return !!path && !availableRuntimes.value.some((runtime) => runtime.executablePath === path)
})
watch(
  () => [props.contextKey, props.gamePath, props.versionId, props.requiredMajor],
  () => {
    selectionRevision++
    managerVisible.value = false
    selecting.value = false
    error.value = ''
  }
)
function selectRuntime(runtime: JavaRuntime): void {
  emit('update:value', runtime.executablePath)
  managerVisible.value = false
}
async function chooseRuntime(path: string | null): Promise<void> {
  if (selecting.value) return
  if (!path) {
    if (props.inheritedValue !== undefined) emit('update:value', '')
    return
  }
  const runtime = availableRuntimes.value.find((item) => item.executablePath === path)
  if (!runtime) return
  const revision = ++selectionRevision
  const target =
    props.gamePath && props.versionId ? { gamePath: props.gamePath, versionId: props.versionId } : undefined
  selecting.value = true
  error.value = ''
  try {
    const verified = await javaApi.select(runtime, props.requiredMajor, target)
    if (revision === selectionRevision) emit('update:value', verified.executablePath)
  } catch (cause) {
    if (revision === selectionRevision) error.value = getErrorMessage(cause)
  } finally {
    if (revision === selectionRevision) selecting.value = false
  }
}
async function scan(force = false): Promise<void> {
  const revision = selectionRevision
  error.value = ''
  try {
    await store.load(force)
  } catch (cause) {
    if (revision === selectionRevision) error.value = getErrorMessage(cause)
  }
}
onMounted(() => void scan())
onBeforeUnmount(() => {
  selectionRevision++
})
</script>

<style scoped>
.java-runtime-selector {
  width: min(600px, 100%);
  min-width: 0;
}
.java-runtime-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.java-runtime-controls :deep(.n-select) {
  flex: 1;
  min-width: 140px;
}
.java-runtime-hint {
  display: block;
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.java-runtime-error {
  overflow-wrap: anywhere;
  display: block;
  margin-top: 6px;
  color: var(--error);
  font-size: 12px;
}
</style>
