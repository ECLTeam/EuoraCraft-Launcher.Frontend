<template>
  <Modal
    :visible="visible"
    :title="t('plugins.fileRecoveryTitle')"
    width="min(720px, calc(100vw - 48px))"
    :closable="!submitting"
    @update:visible="close"
  >
    <div class="file-recoveries">
      <NRadioGroup
        v-model:value="kind"
        :disabled="submitting"
        :aria-label="t('plugins.fileRecoveryKind')"
        class="file-recovery-kinds"
      >
        <NRadioButton value="private">{{ t('plugins.fileRecoveryPrivate') }}</NRadioButton>
        <NRadioButton value="profile">{{ t('plugins.fileRecoveryProfile') }}</NRadioButton>
      </NRadioGroup>
      <p>{{ t('plugins.fileRecoveryNote') }}</p>
      <NAlert v-if="error" type="error" :showIcon="false">
        {{ error }}
        <NButton text :disabled="busy" @click="load()">{{ t('common.retry') }}</NButton>
      </NAlert>
      <NAlert v-if="notice" :type="hasFailed ? 'warning' : 'info'" :showIcon="false" role="status">{{ notice }}</NAlert>
      <UiLoading v-if="loading" mode="inline" :label="t('common.loading')" />
      <NEmpty v-else-if="!rows.length && !error" :description="t('plugins.fileRecoveryEmpty')" />
      <article v-for="row in rows" :key="row.recovery_ref" class="file-recovery-row">
        <strong :title="row.name">{{ row.name || t('plugins.fileRecoveryUnknown') }}</strong>
        <p>{{ t(`plugins.fileRecoveryState_${row.state}`) }}</p>
        <div class="file-recovery-actions">
          <NButton v-if="row.actions.includes('restore')" :disabled="busy" @click="resolve(row, 'restore')">
            {{ t('plugins.fileRecoveryRestore') }}
          </NButton>
          <NPopconfirm
            v-if="row.actions.includes('discard')"
            :disabled="busy"
            :positiveText="t('common.confirm')"
            :negativeText="t('common.cancel')"
            @positiveClick="resolve(row, 'discard')"
          >
            <template #trigger
              ><NButton type="error" :disabled="busy">{{ t('plugins.fileRecoveryDiscard') }}</NButton></template
            >
            {{ t('plugins.fileRecoveryDiscardConfirm', { name: row.name }) }}
          </NPopconfirm>
        </div>
        <div v-if="row.actions.includes('save_as')" class="file-recovery-save">
          <NInput
            v-model:value="savedNames[row.recovery_ref]"
            :disabled="busy"
            :maxlength="kind === 'profile' ? 64 : 120"
            :placeholder="t(kind === 'profile' ? 'plugins.profileRecoverySuffix' : 'plugins.fileRecoveryName')"
            :aria-label="t(kind === 'profile' ? 'plugins.profileRecoverySuffix' : 'plugins.fileRecoveryName')"
          />
          <NButton :disabled="busy || !savedNames[row.recovery_ref]" @click="resolve(row, 'save_as')">
            {{ t('plugins.fileRecoverySaveAs') }}
          </NButton>
        </div>
      </article>
      <NButton v-if="cursor" :disabled="busy || loading" @click="load(cursor)">{{
        t('plugins.fileRecoveryMore')
      }}</NButton>
    </div>
    <template #footer>
      <NButton :disabled="submitting" @click="close(false)">{{ t('common.close') }}</NButton>
      <NButton :disabled="busy || loading" @click="load()">{{ t('common.refresh') }}</NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NInput, NPopconfirm, NRadioButton, NRadioGroup } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useRequestScope } from '@/composables/useRequestScope'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import { isFinishedOperation } from '@/types/operations'
import type { PluginFileRecovery, PluginFileRecoveryAction } from '@/types/plugins'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; resolved: [] }>()
const { t } = useI18n()
const kind = ref<'private' | 'profile'>('private')
const scope = useRequestScope(() => `${props.visible}:${kind.value}`)
const actionScope = useRequestScope(() => `${props.visible}:${kind.value}`)
const operations = useApplicationOperationStore()
const rows = ref<PluginFileRecovery[]>([])
const savedNames = ref<Record<string, string>>({})
const cursor = ref<string | null>(null)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const hasFailed = ref(false)
const tasks = ref<Record<'private' | 'profile', string | null>>({ private: null, profile: null })
const task = computed({
  get: () => tasks.value[kind.value],
  set: (value) => {
    tasks.value[kind.value] = value
  },
})
const active = computed(() => (task.value ? operations.operations[task.value] : undefined))
const busy = computed(() => submitting.value || (!!task.value && (!active.value || !isFinishedOperation(active.value))))

function close(value: boolean) {
  if (submitting.value) return
  scope.invalidate()
  actionScope.invalidate()
  emit('update:visible', value)
}

async function load(next?: string) {
  const current = scope.begin()
  loading.value = true
  error.value = ''
  try {
    const page = await (kind.value === 'profile'
      ? pluginManagementApi.profileRecoveries(next)
      : pluginManagementApi.fileRecoveries(next))
    if (!current()) return
    rows.value = next
      ? [
          ...rows.value,
          ...page.items.filter((item) => !rows.value.some((row) => row.recovery_ref === item.recovery_ref)),
        ]
      : page.items
    cursor.value = page.next_cursor
  } catch {
    if (current()) error.value = t('plugins.fileRecoveryLoadFailed')
  } finally {
    if (current()) loading.value = false
  }
}

async function resolve(row: PluginFileRecovery, action: PluginFileRecoveryAction) {
  if (busy.value) return
  const recoveryKind = kind.value
  const name = savedNames.value[row.recovery_ref]
  if (action === 'save_as') {
    const valid =
      recoveryKind === 'profile'
        ? !!name && /^[A-Za-z0-9_-]{1,64}$/.test(name)
        : !!name && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name) && !name.endsWith('.')
    if (!valid) {
      error.value = t(
        recoveryKind === 'profile' ? 'plugins.profileRecoveryInvalidSuffix' : 'plugins.fileRecoveryInvalidName'
      )
      return
    }
  }
  submitting.value = true
  error.value = ''
  notice.value = ''
  const current = actionScope.begin()
  try {
    const choice = { recovery_ref: row.recovery_ref, expected_revision: row.revision, expected_etag: row.etag, action }
    const receipt = await (recoveryKind === 'profile'
      ? pluginManagementApi.resolveProfileRecovery({
          ...choice,
          ...(action === 'save_as' ? { saved_suffix: name } : {}),
        })
      : pluginManagementApi.resolveFileRecovery({ ...choice, ...(action === 'save_as' ? { saved_name: name } : {}) }))
    // 任务归应用所有，离开弹窗仍由共享任务服务跟踪。
    if (current()) task.value = receipt.operationId
    await operations.track(
      { ...receipt, kind: recoveryKind === 'profile' ? 'plugin_instance_profile_recovery' : 'plugin_file_recovery' },
      t('plugins.fileRecoveryTitle')
    )
  } catch {
    if (current()) error.value = t('plugins.fileRecoverySubmitFailed')
  } finally {
    if (current()) submitting.value = false
  }
}

watch(
  () => [props.visible, kind.value] as const,
  ([visible]) => {
    if (visible) {
      rows.value = []
      cursor.value = null
      notice.value = ''
      loading.value = false
      submitting.value = false
      void load()
    } else {
      scope.invalidate()
      actionScope.invalidate()
    }
  },
  { immediate: true }
)
watch(
  () => active.value?.status,
  (status) => {
    if (!props.visible || !active.value || !isFinishedOperation(active.value)) return
    hasFailed.value = status !== 'completed'
    notice.value = t(status === 'completed' ? 'plugins.fileRecoveryCompleted' : 'plugins.fileRecoveryFailed')
    emit('resolved')
    void load()
  }
)
</script>

<style scoped>
.file-recoveries {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.file-recovery-kinds {
  display: flex;
  flex-wrap: wrap;
}
.file-recovery-row {
  padding-block: 12px;
  border-top: 1px solid var(--border-color);
}
.file-recovery-row strong {
  overflow-wrap: anywhere;
}
.file-recovery-row p {
  margin-block: 8px;
}
.file-recovery-actions,
.file-recovery-save {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.file-recovery-save .n-input {
  flex: 1 1 200px;
  min-width: 0;
}
</style>
