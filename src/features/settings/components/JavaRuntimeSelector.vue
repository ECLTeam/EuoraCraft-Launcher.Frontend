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
    </div>
    <span v-if="error" class="java-runtime-error" role="alert">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSelect } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { getErrorMessage } from '@/utils/error'
const props = defineProps<{ value?: string | null }>()
const emit = defineEmits<{ 'update:value': [value: string] }>()
const { t } = useI18n()
const store = useSettingsStore()
const error = ref('')
const browsing = ref(false)
const options = computed(() => {
  const options = store.javaInstallations.map((java) => ({
    value: java.path,
    label: `Java ${java.major_version} (${[java.vendor || java.java_type, java.runtime_kind].filter(Boolean).join(' · ')}) · ${java.version} · ${java.arch} · ${java.path}`,
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
  browsing.value = true
  error.value = ''
  try {
    const path = await settingsApi.selectJava()
    if (path) emit('update:value', path)
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    browsing.value = false
  }
}
onMounted(() => void scan())
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
