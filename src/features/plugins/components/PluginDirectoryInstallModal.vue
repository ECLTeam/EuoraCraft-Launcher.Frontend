<template>
  <Modal
    :visible="visible"
    :title="t('plugins.directoryInstallTitle')"
    width="min(520px, calc(100vw - 32px))"
    :closable="!installing"
    @update:visible="emit('update:visible', $event)"
  >
    <div v-if="selection" class="package-install">
      <div class="package-heading">
        <UiIcon name="folder" :size="20" />
        <div class="package-heading-text">
          <strong>{{ selection.preflight.name }}</strong>
          <span :title="selection.path">{{ fileName(selection.path) }}</span>
        </div>
        <NTag size="small" :bordered="false">v{{ selection.preflight.version }}</NTag>
      </div>

      <dl class="package-facts">
        <div>
          <dt>{{ t('plugins.directorySource') }}</dt>
          <dd :title="selection.preflight.source_path">{{ selection.preflight.source_path }}</dd>
        </div>
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
          <dt>{{ t('plugins.packageDependencyDirectory') }}</dt>
          <dd>
            {{
              selection.preflight.dependencies_ready
                ? t('plugins.packageDependenciesReady')
                : t('plugins.packageDependenciesMissing')
            }}
          </dd>
        </div>
      </dl>

      <div v-if="selection.preflight.python_dependencies.length" class="package-dependencies">
        {{ selection.preflight.python_dependencies.join(', ') }}
      </div>

      <NAlert type="warning" :showIcon="false" class="package-warning">
        {{ t('plugins.directoryUnverifiedWarning') }}
      </NAlert>
      <NCheckbox v-model:checked="confirmed" :disabled="installing">
        {{ t('plugins.directoryConfirmSource') }}
      </NCheckbox>

      <div class="package-options">
        <div class="package-option-row">
          <span>{{ t('plugins.packageAllowNetwork') }}</span>
          <NSwitch v-model:value="allowNetwork" :disabled="installing" />
        </div>
      </div>

      <div v-if="installing" class="package-installing" role="status">
        <UiLoading mode="inline" size="sm" decorative />
        <span>{{ t('plugins.directoryInstalling') }}</span>
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
import { UiIcon, UiLoading } from '@/components/ui'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginDirectorySelection } from '@/types/plugins'

const props = defineProps<{
  visible: boolean
  selection: PluginDirectorySelection | null
}>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'installed'): void
}>()

const { t } = useI18n()
const store = usePluginStore()
const message = useLauncherMessage()
const { loading: installing, run: runInstall } = useAsyncAction()
const confirmed = ref(false)
const allowNetwork = ref(true)
const canInstall = computed(() => !!props.selection && confirmed.value && !installing.value)

watch(
  () => props.selection,
  () => {
    confirmed.value = false
    allowNetwork.value = true
  }
)

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

async function install(): Promise<void> {
  if (!canInstall.value || !props.selection) return
  const selection = props.selection
  const installed = await runInstall(
    async () => {
      return store.installDirectory(selection, {
        allowNetwork: allowNetwork.value,
      })
    },
    {
      showError: true,
      errorMessage: t('plugins.installFailed'),
    }
  )
  if (installed) {
    message.success(installed.message || t('plugins.packageInstallRestart'))
    emit('installed')
  }
}
</script>

<style scoped src="@/styles/features/plugins/PluginPackageInstallModal.css"></style>
