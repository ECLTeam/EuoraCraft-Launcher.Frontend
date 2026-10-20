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
      <NAlert v-else-if="error" type="error" :showIcon="false">
        {{ error }}
        <NButton text @click="load">{{ t('common.retry') }}</NButton>
      </NAlert>
      <template v-else-if="view">
        <p class="permission-note">{{ t('plugins.permissionsNote') }}</p>
        <p v-if="!view.items.length">{{ t('plugins.permissionsEmpty') }}</p>
        <div v-for="item in view.items" :key="item.capability" class="permission-row">
          <div class="permission-label">
            <strong>{{ capabilityLabel(item.capability) }}</strong>
            <span>{{ t(item.required ? 'plugins.permissionRequired' : 'plugins.permissionOptional') }}</span>
            <span v-if="!item.implemented">{{ t('plugins.permissionUnavailable') }}</span>
          </div>
          <NCheckbox
            :checked="allowed.includes(item.capability)"
            :disabled="saving || !item.implemented"
            @update:checked="toggle(item.capability, $event)"
          >
            <span class="permission-accessible-label">{{ capabilityLabel(item.capability) }} </span>
            {{ t('plugins.permissionAllow') }}
          </NCheckbox>
        </div>
        <PluginResourceSelector
          v-if="view.items.some((item) => item.capability === 'instances.read' && item.implemented)"
          v-model:selected="selectedResources"
          :view="view"
          :disabled="saving"
          @revision="resourceRevision = $event"
          @busy="resourceLoading = $event"
        />
        <NRadioGroup v-model:value="lifetime" :disabled="saving" :aria-label="t('plugins.permissionLifetime')">
          <NRadio value="permanent">{{ t('plugins.permissionPermanent') }}</NRadio>
          <NRadio value="session">{{ t('plugins.permissionSession') }}</NRadio>
        </NRadioGroup>
        <p v-if="resultMessage" role="status">{{ resultMessage }}</p>
      </template>
    </div>
    <template #footer>
      <NButton :disabled="saving" @click="close(false)">{{ t('common.close') }}</NButton>
      <NButton v-if="view?.revision" type="error" :disabled="saving || loading" @click="save(true)">
        {{ t('plugins.permissionsRevoke') }}
      </NButton>
      <NButton
        type="primary"
        :loading="saving"
        :disabled="!view || loading || !!error || resourceLoading || needsResourceRevision"
        @click="save(false)"
      >
        {{ t('plugins.permissionsSave') }}
      </NButton>
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
import type { PluginInfo, PluginPermissions } from '@/types/plugins'
import PluginResourceSelector from './PluginResourceSelector.vue'

const props = defineProps<{ visible: boolean; plugin: PluginInfo | null }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void; (e: 'saved'): void }>()
const { t, te } = useI18n()
const view = ref<PluginPermissions | null>(null)
const allowed = ref<string[]>([])
const selectedResources = ref<string[]>([])
const resourceRevision = ref<number>()
const resourceLoading = ref(false)
const needsResourceRevision = computed(
  () => allowed.value.includes('instances.read') && resourceRevision.value === undefined
)
const lifetime = ref<'session' | 'permanent'>('permanent')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const resultMessage = ref('')
const scope = useRequestScope(() => `${props.visible}:${props.plugin?.installation_id ?? ''}`)

function capabilityLabel(capability: string): string {
  const key = `plugins.capabilities.${capability.replace('.', '_')}`
  return te(key) ? t(key) : capability
}

function toggle(capability: string, checked: boolean): void {
  allowed.value = checked ? [...allowed.value, capability] : allowed.value.filter((item) => item !== capability)
}

function close(visible: boolean): void {
  if (!saving.value) emit('update:visible', visible)
}

async function load(): Promise<void> {
  const id = props.plugin?.installation_id
  if (!props.visible || !id) return
  const current = scope.begin()
  loading.value = true
  error.value = ''
  view.value = null
  resultMessage.value = ''
  try {
    const result = await pluginManagementApi.permissions(id)
    if (!current()) return
    view.value = result
    selectedResources.value =
      result.items.find((item) => item.capability === 'instances.read')?.selected_resource_refs ?? []
    resourceRevision.value = undefined
    allowed.value = result.items
      .filter((item) => item.implemented && item.decision === 'allow')
      .map((item) => item.capability)
  } catch {
    if (current()) error.value = t('plugins.permissionsLoadFailed')
  } finally {
    if (current()) loading.value = false
  }
}

async function save(revoke: boolean): Promise<void> {
  if (
    saving.value ||
    loading.value ||
    !view.value ||
    (!revoke && (resourceLoading.value || needsResourceRevision.value))
  )
    return
  const reviewed = view.value
  const current = scope.begin()
  saving.value = true
  error.value = ''
  try {
    const result = await pluginManagementApi.updatePermissions(
      reviewed,
      reviewed.items.map((item) => ({
        capability: item.capability,
        resource_refs: revoke
          ? []
          : item.capability === 'instances.read'
            ? selectedResources.value
            : item.resource_refs,
        decision: !revoke && item.implemented && allowed.value.includes(item.capability) ? 'allow' : 'deny',
        lifetime: lifetime.value,
      })),
      resourceRevision.value
    )
    if (!current()) return
    view.value = {
      ...reviewed,
      revision: result.revision,
      grant_epoch: result.grant_epoch,
      required_satisfied: result.required_satisfied,
    }
    if (revoke) {
      allowed.value = []
      selectedResources.value = []
    }
    resultMessage.value = t(
      result.cleanup_state === 'pending' ? 'plugins.permissionsCleanupPending' : 'plugins.permissionsSaved'
    )
    emit('saved')
  } catch {
    if (current()) error.value = t('plugins.permissionsSaveFailed')
  } finally {
    saving.value = false
  }
}

watch(
  () => [props.visible, props.plugin?.installation_id] as const,
  () => {
    lifetime.value = 'permanent'
    if (props.visible) void load()
    else {
      scope.invalidate()
      view.value = null
      error.value = ''
      loading.value = false
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.plugin-permissions {
  display: grid;
  gap: 16px;
  min-height: 120px;
}
.permission-note {
  margin: 0;
  color: var(--text-color-secondary);
  line-height: 1.6;
}
.permission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.permission-label {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.permission-label span {
  color: var(--text-color-secondary);
  font-size: 12px;
}
.permission-accessible-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
