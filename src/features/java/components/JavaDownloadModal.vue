<template>
  <FullscreenModal
    :visible="visible"
    :title="t('javaManager.downloadJava')"
    :showFooter="false"
    :closable="!isInstalling"
    @close="emit('close')"
  >
    <div class="java-download-page">
      <UiCard class="java-download-card" bodyClass="java-download-card-body">
        <div class="java-catalog-controls">
          <NSelect
            :value="selectedMajor ?? catalog?.majorVersion"
            size="small"
            :options="majorOptions"
            :placeholder="t('javaManager.version')"
            :aria-label="t('javaManager.version')"
            :disabled="isInstalling"
            @update:value="selectedMajor = $event"
          />
          <NSelect
            v-model:value="runtimeKind"
            size="small"
            :options="[
              { label: 'JRE', value: 'JRE' },
              { label: 'JDK', value: 'JDK' },
            ]"
            :aria-label="t('javaManager.packageType')"
            :disabled="isInstalling"
          />
          <UiButton
            size="sm"
            variant="ghost"
            shape="square"
            icon="refresh"
            :title="t('common.refresh')"
            :aria-label="t('common.refresh')"
            :loading="isLoadingCatalog"
            :disabled="isInstalling"
            @click="loadCatalog(true)"
          />
        </div>
        <div class="java-download-content">
          <NAlert v-if="error" type="error" role="alert">{{ error }}</NAlert>
          <NAlert v-if="requiredMajor" type="info">{{ t('javaManager.requirement', { major: requiredMajor }) }}</NAlert>
          <div class="java-catalog-hint">
            <span>{{ t('javaManager.catalogHint') }}</span>
            <span v-if="catalog">{{ catalog.platform }} · {{ catalog.architecture }} · Eclipse Temurin</span>
          </div>
          <UiLoading v-if="isLoadingCatalog" :label="t('javaManager.loadingCatalog')" />
          <UiEmptyState v-else-if="error && !catalog" icon="download" :title="error">
            <UiButton variant="secondary" icon="refresh" @click="loadCatalog(true)">{{ t('common.refresh') }}</UiButton>
          </UiEmptyState>
          <UiEmptyState
            v-else-if="catalog && !catalog.packages.length"
            icon="download"
            :title="t('javaManager.noPackage')"
          />
          <div v-else class="java-package-list">
            <article v-for="candidate in catalog?.packages || []" :key="candidate.packageId" class="java-package-row">
              <JavaRuntimeIcon class="java-runtime-icon" />
              <div class="java-runtime-copy">
                <strong :title="candidate.releaseName"
                  >{{ candidate.releaseName }} · {{ candidate.runtimeKind }}</strong
                >
                <span>{{ candidate.architecture }} · {{ size(candidate.downloadBytes) }}</span>
              </div>
              <UiButton
                size="sm"
                variant="primary"
                icon="download"
                :loading="planningPackageId === candidate.packageId"
                :disabled="!!planningPackageId || isInstalling"
                @click="prepareInstall(candidate)"
                >{{ t('javaManager.install') }}</UiButton
              >
            </article>
          </div>
        </div>
      </UiCard>
    </div>
    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="t('javaManager.installConfirmTitle')"
      :content="confirmContent"
      :loading="isInstalling"
      :closeOnConfirm="false"
      @confirm="install"
    />
  </FullscreenModal>
</template>

<script setup lang="ts">
import { NAlert, NSelect } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import { UiButton, UiCard, UiEmptyState, UiLoading } from '@/components/ui'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { javaApi } from '@/features/java/api/javaApi'
import JavaRuntimeIcon from '@/features/java/components/JavaRuntimeIcon.vue'
import type { JavaCatalog, JavaInstallPlan, JavaPackage } from '@/types/java'
import { getErrorMessage } from '@/utils/error'

const props = withDefaults(defineProps<{ visible: boolean; requiredMajor?: number | null }>(), { requiredMajor: null })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const message = useLauncherMessage()
const selectedMajor = ref<number | null>(props.requiredMajor)
const runtimeKind = ref<'JRE' | 'JDK'>('JRE')
const catalog = ref<JavaCatalog | null>(null)
const error = ref('')
const isLoadingCatalog = ref(false)
const planningPackageId = ref<string | null>(null)
const installPlan = ref<JavaInstallPlan | null>(null)
const confirmVisible = ref(false)
const isInstalling = ref(false)
let revision = 0
let isMounted = true
const isCurrent = (current: number) => isMounted && props.visible && current === revision

const size = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MiB`
const majorOptions = computed(() =>
  (catalog.value?.availableMajorVersions || []).map((major) => ({
    value: major,
    label: `Java ${major}${major === props.requiredMajor ? ` · ${t('javaManager.required')}` : major === catalog.value?.recommendedMajorVersion ? ' · LTS' : ''}`,
  }))
)
const confirmContent = computed(() =>
  installPlan.value
    ? t('javaManager.installConfirm', {
        version: installPlan.value.package.releaseName,
        size: size(installPlan.value.package.downloadBytes),
        location: installPlan.value.installPath,
        space: size(installPlan.value.estimatedFreeBytes),
      })
    : ''
)

async function loadCatalog(force = false): Promise<void> {
  if (!props.visible || isInstalling.value) return
  const current = ++revision
  confirmVisible.value = false
  installPlan.value = null
  planningPackageId.value = null
  isLoadingCatalog.value = true
  error.value = ''
  if (catalog.value) catalog.value = { ...catalog.value, packages: [] }
  try {
    const result = await javaApi.catalog(selectedMajor.value, runtimeKind.value, force)
    if (isCurrent(current)) catalog.value = result
  } catch (cause) {
    if (isCurrent(current)) {
      catalog.value = null
      error.value = getErrorMessage(cause)
    }
  } finally {
    if (isCurrent(current)) isLoadingCatalog.value = false
  }
}

async function prepareInstall(candidate: JavaPackage): Promise<void> {
  if (!props.visible || planningPackageId.value || isInstalling.value || isLoadingCatalog.value) return
  const current = revision
  planningPackageId.value = candidate.packageId
  error.value = ''
  try {
    const plan = await javaApi.plan(candidate.packageId)
    if (isCurrent(current)) {
      installPlan.value = plan
      confirmVisible.value = true
    }
  } catch (cause) {
    if (isCurrent(current)) error.value = getErrorMessage(cause)
  } finally {
    if (isCurrent(current)) planningPackageId.value = null
  }
}

async function install(): Promise<void> {
  if (!props.visible || isInstalling.value || !confirmVisible.value || !installPlan.value) return
  const current = revision
  isInstalling.value = true
  error.value = ''
  try {
    await javaApi.install(installPlan.value.planId)
    if (isCurrent(current)) {
      confirmVisible.value = false
      message.success(t('javaManager.taskSubmitted'))
    }
  } catch (cause) {
    if (isCurrent(current)) {
      error.value = getErrorMessage(cause)
      message.error(error.value)
    }
  } finally {
    if (isCurrent(current)) isInstalling.value = false
  }
}

watch([selectedMajor, runtimeKind], () => void loadCatalog(), { flush: 'sync' })
watch(
  () => props.requiredMajor,
  (major) => {
    selectedMajor.value = major
  },
  { flush: 'sync' }
)
watch(
  () => props.visible,
  (visible) => {
    revision++
    confirmVisible.value = false
    installPlan.value = null
    planningPackageId.value = null
    isLoadingCatalog.value = false
    isInstalling.value = false
    if (visible) void loadCatalog()
  },
  { immediate: true, flush: 'sync' }
)
onBeforeUnmount(() => {
  isMounted = false
  revision++
})
</script>

<style scoped src="@/styles/features/java/JavaDownloadModal.css"></style>
