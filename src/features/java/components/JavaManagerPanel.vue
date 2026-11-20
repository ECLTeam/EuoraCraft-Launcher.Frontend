<template>
  <section class="java-manager">
    <header class="java-manager-toolbar">
    <NInput
      v-model:value="query"
      class="java-manager-search"
      clearable
      size="small"
      :placeholder="t('javaManager.search')"
      :inputProps="{ 'aria-label': t('javaManager.search') }"
    >
      <template #prefix><UiIcon name="search" :size="14" /></template>
    </NInput>

    <div class="java-manager-toolbar-actions">
      <NButton
        class="java-manager-icon-button"
        quaternary
        circle
        size="small"
        :loading="store.isLoading"
        :title="t('javaManager.rescan')"
        :aria-label="t('javaManager.rescan')"
        @click="load(true)"
      >
        <template #icon><UiIcon name="refresh" :size="16" /></template>
      </NButton>
      <NButton
        class="java-manager-icon-button"
        quaternary
        circle
        size="small"
        :loading="isCheckingUpdates"
        :title="t('javaManager.checkUpdates')"
        :aria-label="t('javaManager.checkUpdates')"
        @click="checkUpdates"
      >
        <template #icon><UiIcon name="download" :size="16" /></template>
      </NButton>
      <NDropdown
        trigger="click"
        placement="bottom-end"
        :options="addJavaOptions"
        :show="addMenuVisible"
        to="#app"
        @update:show="addMenuVisible = $event"
        @select="handleAddJava"
      >
        <NButton
          class="java-add-button"
          type="primary"
          size="small"
          :loading="isRegistering"
          :disabled="isActing"
          aria-haspopup="menu"
          :aria-expanded="addMenuVisible"
          @keydown.esc="closeAddMenuOnEscape"
        >
          <template #icon><UiIcon name="add" :size="14" /></template>
          {{ t('javaManager.addJava') }}
        </NButton>
      </NDropdown>
    </div>
  </header>

    <div class="java-list-body">
      <div class="java-list-content">
        <NAlert v-if="error || store.error" type="error" closable @close="error = ''">{{ error || store.error }}</NAlert>
        <NAlert v-if="requiredMajor" type="info">{{ t('javaManager.requirement', { major: requiredMajor }) }}</NAlert>
        <NAlert v-if="store.inventory?.cleanupPendingCount" type="warning"
          >{{ t('javaManager.cleanupPending', { count: store.inventory.cleanupPendingCount }) }}
          <NButton text size="small" :disabled="isActing" @click="retryCleanup">{{
            t('javaManager.retryCleanup')
          }}</NButton></NAlert
        >

        <UiLoading v-if="store.isLoading && !store.runtimes.length" mode="block" class="java-spin" />
        <NEmpty
          v-else-if="!filteredRuntimes.length"
          class="java-manager-empty"
          :description="t(query.trim() ? 'javaManager.noMatch' : 'javaManager.empty')"
        >
          <template #extra>
            <NButton v-if="query.trim()" size="small" @click="query = ''">{{ t('javaManager.clearSearch') }}</NButton>
            <NButton v-else type="primary" size="small" @click="downloadVisible = true">{{
              t('javaManager.downloadJava')
            }}</NButton>
          </template>
        </NEmpty>

      <div v-else class="java-runtime-list">
        <div class="java-manager-table-header">
          <span>{{ t('javaManager.columnName') }}</span>
          <span>{{ t('javaManager.columnVersion') }}</span>
          <span>{{ t('javaManager.columnStatus') }}</span>
          <span></span>
        </div>
        <article v-for="runtime in filteredRuntimes" :key="runtime.runtimeId" class="java-runtime-row">
          <div class="java-runtime-identity">
            <div class="java-runtime-icon"><UiIcon name="coffee" :size="40" /></div>
            <div class="java-runtime-content">
              <span class="java-runtime-name">Java {{ runtime.majorVersion || '?' }} · {{ runtime.runtimeKind }}</span>
              <div
                class="java-runtime-description"
                :title="`${runtime.vendor || t('javaManager.unknownVendor')} · ${runtime.architecture} · ${t(`javaManager.origins.${runtime.origin}`)}`"
              >
                {{
                  `${runtime.vendor || t('javaManager.unknownVendor')} · ${runtime.architecture} · ${t(`javaManager.origins.${runtime.origin}`)}`
                }}
              </div>
            </div>
          </div>
          <div class="java-runtime-version">
            <NTag size="small" :bordered="false" :title="runtime.fullVersion">{{ runtime.fullVersion }}</NTag>
          </div>
          <div class="java-runtime-status">
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
          <NSpace class="java-runtime-actions" justify="end" :size="3" :wrap="false" :wrapItem="false">
            <NButton
              v-if="runtime.validationStatus !== 'valid'"
              class="java-runtime-relocate"
              quaternary
              size="tiny"
              :disabled="isRegistering"
              :title="t('javaManager.relocate')"
              :aria-label="t('javaManager.relocate')"
              @click="register"
            >
              <template #icon><UiIcon name="refresh" :size="16" /></template>
            </NButton>
            <NButton
              v-if="updates[runtime.runtimeId]"
              class="java-runtime-update"
              quaternary
              size="tiny"
              :disabled="isActing"
              :title="t('javaManager.update')"
              :aria-label="t('javaManager.update')"
              @click="prepareInstall(updates[runtime.runtimeId]!)"
            >
              <template #icon><UiIcon name="download" :size="16" /></template>
            </NButton>
            <NButton
              class="java-runtime-use"
              quaternary
              size="tiny"
              :disabled="!canUse(runtime) || isActing"
              :title="t(selectable ? 'javaManager.use' : 'javaManager.useGlobal')"
              :aria-label="t(selectable ? 'javaManager.use' : 'javaManager.useGlobal')"
              @click="useRuntime(runtime)"
            >
              <template #icon><UiIcon name="check" :size="16" /></template>
            </NButton>
            <NButton
              class="java-runtime-open"
              quaternary
              size="tiny"
              :disabled="isActing"
              :title="`${t('javaManager.openFolder')} · ${runtime.javaHomePath}`"
              :aria-label="t('javaManager.openFolder')"
              @click="openFolder(runtime)"
            >
              <template #icon><UiIcon name="folder" :size="16" /></template>
            </NButton>
            <NButton
              class="java-runtime-toggle"
              quaternary
              size="tiny"
              :disabled="isActing"
              :title="t(runtime.isEnabled ? 'javaManager.disable' : 'javaManager.enable')"
              :aria-label="t(runtime.isEnabled ? 'javaManager.disable' : 'javaManager.enable')"
              @click="toggleRuntime(runtime)"
            >
              <template #icon><UiIcon :name="runtime.isEnabled ? 'stop' : 'play'" :size="16" /></template>
            </NButton>
            <NButton
              v-if="runtime.origin !== 'system'"
              class="java-runtime-remove"
              quaternary
              size="tiny"
              type="error"
              :disabled="isActing || runtime.isInUse || !!runtime.references?.length"
              :title="t(runtime.origin === 'managed' ? 'javaManager.remove' : 'javaManager.forget')"
              :aria-label="t(runtime.origin === 'managed' ? 'javaManager.remove' : 'javaManager.forget')"
              @click="confirmRemoval(runtime)"
            >
              <template #icon><UiIcon name="trash" :size="16" /></template>
            </NButton>
          </NSpace>
        </article>
        </div>
      </div>
    </div>

    <JavaDownloadModal :visible="downloadVisible" :requiredMajor="requiredMajor" @close="downloadVisible = false" />

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
import { NAlert, NButton, NDropdown, NEmpty, NInput, NSpace, NTag, type DropdownOption } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import { UiIcon, UiLoading } from '@/components/ui'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { javaApi } from '@/features/java/api/javaApi'
import JavaDownloadModal from '@/features/java/components/JavaDownloadModal.vue'
import { useJavaRuntimeStore } from '@/features/java/stores/javaRuntimeStore'
import { settingsApi } from '@/features/settings/api/settingsApi'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { JavaInstallPlan, JavaPackage, JavaRuntime } from '@/types/java'
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
const message = useLauncherMessage()
const downloadVisible = ref(props.initialView === 'download')
const query = ref('')
const addMenuVisible = ref(false)
const error = ref('')
const isActing = ref(false)
const isRegistering = ref(false)
const isCheckingUpdates = ref(false)
const updates = ref<Record<string, JavaPackage>>({})
const installPlan = ref<JavaInstallPlan | null>(null)
const removal = ref<JavaRuntime | null>(null)
const confirmVisible = ref(false)
let generation = 0
let planGeneration = 0
let isMounted = true

const addJavaOptions = computed<DropdownOption[]>(() => [
  { key: 'download', label: t('javaManager.downloadJava'), disabled: isRegistering.value || isActing.value },
  { key: 'register', label: t('javaManager.add'), disabled: isRegistering.value || isActing.value },
])
function handleAddJava(action: string): void {
  if (isRegistering.value || isActing.value) return
  addMenuVisible.value = false
  if (action === 'download') downloadVisible.value = true
  else if (action === 'register') void register()
}

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

function closeAddMenuOnEscape(event: KeyboardEvent) {
  if (!addMenuVisible.value) return
  event.stopPropagation()
  addMenuVisible.value = false
}

async function prepareInstall(candidate: JavaPackage) {
  if (isActing.value) return
  const revision = ++planGeneration
  const scope = generation
  isActing.value = true
  try {
    const plan = await javaApi.plan(candidate.packageId)
    if (isCurrent(scope) && revision === planGeneration) {
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
watch([downloadVisible, query], () => {
  addMenuVisible.value = false
})
watch(
  () => JSON.stringify([props.scopeKey, props.gamePath, props.versionId, props.requiredMajor]),
  () => {
    generation++
    addMenuVisible.value = false
    confirmVisible.value = false
    isActing.value = false
    isRegistering.value = false
    downloadVisible.value = false
  },
  { flush: 'sync' }
)
onMounted(() => {
  void load()
})
onBeforeUnmount(() => {
  isMounted = false
  generation++
  planGeneration++
})
</script>

<style scoped src="@/styles/features/java/JavaManagerPanel.css"></style>
