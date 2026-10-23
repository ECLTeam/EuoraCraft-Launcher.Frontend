<template>
  <section class="java-manager">
    <header class="java-manager-toolbar">
      <div class="java-manager-tabs" role="group" :aria-label="t('javaManager.title')">
        <button
          type="button"
          :aria-label="t('javaManager.installed')"
          :aria-pressed="view === 'installed'"
          @click="view = 'installed'"
        >
          <UiIcon name="cube" :size="15" />{{ t('javaManager.installed') }}
        </button>
        <button
          type="button"
          :aria-label="t('javaManager.download')"
          :aria-pressed="view === 'download'"
          @click="view = 'download'"
        >
          <UiIcon name="download" :size="15" />{{ t('javaManager.download') }}
        </button>
      </div>
      <div v-if="view === 'installed'" class="java-manager-actions">
        <UiButton size="sm" variant="ghost" icon="refresh" :loading="store.isLoading" @click="load(true)">{{
          t('javaManager.rescan')
        }}</UiButton>
        <UiButton size="sm" variant="ghost" icon="download" :loading="isCheckingUpdates" @click="checkUpdates">{{
          t('javaManager.checkUpdates')
        }}</UiButton>
        <UiButton size="sm" variant="secondary" icon="plus" :loading="isRegistering" @click="register">{{
          t('javaManager.add')
        }}</UiButton>
      </div>
    </header>

    <div class="java-manager-content">
      <NAlert v-if="error || store.error" type="error" closable @close="error = ''">{{ error || store.error }}</NAlert>
      <NAlert v-if="requiredMajor" type="info">{{ t('javaManager.requirement', { major: requiredMajor }) }}</NAlert>
      <NAlert v-if="store.inventory?.cleanupPendingCount" type="warning"
        >{{ t('javaManager.cleanupPending', { count: store.inventory.cleanupPendingCount }) }}
        <UiButton variant="secondary" size="sm" :disabled="isActing" @click="retryCleanup">{{
          t('javaManager.retryCleanup')
        }}</UiButton></NAlert
      >

      <template v-if="view === 'installed'">
        <NInput
          v-model:value="query"
          clearable
          size="small"
          :placeholder="t('javaManager.search')"
          :aria-label="t('javaManager.search')"
        >
          <template #prefix><UiIcon name="search" :size="15" /></template>
        </NInput>
        <UiLoading v-if="store.isLoading && !store.runtimes.length" :label="t('javaManager.scanning')" />
        <UiEmptyState
          v-else-if="!filteredRuntimes.length"
          class="java-manager-empty"
          :icon="query.trim() ? 'search' : 'cube'"
          :title="t(query.trim() ? 'javaManager.noMatch' : 'javaManager.empty')"
        >
          <UiButton v-if="query.trim()" variant="secondary" @click="query = ''">{{
            t('javaManager.clearSearch')
          }}</UiButton>
          <UiButton v-else variant="secondary" icon="download" @click="view = 'download'">{{
            t('javaManager.downloadJava')
          }}</UiButton>
        </UiEmptyState>
        <div v-else class="java-runtime-list">
          <article v-for="runtime in filteredRuntimes" :key="runtime.runtimeId" class="java-runtime-row">
            <div class="java-runtime-heading">
              <strong>Java {{ runtime.majorVersion || '?' }}</strong>
              <span>{{ runtime.vendor || t('javaManager.unknownVendor') }} · {{ runtime.runtimeKind }}</span>
            </div>
            <div class="java-runtime-metadata">
              <span
                >{{ runtime.fullVersion }} · {{ runtime.architecture }} ·
                {{ t(`javaManager.origins.${runtime.origin}`) }}</span
              >
              <NTag v-if="runtime.validationStatus !== 'valid'" size="small" type="error">{{
                t(`javaManager.validation.${runtime.validationStatus}`)
              }}</NTag>
              <NTag v-if="!runtime.isEnabled" size="small" type="warning">{{ t('javaManager.disabled') }}</NTag>
              <NTag v-if="runtime.isInUse" size="small" type="info">{{
                t(runtime.usageUnknown ? 'javaManager.usageUnknown' : 'javaManager.inUse')
              }}</NTag>
              <span v-if="runtime.references?.length">{{
                t('javaManager.referenced', { count: runtime.references.length })
              }}</span>
            </div>
            <details class="java-runtime-location">
              <summary :title="runtime.executablePath" :aria-label="t('javaManager.showPath')">
                <UiIcon name="folder" :size="14" />
                <span class="java-runtime-path">{{ runtime.executablePath }}</span>
                <UiIcon class="java-runtime-path-arrow" name="chevron-down" :size="14" />
              </summary>
              <div class="java-runtime-full-path">{{ runtime.executablePath }}</div>
            </details>
            <div class="java-runtime-actions">
              <UiButton
                variant="secondary"
                size="sm"
                :disabled="!canUse(runtime) || isActing"
                @click="useRuntime(runtime)"
                >{{ t(selectable ? 'javaManager.use' : 'javaManager.useGlobal') }}</UiButton
              >
              <UiButton
                v-if="runtime.validationStatus !== 'valid'"
                variant="secondary"
                size="sm"
                :disabled="isRegistering"
                @click="register"
                >{{ t('javaManager.relocate') }}</UiButton
              >
              <UiButton
                v-if="updates[runtime.runtimeId]"
                variant="secondary"
                size="sm"
                :disabled="isActing"
                @click="prepareInstall(updates[runtime.runtimeId]!)"
                >{{ t('javaManager.update') }}</UiButton
              >
              <NDropdown
                trigger="click"
                placement="bottom-end"
                :options="runtimeActions(runtime)"
                to="#app"
                @select="handleRuntimeAction($event, runtime)"
              >
                <UiButton
                  class="java-runtime-more"
                  variant="ghost"
                  size="sm"
                  :disabled="isActing"
                  :aria-label="t('javaManager.moreActions', { version: runtime.fullVersion })"
                  >{{ t('common.more') }}<UiIcon name="chevron-down" :size="14"
                /></UiButton>
              </NDropdown>
            </div>
          </article>
        </div>
      </template>

      <template v-else>
        <div class="java-catalog-controls">
          <NSelect
            v-model:value="selectedMajor"
            size="small"
            :options="majorOptions"
            :placeholder="t('javaManager.version')"
            :aria-label="t('javaManager.version')"
          />
          <NSelect
            v-model:value="runtimeKind"
            size="small"
            :options="[
              { label: 'JRE', value: 'JRE' },
              { label: 'JDK', value: 'JDK' },
            ]"
            :aria-label="t('javaManager.packageType')"
          />
          <UiButton variant="ghost" icon="refresh" :loading="isLoadingCatalog" @click="loadCatalog(true)">{{
            t('common.refresh')
          }}</UiButton>
        </div>
        <small>{{ t('javaManager.catalogHint') }}</small>
        <span v-if="catalog">{{ catalog.platform }} · {{ catalog.architecture }} · Eclipse Temurin</span>
        <UiLoading v-if="isLoadingCatalog" :label="t('javaManager.loadingCatalog')" />
        <UiEmptyState
          v-else-if="catalog && !catalog.packages.length"
          class="java-manager-empty"
          icon="download"
          :title="t('javaManager.noPackage')"
        />
        <article v-for="candidate in catalog?.packages || []" :key="candidate.packageId" class="java-package-row">
          <div class="java-runtime-copy">
            <strong>{{ candidate.releaseName }} · {{ candidate.runtimeKind }}</strong
            ><span>{{ candidate.architecture }} · {{ size(candidate.downloadBytes) }}</span>
          </div>
          <UiButton variant="primary" icon="download" :disabled="isActing" @click="prepareInstall(candidate)">{{
            t('javaManager.install')
          }}</UiButton>
        </article>
      </template>

      <div v-for="operation in javaOperations" :key="operation.operationId" class="java-operation-row" role="status">
        <strong>{{
          t(
            operation.kind === 'java_remove'
              ? 'javaManager.removeTask'
              : operation.kind === 'java_cleanup'
                ? 'javaManager.retryCleanup'
                : 'javaManager.installTask'
          )
        }}</strong>
        <NProgress
          type="line"
          :percentage="Math.round(operation.percent || 0)"
          :status="operation.status === 'failed' ? 'error' : operation.status === 'completed' ? 'success' : 'default'"
        />
        <span>{{ operation.message }}</span>
        <span v-if="operations.queryErrors[operation.operationId]">{{
          operations.queryErrors[operation.operationId]
        }}</span>
        <UiButton
          v-if="operations.queryErrors[operation.operationId]"
          variant="secondary"
          size="sm"
          @click="operations.refresh(operation.operationId)"
          >{{ t('common.refresh') }}</UiButton
        >
        <UiButton
          v-if="['pending', 'running'].includes(operation.status) && operation.canCancel !== false"
          variant="ghost"
          size="sm"
          :loading="operations.cancellingOperations.includes(operation.operationId)"
          @click="operations.cancel(operation.operationId)"
          >{{ t('common.cancel') }}</UiButton
        >
      </div>
    </div>

    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :content="confirmContent"
      :danger="!!removal"
      :loading="isActing"
      :closeOnConfirm="false"
      @confirm="confirmAction"
    />
  </section>
</template>

<script setup lang="ts">
import { NAlert, NDropdown, NInput, NProgress, NSelect, NTag, type DropdownOption } from 'naive-ui'
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import UiButton from '@/components/ui/Button.vue'
import UiEmptyState from '@/components/ui/EmptyState.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiLoading from '@/components/ui/Loading.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { javaApi } from '@/features/java/api/javaApi'
import { useJavaRuntimeStore } from '@/features/java/stores/javaRuntimeStore'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { JavaCatalog, JavaInstallPlan, JavaPackage, JavaRuntime } from '@/types/java'
import { getErrorMessage } from '@/utils/error'

const props = withDefaults(
  defineProps<{
    selectable?: boolean
    requiredMajor?: number | null
    initialView?: 'installed' | 'download'
    gamePath?: string
    versionId?: string
    scopeKey?: string
  }>(),
  { selectable: false, requiredMajor: null, initialView: 'installed', scopeKey: '', gamePath: '', versionId: '' }
)
const emit = defineEmits<{ selected: [runtime: JavaRuntime] }>()
const { t } = useI18n()
const store = useJavaRuntimeStore()
const settingsStore = useSettingsStore()
const operations = useApplicationOperationStore()
const message = useLauncherMessage()
const view = ref(props.initialView)
const query = ref('')
const error = ref('')
const isActing = ref(false)
const isRegistering = ref(false)
const isCheckingUpdates = ref(false)
const isLoadingCatalog = ref(false)
const catalog = ref<JavaCatalog | null>(null)
const selectedMajor = ref<number | null>(props.requiredMajor)
const runtimeKind = ref<'JRE' | 'JDK'>('JRE')
const updates = ref<Record<string, JavaPackage>>({})
const installPlan = ref<JavaInstallPlan | null>(null)
const removal = ref<JavaRuntime | null>(null)
const confirmVisible = ref(false)
let generation = 0
let catalogGeneration = 0
let planGeneration = 0
let isMounted = true

const filteredRuntimes = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return store.runtimes.filter(
    (runtime) =>
      !needle ||
      [runtime.vendor, runtime.fullVersion, runtime.runtimeKind, runtime.executablePath].some((value) =>
        value.toLowerCase().includes(needle)
      )
  )
})
const majorOptions = computed(() =>
  (catalog.value?.availableMajorVersions || []).map((major) => ({
    value: major,
    label: `Java ${major}${major === props.requiredMajor ? ` · ${t('javaManager.required')}` : major === catalog.value?.recommendedMajorVersion ? ` · LTS` : ''}`,
  }))
)
const javaOperations = computed(() =>
  Object.values(operations.operations)
    .filter((operation) => ['java_install', 'java_remove', 'java_cleanup'].includes(operation.kind || ''))
    .filter(
      (operation, _index, all) =>
        ['pending', 'running'].includes(operation.status) ||
        all
          .filter((item) => !['pending', 'running'].includes(item.status))
          .slice(-5)
          .includes(operation)
    )
)
const confirmTitle = computed(() =>
  t(removal.value ? 'javaManager.removeConfirmTitle' : 'javaManager.installConfirmTitle')
)
const confirmContent = computed(() =>
  removal.value
    ? t(removal.value.origin === 'managed' ? 'javaManager.removeConfirm' : 'javaManager.forgetConfirm', {
        version: removal.value.fullVersion,
      })
    : installPlan.value
      ? t('javaManager.installConfirm', {
          version: installPlan.value.package.releaseName,
          size: size(installPlan.value.package.downloadBytes),
          location: installPlan.value.installPath,
          space: size(installPlan.value.estimatedFreeBytes),
        })
      : ''
)
const isCurrent = (revision: number) => isMounted && generation === revision
const size = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MiB`
const canUse = (runtime: JavaRuntime) =>
  runtime.isEnabled &&
  runtime.validationStatus === 'valid' &&
  (!props.requiredMajor || runtime.majorVersion >= props.requiredMajor)

async function load(force = false) {
  try {
    await store.load(force)
  } catch (cause) {
    if (isMounted) error.value = getErrorMessage(cause)
  }
}
async function loadCatalog(force = false) {
  const revision = ++catalogGeneration
  const scope = generation
  isLoadingCatalog.value = true
  error.value = ''
  if (catalog.value) catalog.value = { ...catalog.value, packages: [] }
  try {
    const result = await javaApi.catalog(selectedMajor.value, runtimeKind.value, force)
    if (isCurrent(scope) && revision === catalogGeneration) {
      catalog.value = result
      if (selectedMajor.value === null) selectedMajor.value = result.majorVersion
    }
  } catch (cause) {
    if (isCurrent(scope) && revision === catalogGeneration) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope) && revision === catalogGeneration) isLoadingCatalog.value = false
  }
}
async function register() {
  if (isRegistering.value) return
  const scope = generation
  isRegistering.value = true
  error.value = ''
  try {
    const path = await settingsApi.selectJava()
    if (!path || !isCurrent(scope)) return
    await javaApi.register(path)
    await store.refreshAfterChange()
    if (isCurrent(scope)) message.success(t('javaManager.registered'))
  } catch (cause) {
    if (isCurrent(scope)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope)) isRegistering.value = false
  }
}
async function useRuntime(runtime: JavaRuntime) {
  if (isActing.value) return
  const scope = generation
  isActing.value = true
  error.value = ''
  try {
    const verified = await javaApi.select(
      runtime,
      props.requiredMajor,
      props.gamePath && props.versionId ? { gamePath: props.gamePath, versionId: props.versionId } : undefined
    )
    if (!isCurrent(scope)) return
    if (props.selectable) emit('selected', verified)
    else {
      await settingsStore.patchGame({ java_auto: false, java_path: verified.executablePath })
      if (isCurrent(scope)) message.success(t('javaManager.applied'))
    }
  } catch (cause) {
    if (isCurrent(scope)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope)) isActing.value = false
  }
}
async function toggleRuntime(runtime: JavaRuntime) {
  if (isActing.value) return
  const scope = generation
  isActing.value = true
  try {
    await javaApi.setEnabled(runtime.runtimeId, !runtime.isEnabled)
    await store.refreshAfterChange()
  } catch (cause) {
    if (isCurrent(scope)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope)) isActing.value = false
  }
}
async function openFolder(runtime: JavaRuntime) {
  try {
    unwrapResponse(await backend.command('open_folder', { path: runtime.javaHomePath }), t('javaManager.openFolder'))
  } catch (cause) {
    error.value = getErrorMessage(cause)
  }
}

function runtimeActions(runtime: JavaRuntime): DropdownOption[] {
  const options: DropdownOption[] = [
    {
      key: 'toggle',
      label: t(runtime.isEnabled ? 'javaManager.disable' : 'javaManager.enable'),
      disabled: isActing.value,
    },
    { key: 'open', label: t('javaManager.openFolder'), disabled: isActing.value },
  ]
  if (runtime.origin !== 'system') {
    options.push(
      { key: 'remove-divider', type: 'divider' },
      {
        key: 'remove',
        label: () =>
          h(
            'span',
            { style: { color: 'var(--error)' } },
            t(runtime.origin === 'managed' ? 'javaManager.remove' : 'javaManager.forget')
          ),
        disabled: isActing.value || runtime.isInUse || !!runtime.references?.length,
      }
    )
  }
  return options
}

function handleRuntimeAction(action: string, runtime: JavaRuntime) {
  if (isActing.value) return
  if (action === 'toggle') void toggleRuntime(runtime)
  else if (action === 'open') void openFolder(runtime)
  else if (action === 'remove' && runtime.origin !== 'system' && !runtime.isInUse && !runtime.references?.length) {
    confirmRemoval(runtime)
  }
}

async function prepareInstall(candidate: JavaPackage) {
  const revision = ++planGeneration
  const scope = generation
  const catalogRevision = catalogGeneration
  isActing.value = true
  try {
    const plan = await javaApi.plan(candidate.packageId)
    if (
      isCurrent(scope) &&
      revision === planGeneration &&
      (view.value !== 'download' || catalogRevision === catalogGeneration)
    ) {
      installPlan.value = plan
      removal.value = null
      confirmVisible.value = true
    }
  } catch (cause) {
    if (isCurrent(scope)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope) && revision === planGeneration) isActing.value = false
  }
}
function confirmRemoval(runtime: JavaRuntime) {
  removal.value = runtime
  installPlan.value = null
  confirmVisible.value = true
}
async function confirmAction() {
  if (isActing.value) return
  const scope = generation
  const plan = installPlan.value
  const runtime = removal.value
  isActing.value = true
  try {
    if (runtime) {
      if (runtime.origin === 'managed') await javaApi.remove(runtime.runtimeId)
      else await javaApi.forget(runtime.runtimeId)
      await store.refreshAfterChange()
    } else if (plan) await javaApi.install(plan.planId)
    if (isCurrent(scope)) {
      confirmVisible.value = false
      message.success(t(runtime?.origin === 'manual' ? 'javaManager.forgotten' : 'javaManager.taskSubmitted'))
    }
  } catch (cause) {
    if (isCurrent(scope)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope)) isActing.value = false
  }
}
async function checkUpdates() {
  if (isCheckingUpdates.value) return
  const scope = generation
  isCheckingUpdates.value = true
  try {
    const result = await javaApi.updates()
    if (isCurrent(scope)) {
      updates.value = Object.fromEntries(result.map((update) => [update.runtimeId, update.package]))
      if (!result.length) message.success(t('javaManager.noUpdates'))
    }
  } catch (cause) {
    if (isCurrent(scope)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(scope)) isCheckingUpdates.value = false
  }
}
async function retryCleanup() {
  if (isActing.value) return
  isActing.value = true
  try {
    await javaApi.cleanup()
  } catch (cause) {
    error.value = getErrorMessage(cause)
  } finally {
    if (isMounted) isActing.value = false
  }
}
watch([view, runtimeKind, selectedMajor], () => {
  if (view.value === 'download') void loadCatalog()
})
watch(
  () => props.scopeKey,
  () => {
    generation++
    confirmVisible.value = false
    isActing.value = false
    isRegistering.value = false
    selectedMajor.value = props.requiredMajor
  }
)
onMounted(() => {
  void load()
  if (view.value === 'download') void loadCatalog()
})
onBeforeUnmount(() => {
  isMounted = false
  generation++
  catalogGeneration++
  planGeneration++
})
</script>

<style scoped src="@/styles/features/java/JavaManagerPanel.css"></style>
