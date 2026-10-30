<template>
  <Modal
    :visible="visible"
    :title="t('plugins.permissionsTitle', { name: plugin?.title || plugin?.name || '' })"
    width="min(620px, calc(100vw - 48px))"
    :closable="!saving"
    @update:visible="close"
  >
    <div class="plugin-permissions">
      <UiLoading v-if="loading" mode="inline" :label="t('common.loading')" />
      <NAlert v-else-if="loadError" type="error" :showIcon="false"
        >{{ t('plugins.permissionsLoadFailed') }} <NButton text @click="load">{{ t('common.retry') }}</NButton></NAlert
      >
      <template v-else-if="view">
        <p>{{ t('plugins.baseAccessNote') }}</p>
        <section v-if="hasGameAccess" class="game-access">
          <strong>{{ t('plugins.gameAccessTitle') }}</strong>
          <NRadioGroup v-model:value="gameAccess" :disabled="saving" :aria-label="t('plugins.gameAccessTitle')">
            <NRadio value="deny">{{ t('plugins.gameAccessDenied') }}</NRadio>
            <NRadio v-if="declaresRead" value="read">{{ t('plugins.capabilities.instances_read') }}</NRadio>
            <NRadio v-if="declaresManage" value="manage">{{ t('plugins.capabilities.instances_manage') }}</NRadio>
          </NRadioGroup>
          <p v-if="gameAccess === 'manage'">{{ t('plugins.manageAccessNote') }}</p>
          <PluginResourceSelector
            v-model:selected="selectedResources"
            :capability="resourceCapability"
            :view="view"
            :disabled="saving"
            @revision="resourceRevision = $event"
            @busy="resourcesBusy = $event"
          />
        </section>
        <section v-if="networkPermission" class="network-access">
          <NCheckbox
            :checked="allowNetwork"
            :disabled="saving || !networkPermission.implemented"
            @update:checked="allowNetwork = $event"
            >{{ t('plugins.capabilities.network_read') }}</NCheckbox
          >
          <p>{{ t('plugins.permissionNetworkNote') }}</p>
          <ul class="permission-origins" :aria-label="t('plugins.permissionNetworkOrigins')" tabindex="0">
            <li v-for="origin in networkPermission.requested_resource_refs" :key="origin">
              {{ displayOrigin(origin) }}
            </li>
          </ul>
        </section>
        <p v-if="requiredMissing" role="status">{{ t('plugins.requiredAccessMissing') }}</p>
        <details v-if="view.items.length">
          <summary>{{ t('plugins.permissionOptions') }}</summary>
          <NRadioGroup v-model:value="lifetime" :disabled="saving" :aria-label="t('plugins.permissionLifetime')">
            <NRadio value="permanent">{{ t('plugins.permissionPermanent') }}</NRadio>
            <NRadio value="session">{{ t('plugins.permissionSession') }}</NRadio>
          </NRadioGroup>
        </details>
        <NAlert v-if="actionError" type="error" :showIcon="false">{{ actionError }}</NAlert>
        <p v-if="resultMessage" role="status">{{ resultMessage }}</p>
      </template>
    </div>
    <template #footer>
      <NButton :disabled="saving" @click="close(false)">{{ t('common.close') }}</NButton>
      <NButton
        v-if="view?.revision && view.items.length"
        type="error"
        :disabled="saving || loading"
        @click="save(true)"
        >{{ t('plugins.permissionsRevoke') }}</NButton
      >
      <NButton type="primary" :loading="saving" :disabled="!canSave" @click="save(false)">{{
        t(primaryLabel)
      }}</NButton>
    </template>
  </Modal>
</template>
<script setup lang="ts">
import { NAlert, NButton, NCheckbox, NRadio, NRadioGroup } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useRequestScope } from '@/composables/useRequestScope'
import { pluginManagementApi } from '@/features/plugins/api/pluginManagementApi'
import { usePluginStore } from '@/features/plugins/stores/pluginStore'
import type { PluginInfo, PluginPermissions, PluginPermissionDecision, PluginInstanceCapability } from '@/types/plugins'
import PluginResourceSelector from './PluginResourceSelector.vue'
const props = defineProps<{ visible: boolean; plugin: PluginInfo | null }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'saved'): void }>()
const { t } = useI18n()
const store = usePluginStore()
const view = ref<PluginPermissions | null>(null)
const gameAccess = ref<'deny' | 'read' | 'manage'>('deny')
const selectedResources = ref<string[]>([])
const resourceRevision = ref<number>()
const resourcesBusy = ref(false)
const allowNetwork = ref(false)
const lifetime = ref<'session' | 'permanent'>('permanent')
const loading = ref(false)
const saving = ref(false)
const loadError = ref(false)
const actionError = ref('')
const resultMessage = ref('')
const retryEnable = ref(false)
let savedSignature = ''
const scope = useRequestScope(
  () => String(props.visible) + ':' + props.plugin?.installation_id + ':' + props.plugin?.content_digest
)
const declaresRead = computed(
  () => view.value?.items.some((item) => item.capability === 'instances.read' && item.implemented) ?? false
)
const declaresManage = computed(
  () => view.value?.items.some((item) => item.capability === 'instances.manage' && item.implemented) ?? false
)
const hasGameAccess = computed(() => declaresRead.value || declaresManage.value)
const networkPermission = computed(() => view.value?.items.find((item) => item.capability === 'network.read'))
const resourceCapability = computed<PluginInstanceCapability>(() =>
  gameAccess.value === 'read' || !declaresManage.value ? 'instances.read' : 'instances.manage'
)
const shouldEnable = computed(() => !['enabled', 'stopping'].includes(props.plugin?.status ?? ''))
const primaryLabel = computed(() => {
  if (!shouldEnable.value) return 'plugins.permissionsSave'
  return retryEnable.value ? 'plugins.retryEnable' : 'plugins.agreeAndEnable'
})
const decisions = computed<PluginPermissionDecision[]>(() =>
  (view.value?.items ?? []).map((item) => {
    let allow = false
    let refs: string[] = []
    if (item.implemented) {
      if (item.capability === 'network.read') {
        allow = allowNetwork.value
        refs = item.requested_resource_refs
      } else {
        allow = gameAccess.value === 'manage' || (item.capability === 'instances.read' && gameAccess.value === 'read')
        refs = selectedResources.value
      }
    }
    return {
      capability: item.capability,
      decision: allow ? 'allow' : 'deny',
      resource_refs: allow ? refs : [],
      lifetime: lifetime.value,
    }
  })
)
const requiredMissing = computed(
  () =>
    view.value?.items.some(
      (item) =>
        item.required &&
        decisions.value.find((decision) => decision.capability === item.capability)?.decision !== 'allow'
    ) ?? false
)
const needsRoots = computed(() => hasGameAccess.value && gameAccess.value !== 'deny')
const canSave = computed(
  () =>
    !!view.value &&
    !loading.value &&
    !loadError.value &&
    !saving.value &&
    !resourcesBusy.value &&
    !requiredMissing.value &&
    (!needsRoots.value || (selectedResources.value.length > 0 && resourceRevision.value !== undefined))
)
function displayOrigin(reference: string): string {
  const [scheme, host, port] = reference.split(':')
  return scheme + '://' + host + ':' + port
}
function close(visible: boolean): void {
  if (!saving.value) emit('update:visible', visible)
}
async function load(): Promise<void> {
  const id = props.plugin?.installation_id
  if (!props.visible || !id) return
  const current = scope.begin()
  loading.value = true
  loadError.value = false
  view.value = null
  actionError.value = ''
  resultMessage.value = ''
  retryEnable.value = false
  savedSignature = ''
  try {
    const result = await pluginManagementApi.permissions(id)
    if (!current()) return
    view.value = result
    const management = result.items.find((item) => item.capability === 'instances.manage')
    const read = result.items.find((item) => item.capability === 'instances.read')
    if (management?.decision === 'allow') gameAccess.value = 'manage'
    else if (read?.decision === 'allow') gameAccess.value = 'read'
    else if (result.revision === 0 && management?.implemented && (!read?.required || management.required))
      gameAccess.value = 'manage'
    else if (result.revision === 0 && read?.implemented) gameAccess.value = 'read'
    else gameAccess.value = 'deny'
    selectedResources.value = [
      ...new Set([...(management?.selected_resource_refs ?? []), ...(read?.selected_resource_refs ?? [])]),
    ]
    resourceRevision.value = undefined
    allowNetwork.value = result.items.some(
      (item) =>
        item.capability === 'network.read' && item.implemented && (item.decision === 'allow' || result.revision === 0)
    )
  } catch {
    if (current()) loadError.value = true
  } finally {
    if (current()) loading.value = false
  }
}
async function save(revoke: boolean): Promise<void> {
  if (saving.value || loading.value || !view.value || !props.plugin || (!revoke && !canSave.value)) return
  const target = props.plugin
  const enable = shouldEnable.value && !revoke
  const current = scope.begin()
  saving.value = true
  actionError.value = ''
  resultMessage.value = ''
  let isSaved = false
  let cleanupPending = false
  try {
    const choices: PluginPermissionDecision[] = revoke
      ? view.value.items.map((item) => ({
          capability: item.capability,
          decision: 'deny',
          resource_refs: [],
          lifetime: lifetime.value,
        }))
      : decisions.value
    const signature = JSON.stringify(choices)
    if (!enable || savedSignature !== signature) {
      const result = await pluginManagementApi.updatePermissions(view.value, choices, resourceRevision.value)
      if (!current()) return
      view.value = {
        ...view.value,
        revision: result.revision,
        grant_epoch: result.grant_epoch,
        required_satisfied: result.required_satisfied,
      }
      savedSignature = signature
      cleanupPending = result.cleanup_state === 'pending'
      emit('saved')
    }
    isSaved = true
    if (revoke) {
      gameAccess.value = 'deny'
      allowNetwork.value = false
      selectedResources.value = []
    }
    if (enable) {
      const result = await store.enableReviewed(target, view.value)
      if (!current()) return
      if (result.status !== 'success') throw new Error('PLUGIN_ENABLE_BUSY')
      emit('saved')
      emit('update:visible', false)
    } else resultMessage.value = t(cleanupPending ? 'plugins.permissionsCleanupPending' : 'plugins.permissionsSaved')
  } catch {
    if (current()) {
      retryEnable.value = enable && isSaved
      actionError.value = t(retryEnable.value ? 'plugins.savedButEnableFailed' : 'plugins.permissionsSaveFailed')
    }
  } finally {
    saving.value = false
  }
}
watch(
  () => [props.visible, props.plugin?.installation_id, props.plugin?.content_digest] as const,
  () => {
    lifetime.value = 'permanent'
    if (props.visible) void load()
    else {
      scope.invalidate()
      view.value = null
      loadError.value = false
      loading.value = false
    }
  },
  { immediate: true }
)
</script>
<style scoped>
.plugin-permissions,
.game-access,
.network-access {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.plugin-permissions {
  min-height: 120px;
}
.plugin-permissions p {
  margin: 0;
  color: var(--ecl-text-secondary);
}
.game-access :deep(.n-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.permission-origins {
  margin: 0;
  padding-left: 20px;
  max-height: 130px;
  overflow: auto;
  overflow-wrap: anywhere;
}
details summary {
  cursor: pointer;
  color: var(--ecl-text-secondary);
}
details summary:focus-visible {
  outline: 2px solid var(--ecl-primary);
  outline-offset: 3px;
}
details :deep(.n-radio-group) {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
</style>
