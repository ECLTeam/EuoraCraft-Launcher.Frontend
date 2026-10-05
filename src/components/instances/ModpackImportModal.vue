<template>
  <Modal
    :visible="store.visible"
    :title="t('modpackImport.title')"
    width="560px"
    wrapperClass="modpack-import-modal"
    bodyClass="modpack-import-modal-body"
    @update:visible="store.close()"
  >
    <div class="modpack-import-fields">
      <label v-if="!store.isOnline" class="mp-field">
        <span>{{ t('modpackImport.fileLabel') }}</span>
        <div class="mp-file-row">
          <NInput :value="store.sourcePath" readonly :placeholder="t('modpackImport.filePlaceholder')" />
          <NButton @click="selectSourceFile">{{ t('modpackImport.selectFile') }}</NButton>
        </div>
      </label>
      <label v-else class="mp-field">
        <span>{{ t('modpackImport.onlinePack') }}</span>
        <NInput :value="store.onlineTitle" readonly />
      </label>

      <label class="mp-field">
        <span>{{ t('modpackImport.gameDir') }}</span>
        <NSelect
          :value="store.gamePath"
          :options="store.gamePaths"
          :placeholder="t('modpackImport.gameDirPlaceholder')"
          @update:value="store.gamePath = String($event || '')"
        />
      </label>

      <label class="mp-field">
        <span>{{ t('modpackImport.versionName') }}</span>
        <NInput
          :value="store.versionName"
          :placeholder="t('modpackImport.versionNamePlaceholder')"
          clearable
          @update:value="store.versionName = String($event || '')"
        />
        <small>{{ t('modpackImport.versionNameHint') }}</small>
      </label>
    </div>

    <template #footer>
      <NButton @click="store.close()">
        {{ t('common.cancel') }}
      </NButton>
      <NButton type="primary" :loading="store.isSubmittingImport" :disabled="!store.canImport" @click="handleImport">
        <template #icon><UiIcon name="upload" :size="15" /></template>
        {{ store.isOnline ? t('modpackImport.installPack') : t('modpackImport.import') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton, NInput, NSelect } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useModpackImportStore } from '@/features/instances/stores/modpackImportStore'

const { t } = useI18n()
const message = useLauncherMessage()
const store = useModpackImportStore()

async function selectSourceFile() {
  const result = await backend.command('select_file', { purpose: 'modpack' })
  if (!result.success || !result.data?.path) return
  store.setSource(result.data.path as string)
}

async function handleImport() {
  const result = await store.importPack()
  if (result.ok) {
    message.success(t('operations.submitted'))
  } else if (result.error) {
    message.error(result.error)
  }
}
</script>

<style scoped src="@/styles/components/instances/ModpackImportModal.css"></style>
