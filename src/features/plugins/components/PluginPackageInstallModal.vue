<template>
  <Modal
    :visible="visible"
    :title="t('plugins.packageInstallTitle')"
    width="520px"
    :closable="!installing"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="selection" class="package-install">
      <div class="package-heading">
        <UiIcon name="archive" :size="20" />
        <div class="package-heading-text">
          <strong>{{ selection.preflight.package.name }}</strong>
          <span>{{ fileName(selection.path) }}</span>
        </div>
        <NTag size="small" :bordered="false">v{{ selection.preflight.package.version }}</NTag>
      </div>

      <dl class="package-facts">
        <div>
          <dt>{{ t('plugins.packageTarget') }}</dt>
          <dd>{{ selection.preflight.target_tag }}</dd>
        </div>
        <div>
          <dt>{{ t('plugins.packageDependencies') }}</dt>
          <dd>{{ selection.preflight.python_dependencies.length }}</dd>
        </div>
        <div>
          <dt>{{ t('plugins.packageOfflineWheels') }}</dt>
          <dd>{{ selection.preflight.wheel_count }}</dd>
        </div>
        <div>
          <dt>{{ t('plugins.packageRuntime') }}</dt>
          <dd>
            {{
              selection.preflight.runtime_ready ? t('plugins.packageRuntimeReady') : t('plugins.packageRuntimeMissing')
            }}
          </dd>
        </div>
      </dl>

      <div v-if="selection.preflight.python_dependencies.length" class="package-dependencies">
        {{ selection.preflight.python_dependencies.join(', ') }}
      </div>

      <NAlert type="warning" :showIcon="false" class="package-warning">
        {{ t('plugins.packageUnverifiedWarning') }}
      </NAlert>
      <NCheckbox v-model:checked="confirmed" :disabled="installing">
        {{ t('plugins.packageConfirmUnverified') }}
      </NCheckbox>

      <div class="package-options">
        <div class="package-option-row">
          <span>{{ t('plugins.packageAllowNetwork') }}</span>
          <NSwitch v-model:value="allowNetwork" :disabled="installing" />
        </div>
        <div v-if="!selection.preflight.runtime_ready" class="package-runtime-row">
          <NButton size="small" :disabled="installing" :loading="selectingRuntime" @click="pickRuntimePack">
            <template #icon><UiIcon name="folder-open" :size="14" /></template>
            {{ t('plugins.packageChooseRuntime') }}
          </NButton>
          <span v-if="offlineRuntimePack" :title="offlineRuntimePack">{{ fileName(offlineRuntimePack) }}</span>
        </div>
      </div>

      <div v-if="!canInstall && confirmed && !installing" class="package-requirement">
        {{ t('plugins.packageRuntimeRequired') }}
      </div>
      <div v-if="installing" class="package-installing" role="status">
        <UiLoading mode="inline" size="sm" decorative />
        <span>{{ t('plugins.packageInstalling') }}</span>
      </div>
    </div>

    <template #footer>
      <NButton :disabled="installing" @click="emit('update:visible', false)">
        {{ t('common.cancel') }}
      </NButton>
      <NButton type="primary" :loading="installing" :disabled="!canInstall" @click="install">
        <template #icon><UiIcon name="download" :size="15" /></template>
        {{ t('plugins.install') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCheckbox, NSwitch, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginPackageSelection } from '@/types/plugins'

const props = defineProps<{
  visible: boolean
  selection: PluginPackageSelection | null
}>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'installed'): void
}>()

const { t } = useI18n()
const store = usePluginStore()
const { loading: installing, run: runInstall } = useAsyncAction()
const { loading: selectingRuntime, run: runSelectRuntime } = useAsyncAction()
const confirmed = ref(false)
const allowNetwork = ref(true)
const offlineRuntimePack = ref<string | null>(null)
const canInstall = computed(
  () =>
    !!props.selection &&
    confirmed.value &&
    !installing.value &&
    (props.selection.preflight.runtime_ready || allowNetwork.value || !!offlineRuntimePack.value)
)

watch(
  () => props.selection,
  () => {
    confirmed.value = false
    allowNetwork.value = true
    offlineRuntimePack.value = null
  }
)

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

async function pickRuntimePack(): Promise<void> {
  const path = await runSelectRuntime(() => pluginManagementApi.selectRuntimePack(), {
    showError: true,
    errorMessage: t('plugins.packageRuntimePickFailed'),
  })
  if (path) offlineRuntimePack.value = path
}

async function install(): Promise<void> {
  if (!canInstall.value || !props.selection) return
  const selection = props.selection
  const installed = await runInstall(
    async () => {
      await store.installPackage(selection, {
        allowNetwork: allowNetwork.value,
        offlineRuntimePack: offlineRuntimePack.value,
      })
      return true
    },
    {
      showSuccess: true,
      successMessage: t('plugins.installSuccess'),
      showError: true,
      errorMessage: t('plugins.installFailed'),
    }
  )
  if (installed) emit('installed')
}
</script>

<style scoped src="@/styles/features/plugins/PluginPackageInstallModal.css"></style>
