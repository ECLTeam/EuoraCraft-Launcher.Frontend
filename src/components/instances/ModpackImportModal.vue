<template>
  <Modal
    :visible="store.visible"
    :title="t('modpackImport.title')"
    width="700px"
    :closable="!store.isSubmittingImport"
    wrapperClass="modpack-import-modal"
    bodyClass="modpack-import-modal-body"
    @update:visible="store.close()"
  >
    <div class="mp-wizard">
      <p class="mp-step" aria-live="polite">{{ t(`modpackWizard.steps.${store.step}`) }}</p>
      <p v-if="store.error" class="mp-error" role="alert">{{ store.error }}</p>
      <p v-if="store.cleanupError" class="mp-note" role="status">{{ store.cleanupError }}</p>
      <template v-if="store.step === 'source'">
        <label v-if="!store.isOnline" class="mp-field">
          <span>{{ t('modpackImport.fileLabel') }}</span>
          <div class="mp-file-row">
            <NInput :value="store.sourcePath" readonly :placeholder="t('modpackImport.filePlaceholder')" />
            <NButton @click="selectSourceFile">{{ t('modpackImport.selectFile') }}</NButton>
          </div>
        </label>
        <label v-else class="mp-field"
          ><span>{{ t('modpackImport.onlinePack') }}</span
          ><NInput :value="store.onlineTitle" readonly
        /></label>
        <p class="mp-note">{{ t('modpackWizard.readHint') }}</p>
      </template>
      <section v-if="store.step === 'preparing'" class="mp-preparing" role="status">
        <UiLoading mode="inline" size="md" decorative />
        <span>{{ store.preparationOperation?.message || t('modpackWizard.preparing') }}</span>
        <UiProgress :percentage="store.preparationOperation?.percent || 0" :processing="true" />
        <NButton
          v-if="operationStore.queryErrors[store.preparationOperationId]"
          @click="operationStore.refresh(store.preparationOperationId)"
          >{{ t('operations.refresh') }}</NButton
        >
      </section>
      <section v-if="store.preview && ['preview', 'confirm'].includes(store.step)" class="mp-summary">
        <h4>{{ store.preview.name }}</h4>
        <p v-if="store.preview.summary" class="mp-description">{{ store.preview.summary }}</p>
        <dl class="mp-metadata">
          <dt>{{ t('modpackWizard.format') }}</dt>
          <dd>{{ store.preview.format }}</dd>
          <template v-if="store.preview.minecraftVersion"
            ><dt>Minecraft</dt>
            <dd>{{ store.preview.minecraftVersion }}</dd></template
          >
          <dt>{{ t('modpackWizard.loader') }}</dt>
          <dd>{{ store.preview.loader }} {{ store.preview.loaderVersion || '' }}</dd>
        </dl>
        <p class="mp-note">
          {{
            t('modpackWizard.fileCounts', {
              required: store.requiredFiles.length,
              optional: store.optionalFiles.length,
              unsupported: store.unsupportedFiles.length,
            })
          }}
        </p>
        <p v-if="store.preview.format === 'hmcl'" class="mp-note">{{ t('modpackWizard.hmclLimit') }}</p>
        <p v-if="store.preview.format === 'multimc'" class="mp-note">{{ t('modpackWizard.multimcLimit') }}</p>
        <p v-if="store.preview.format === 'ecl-legacy'" class="mp-note">{{ t('modpackWizard.legacyLimit') }}</p>
        <details v-if="store.preview.warnings.length">
          <summary>{{ t('modpackWizard.warnings', { count: store.preview.warnings.length }) }}</summary>
          <ul>
            <li v-for="(warning, index) in store.preview.warnings" :key="index">{{ warning.message }}</li>
          </ul>
        </details>
      </section>
      <section v-if="store.step === 'preview'" class="mp-options">
        <h4>{{ t('modpackWizard.optionalFiles') }}</h4>
        <p class="mp-note">{{ t('modpackWizard.optionalHint') }}</p>
        <NInput
          v-model:value="store.search"
          clearable
          :placeholder="t('modpackWizard.searchFiles')"
          :aria-label="t('modpackWizard.searchFiles')"
        />
        <div class="mp-actions">
          <NButton size="small" @click="store.selectAll(true)">{{ t('modpackWizard.selectAll') }}</NButton>
          <NButton size="small" @click="store.selectAll(false)">{{ t('modpackWizard.selectNone') }}</NButton>
          <span class="mp-note">{{
            t('modpackWizard.optionalSelected', {
              selected: store.optionalFiles.length - store.excludedFileIds.length,
              total: store.optionalFiles.length,
            })
          }}</span>
        </div>
        <div class="mp-files">
          <label v-for="file in store.visibleOptionalFiles" :key="file.fileId" class="mp-file">
            <NCheckbox
              :checked="!store.excludedFileIds.includes(file.fileId)"
              @update:checked="store.selectFile(file.fileId, $event)"
              ><span :title="file.path">{{ file.path }}</span></NCheckbox
            >
            <span class="mp-file-size">{{
              file.size === null ? t('modpackWizard.unknownSize') : formatBytes(file.size)
            }}</span>
          </label>
          <p v-if="!store.visibleOptionalFiles.length" class="mp-note">{{ t('modpackWizard.noMatches') }}</p>
        </div>
      </section>
      <template v-if="store.preview && ['preview', 'confirm'].includes(store.step)">
        <details v-if="store.requiredFiles.length">
          <summary>{{ t('modpackWizard.requiredFiles', { count: store.requiredFiles.length }) }}</summary>
          <ul>
            <li v-for="file in store.requiredFiles" :key="file.fileId" class="mp-path">{{ file.path }}</li>
          </ul>
        </details>
        <details v-if="store.unsupportedFiles.length">
          <summary>{{ t('modpackWizard.unsupportedFiles', { count: store.unsupportedFiles.length }) }}</summary>
          <ul>
            <li v-for="file in store.unsupportedFiles" :key="file.fileId" class="mp-path">{{ file.path }}</li>
          </ul>
        </details>
      </template>
      <template v-if="['source', 'confirm'].includes(store.step)">
        <label class="mp-field"
          ><span>{{ t('modpackImport.gameDir') }}</span
          ><NSelect
            :value="store.gamePath"
            :options="store.gamePaths"
            :placeholder="t('modpackImport.gameDirPlaceholder')"
            :disabled="store.isSubmittingImport"
            @update:value="store.gamePath = String($event || '')"
        /></label>
        <label class="mp-field"
          ><span>{{ t('modpackImport.versionName') }}</span
          ><NInput
            v-model:value="store.versionName"
            :disabled="store.isSubmittingImport"
            clearable
            :placeholder="t('modpackImport.versionNamePlaceholder')"
          /><small>{{ t('modpackImport.versionNameHint') }}</small></label
        >
        <p v-if="store.step === 'confirm'" class="mp-path">
          {{ t('modpackWizard.target', { path: store.gamePath, name: store.versionName }) }}
        </p>
      </template>
      <div v-if="['preview', 'confirm'].includes(store.step)" class="mp-download-summary" aria-live="polite">
        <p>
          {{
            t('modpackWizard.selectedSummary', {
              count: store.selectedFiles.length,
              excluded: store.excludedFileIds.length,
            })
          }}
        </p>
        <p>
          {{ t('modpackWizard.knownSize', { size: formatBytes(store.knownBytes), unknown: store.unknownSizeCount }) }}
        </p>
        <small class="mp-note">{{ t('modpackWizard.sizeHint') }}</small>
      </div>
      <section v-if="store.step === 'installing'" class="mp-preparing" aria-live="polite">
        <UiLoading mode="inline" size="md" decorative />
        <p>{{ store.installOperation?.message || t('modpackWizard.installing') }}</p>
        <UiProgress :percentage="store.installOperation?.percent || 0" :processing="true" />
        <p class="mp-note">{{ t('modpackWizard.backgroundHint') }}</p>
        <NButton
          :disabled="store.installOperation?.canCancel === false || store.installOperation?.cancellationRequested"
          @click="operationStore.cancel(store.installOperationId)"
          >{{
            t(store.installOperation?.cancellationRequested ? 'operations.cancelRequested' : 'common.cancel')
          }}</NButton
        >
      </section>
      <section v-if="store.step === 'result'" class="mp-result" aria-live="polite">
        <h4>{{ t(resultTitle) }}</h4>
        <p v-if="store.installOperation?.error" class="mp-error">{{ store.installOperation.error }}</p>
        <template v-if="store.result">
          <p>{{ store.result.versionId }}</p>
          <p>
            {{
              t('modpackWizard.resultCounts', {
                downloaded: store.result.downloadedFiles,
                excluded: store.result.excludedOptionalFiles,
                unsupported: store.result.unsupportedFiles,
                overrides: store.result.overridesFiles,
              })
            }}
          </p>
          <details v-if="store.result.warnings.length">
            <summary>{{ t('modpackWizard.warnings', { count: store.result.warnings.length }) }}</summary>
            <ul>
              <li v-for="(warning, index) in store.result.warnings" :key="index">{{ warning }}</li>
            </ul>
          </details>
        </template>
        <p v-else-if="store.installOperation?.status === 'completed'" class="mp-error">
          {{ t('modpackWizard.invalidResponse') }}
        </p>
        <template v-if="operationStore.queryErrors[store.installOperationId]"
          ><p class="mp-error">{{ t('operations.queryFailed') }}</p>
          <NButton @click="operationStore.refresh(store.installOperationId)">{{
            t('operations.refresh')
          }}</NButton></template
        >
      </section>
    </div>
    <template #footer>
      <NButton :disabled="store.isSubmittingImport" @click="store.close()">{{
        t(store.step === 'installing' ? 'modpackWizard.minimize' : 'common.close')
      }}</NButton>
      <NButton v-if="store.step === 'source'" type="primary" :disabled="!store.canPrepare" @click="store.prepare()">{{
        t(store.error ? 'modpackWizard.retryPrepare' : 'modpackWizard.prepare')
      }}</NButton>
      <NButton v-if="store.step === 'preparing'" @click="store.backToSource()">{{ t('common.cancel') }}</NButton>
      <NButton
        v-if="['preview', 'confirm'].includes(store.step)"
        :disabled="store.isSubmittingImport"
        @click="goBack"
        >{{ t('modpackWizard.back') }}</NButton
      >
      <NButton v-if="store.step === 'preview'" type="primary" @click="store.step = 'confirm'">{{
        t('modpackWizard.continue')
      }}</NButton>
      <NButton
        v-if="store.step === 'confirm'"
        type="primary"
        :loading="store.isSubmittingImport"
        :disabled="!store.canImport"
        @click="handleImport"
        >{{ t('modpackWizard.install') }}</NButton
      >
      <NButton
        v-if="
          store.step === 'result' &&
          store.canPrepareAgain &&
          ['failed', 'cancelled'].includes(store.installOperation?.status || '')
        "
        @click="store.backToSource()"
        >{{ t('modpackWizard.prepareAgain') }}</NButton
      >
      <NButton
        v-if="store.step === 'result' && store.result && store.installOperation?.status === 'completed'"
        type="primary"
        @click="viewInstance"
        >{{ t('modpackWizard.viewInstance') }}</NButton
      >
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton, NCheckbox, NInput, NSelect } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import backend from '@/api/client'
import Modal from '@/components/modals/Modal.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiProgress from '@/components/ui/Progress.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import { useModpackImportStore } from '@/features/instances/stores/modpackImportStore'
import { useApplicationOperationStore } from '@/features/operations/stores/applicationOperationStore'

const { t } = useI18n()
const router = useRouter()
const message = useLauncherMessage()
const store = useModpackImportStore()
const operationStore = useApplicationOperationStore()
const resultTitle = computed(() => {
  const status = store.installOperation?.status
  if (status === 'completed') return 'modpackWizard.completed'
  if (status === 'cancelled') return 'modpackWizard.cancelled'
  if (status === 'failed') return 'modpackWizard.installFailed'
  return 'modpackWizard.steps.result'
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}
function goBack() {
  if (store.step === 'confirm' && store.optionalFiles.length) store.step = 'preview'
  else store.backToSource()
}
async function selectSourceFile() {
  const result = await backend.command('select_file', { purpose: 'modpack' })
  const path: unknown = result.data?.path
  if (result.success && typeof path === 'string') store.setSource(path)
}
async function handleImport() {
  const result = await store.importPack()
  if (result.ok) message.success(t('operations.submitted'))
}
async function viewInstance() {
  const target = operationStore.targets[store.installOperationId]
  const path = target?.game_path || store.gamePath
  const versionId = store.result?.versionId
  if (!path || !versionId) return
  const instances = useInstanceStore()
  await instances.scanPath(path, true)
  instances.selectVersion(versionId, path)
  store.close()
  await router.push({ name: 'game' })
}
</script>

<style scoped src="@/styles/components/instances/ModpackImportModal.css"></style>
