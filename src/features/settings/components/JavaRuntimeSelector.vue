<template>
  <div class="java-runtime-selector">
    <div class="java-runtime-controls">
      <NSelect
        :value="value || null"
        :options="options"
        :placeholder="t('settings.javaPathPlaceholder')"
        :loading="store.isJavaLoading"
        filterable
        @update:value="emit('update:value', $event || '')"
      />
      <NButton size="small" :loading="browsing" @click="browse">{{ t('common.browse') }}</NButton>
      <NButton size="small" :loading="store.isJavaLoading" @click="scan(true)">{{ t('common.refresh') }}</NButton>
      <NButton size="small" @click="managerVisible = true">{{ t('javaManager.manage') }}</NButton>
    </div>
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
import { settingsApi } from '@/features/settings/api/settingsApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { JavaRuntime } from '@/types/java'
import { getErrorMessage } from '@/utils/error'
const props = withDefaults(
  defineProps<{
    value?: string | null
    requiredMajor?: number | null
    gamePath?: string
    versionId?: string
    contextKey?: string
  }>(),
  { value: null, requiredMajor: null, contextKey: 'global', gamePath: '', versionId: '' }
)
const emit = defineEmits<{ 'update:value': [value: string] }>()
const { t } = useI18n()
const store = useSettingsStore()
const error = ref('')
const browsing = ref(false)
const managerVisible = ref(false)
let selectionRevision = 0
watch(
  () => props.contextKey,
  () => {
    selectionRevision++
    managerVisible.value = false
    browsing.value = false
  }
)
function selectRuntime(runtime: JavaRuntime) {
  emit('update:value', runtime.executablePath)
  managerVisible.value = false
}
const options = computed(() => {
  const options = store.javaInstallations.map((java) => ({
    value: java.path,
    label: `Java ${java.major_version} (${[java.vendor === undefined ? java.java_type : java.vendor || t('javaManager.unknownVendor'), java.runtime_kind].filter(Boolean).join(' · ')}) · ${java.version} · ${java.arch} · ${java.path}`,
  }))
  if (props.value && !options.some((option) => option.value === props.value))
    options.unshift({ value: props.value, label: props.value })
  return options
})
async function scan(force = false) {
  error.value = ''
  try {
    await store.loadJavaInstallations(force)
  } catch (cause) {
    error.value = getErrorMessage(cause)
  }
}
async function browse() {
  if (browsing.value) return
  const revision = ++selectionRevision
  browsing.value = true
  error.value = ''
  try {
    const path = await settingsApi.selectJava()
    if (path && revision === selectionRevision) {
      const registered = await javaApi.register(path)
      const selected = await javaApi.select(
        registered,
        props.requiredMajor,
        props.gamePath && props.versionId ? { gamePath: props.gamePath, versionId: props.versionId } : undefined
      )
      await store.loadJavaInstallations(true)
      if (revision === selectionRevision) emit('update:value', selected.executablePath)
    }
  } catch (cause) {
    if (revision === selectionRevision) error.value = getErrorMessage(cause)
  } finally {
    if (revision === selectionRevision) browsing.value = false
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
.java-runtime-error {
  display: block;
  margin-top: 6px;
  color: var(--error);
  font-size: 12px;
}
</style>
