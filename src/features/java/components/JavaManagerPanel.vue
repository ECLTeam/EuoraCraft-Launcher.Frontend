<template>
  <section class="java-manager">
    <header class="java-manager-toolbar">
      <div class="java-manager-tabs">
        <NButton :type="view === 'installed' ? 'primary' : 'default'" secondary @click="view = 'installed'">{{
          t('javaManager.installed')
        }}</NButton>
        <NButton :type="view === 'download' ? 'primary' : 'default'" secondary @click="view = 'download'">{{
          t('javaManager.download')
        }}</NButton>
      </div>
      <div v-if="view === 'installed'" class="java-manager-actions">
        <NButton size="small" :loading="store.isLoading" @click="load(true)">{{ t('javaManager.rescan') }}</NButton>
        <NButton size="small" :loading="isCheckingUpdates" @click="checkUpdates">{{
          t('javaManager.checkUpdates')
        }}</NButton>
        <NButton size="small" :loading="isRegistering" @click="register">{{ t('javaManager.add') }}</NButton>
      </div>
    </header>

    <div class="java-manager-content">
      <NAlert v-if="error || store.error" type="error" closable @close="error = ''">{{ error || store.error }}</NAlert>
      <NAlert v-if="requiredMajor" type="info">{{ t('javaManager.requirement', { major: requiredMajor }) }}</NAlert>
      <NAlert v-if="store.inventory?.cleanupPendingCount" type="warning"
        >{{ t('javaManager.cleanupPending', { count: store.inventory.cleanupPendingCount }) }}
        <NButton size="small" :disabled="isActing" @click="retryCleanup">{{
          t('javaManager.retryCleanup')
        }}</NButton></NAlert
      >

      <template v-if="view === 'installed'">
        <NInput v-model:value="query" clearable :placeholder="t('javaManager.search')" />
        <UiLoading v-if="store.isLoading && !store.runtimes.length" :label="t('javaManager.scanning')" />
        <NEmpty v-else-if="!filteredRuntimes.length" :description="t('javaManager.empty')" />
        <article v-for="runtime in filteredRuntimes" :key="runtime.runtimeId" class="java-runtime-row">
          <div class="java-runtime-copy">
            <strong
              >Java {{ runtime.majorVersion || '?' }} · {{ runtime.vendor || t('javaManager.unknownVendor') }} ·
              {{ runtime.runtimeKind }}</strong
            >
            <span
              >{{ runtime.fullVersion }} · {{ runtime.architecture }} ·
              {{ t(`javaManager.origins.${runtime.origin}`) }}</span
            >
            <small class="java-runtime-path" :title="runtime.executablePath">{{ runtime.executablePath }}</small>
            <div class="java-runtime-tags">
              <NTag v-if="runtime.validationStatus !== 'valid'" size="small" type="error">{{
                t(`javaManager.validation.${runtime.validationStatus}`)
              }}</NTag>
              <NTag v-if="!runtime.isEnabled" size="small" type="warning">{{ t('javaManager.disabled') }}</NTag>
              <NTag v-if="runtime.isInUse" size="small" type="info">{{
                t(runtime.usageUnknown ? 'javaManager.usageUnknown' : 'javaManager.inUse')
              }}</NTag>
              <span v-if="runtime.references?.length" class="java-runtime-references">{{
                t('javaManager.referenced', { count: runtime.references.length })
              }}</span>
            </div>
          </div>
          <div class="java-runtime-actions">
            <NButton size="small" :disabled="!canUse(runtime) || isActing" @click="useRuntime(runtime)">{{
              t(selectable ? 'javaManager.use' : 'javaManager.useGlobal')
            }}</NButton>
            <NButton size="small" :disabled="isActing" @click="toggleRuntime(runtime)">{{
              t(runtime.isEnabled ? 'javaManager.disable' : 'javaManager.enable')
            }}</NButton>
            <NButton
              v-if="runtime.validationStatus !== 'valid'"
              size="small"
              :disabled="isRegistering"
              @click="register"
              >{{ t('javaManager.relocate') }}</NButton
            >
            <NButton
              v-if="updates[runtime.runtimeId]"
              size="small"
              :disabled="isActing"
              @click="prepareInstall(updates[runtime.runtimeId]!)"
              >{{ t('javaManager.update') }}</NButton
            >
            <NButton
              size="small"
              quaternary
              :aria-label="t('javaManager.openFolder')"
              :title="t('javaManager.openFolder')"
              @click="openFolder(runtime)"
              ><template #icon><UiIcon name="folder" :size="16" /></template
            ></NButton>
            <NButton
              v-if="runtime.origin !== 'system'"
              size="small"
              type="error"
              secondary
              :disabled="isActing || runtime.isInUse || !!runtime.references?.length"
              @click="confirmRemoval(runtime)"
              >{{ t(runtime.origin === 'managed' ? 'javaManager.remove' : 'javaManager.forget') }}</NButton
            >
          </div>
        </article>
      </template>

      <template v-else>
        <div class="java-catalog-controls">
          <NSelect
            v-model:value="selectedMajor"
            :options="majorOptions"
            :placeholder="t('javaManager.version')"
            :aria-label="t('javaManager.version')"
          />
          <NSelect
            v-model:value="runtimeKind"
            :options="[
              { label: 'JRE', value: 'JRE' },
              { label: 'JDK', value: 'JDK' },
            ]"
            :aria-label="t('javaManager.packageType')"
          />
          <NButton :loading="isLoadingCatalog" @click="loadCatalog(true)">{{ t('common.refresh') }}</NButton>
        </div>
        <small>{{ t('javaManager.catalogHint') }}</small>
        <span v-if="catalog">{{ catalog.platform }} · {{ catalog.architecture }} · Eclipse Temurin</span>
        <UiLoading v-if="isLoadingCatalog" :label="t('javaManager.loadingCatalog')" />
        <NEmpty v-else-if="catalog && !catalog.packages.length" :description="t('javaManager.noPackage')" />
        <article v-for="candidate in catalog?.packages || []" :key="candidate.packageId" class="java-package-row">
          <div class="java-runtime-copy">
            <strong>{{ candidate.releaseName }} · {{ candidate.runtimeKind }}</strong
            ><span>{{ candidate.architecture }} · {{ size(candidate.downloadBytes) }}</span>
          </div>
          <NButton type="primary" :disabled="isActing" @click="prepareInstall(candidate)">{{
            t('javaManager.install')
          }}</NButton>
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
        <NButton
          v-if="operations.queryErrors[operation.operationId]"
          size="small"
          @click="operations.refresh(operation.operationId)"
          >{{ t('common.refresh') }}</NButton
        >
        <NButton
          v-if="['pending', 'running'].includes(operation.status) && operation.canCancel !== false"
          size="small"
          :loading="operations.cancellingOperations.includes(operation.operationId)"
          @click="operations.cancel(operation.operationId)"
          >{{ t('common.cancel') }}</NButton
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
import { NAlert, NButton, NEmpty, NInput, NProgress, NSelect, NTag } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
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

<style scoped>
.java-manager,
.java-manager-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-width: 0;
}
.java-manager-toolbar,
.java-manager-tabs,
.java-manager-actions,
.java-runtime-actions,
.java-catalog-controls,
.java-runtime-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.java-manager-toolbar {
  justify-content: space-between;
}
.java-runtime-row,
.java-package-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 16px;
  background: var(--ecl-surface-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.java-runtime-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: min(260px, 100%);
}
.java-runtime-copy span,
.java-runtime-copy small,
.java-manager-content > small {
  color: var(--text-secondary);
  font-size: 12px;
}
.java-runtime-path {
  overflow-wrap: anywhere;
}
.java-runtime-actions {
  justify-content: flex-end;
}
.java-catalog-controls .n-select {
  flex: 1;
  min-width: 120px;
  max-width: 260px;
}
.java-operation-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--ecl-surface-bg);
  border-radius: var(--radius-lg);
  font-size: 12px;
}
@media (max-width: 680px) {
  .java-runtime-actions {
    justify-content: flex-start;
    width: 100%;
  }
}
</style>
