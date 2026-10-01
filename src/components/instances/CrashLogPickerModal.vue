<template>
  <Modal
    :visible="visible"
    :parentId="parentId"
    :title="t('crashPick.title')"
    width="560px"
    wrapperClass="crash-picker-modal"
    bodyClass="crash-picker-modal-body"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="loading" class="crash-picker-loading">
      <UiLoading mode="inline" size="sm" decorative />
      <span>{{ t('crashPick.loading') }}</span>
    </div>

    <template v-else>
      <label class="cp-field">
        <span>{{ t('crashPick.logFile') }}</span>
        <div class="cp-row">
          <NSelect
            :value="selectedPath || undefined"
            :options="selectOptions"
            :placeholder="t('crashPick.placeholder')"
            :disabled="selectOptions.length === 0"
            filterable
            clearable
            @update:value="selectedPath = String($event ?? '')"
          />
          <NButton :loading="loading" @click="pickManual">
            {{ t('crashPick.selectFile') }}
          </NButton>
        </div>
        <small v-if="selectOptions.length === 0">{{ t('crashPick.empty') }}</small>
      </label>
    </template>

    <template #footer>
      <NButton @click="emit('update:visible', false)">
        {{ t('common.cancel') }}
      </NButton>
      <NButton type="primary" :disabled="!selectedPath" @click="handleAnalyze">
        <template #icon><UiIcon name="search" :size="15" /></template>
        {{ t('crashPick.analyze') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton, NSelect, type SelectOption } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { instanceRuntimeApi } from '@/features/instances/api/instanceRuntimeApi'
import type { CrashCandidateFile, ScannedVersion } from '@/types/instances'
import { formatFileSize, formatTimestamp } from '@/utils/format'

const props = defineProps<{
  visible: boolean
  parentId?: string | null
  version: ScannedVersion | null
  gamePath: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'analyze', path: string): void
}>()

const { t } = useI18n()

const loading = ref(false)
const candidates = ref<CrashCandidateFile[]>([])
const selectedPath = ref('')

const selectOptions = computed<SelectOption[]>(() =>
  candidates.value.map((candidate) => ({
    value: candidate.path,
    label: `${candidate.name} · ${formatFileSize(candidate.size)} · ${formatTimestamp(candidate.mtime)}`,
  }))
)

async function loadCandidates() {
  if (!props.version) return
  loading.value = true
  try {
    candidates.value = await instanceRuntimeApi.listCrashCandidates(
      props.gamePath,
      props.version.versionId || props.version.id
    )
    selectedPath.value = candidates.value[0]?.path ?? ''
  } finally {
    loading.value = false
  }
}

async function pickManual() {
  const result = await backend.command('select_file', { purpose: 'crash-analysis' })
  if (!result.success || !result.data?.path) return
  emit('update:visible', false)
  emit('analyze', result.data.path as string)
}

function handleAnalyze() {
  if (!selectedPath.value) return
  emit('update:visible', false)
  emit('analyze', selectedPath.value)
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      selectedPath.value = ''
      candidates.value = []
      loadCandidates()
    }
  },
  { immediate: true }
)
</script>

<style scoped src="@/styles/components/instances/CrashLogPickerModal.css"></style>
