<template>
  <Modal
    :visible="visible"
    :title="t('settings.aboutTab.update.updateAvailableTitle')"
    width="min(540px, calc(100vw - 32px))"
    wrapperClass="update-result-modal-container"
    :closable="!busy"
    :priority="60"
    @update:visible="emit('update:visible', $event)"
    @close="emit('close')"
  >
    <div class="update-result-modal">
      <div class="update-result-modal__release">
        <div class="update-result-modal__target">
          <strong class="update-result-modal__version">{{ version }}</strong>
          <span class="update-result-modal__channel">{{ channelLabel }}</span>
        </div>
        <p class="update-result-modal__current">
          {{ t('settings.aboutTab.update.currentVersion') }}: {{ result?.current_version }}
        </p>
      </div>

      <section class="update-result-modal__notes">
        <h4>{{ t('settings.aboutTab.update.notesTitle') }}</h4>
        <p v-if="notes" class="update-result-modal__notes-content">{{ notes }}</p>
        <p v-else class="update-result-modal__notes-empty">{{ t('settings.aboutTab.update.notesEmpty') }}</p>
      </section>

      <div v-if="!selfUpdateEnabled" class="update-result-modal__hint">
        <UiIcon name="info" :size="16" />
        <span>{{ t('settings.aboutTab.update.selfUpdateDisabled') }}</span>
      </div>
      <p v-if="!selfUpdateEnabled && !releaseUrl" class="update-result-modal__unavailable">
        {{ t('settings.aboutTab.update.releasePageUnavailable') }}
      </p>

      <div v-if="downloading" class="update-result-modal__progress" role="status" aria-live="polite">
        <div
          class="update-result-modal__progress-track"
          role="progressbar"
          :aria-label="t('settings.aboutTab.update.downloading')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="downloadPercent >= 0 ? downloadPercent : undefined"
        >
          <div
            class="update-result-modal__progress-bar"
            :class="{ 'is-indeterminate': downloadPercent < 0 }"
            :style="downloadPercent >= 0 ? { width: downloadPercent + '%' } : undefined"
          ></div>
        </div>
        <span class="update-result-modal__progress-text">
          {{ t('settings.aboutTab.update.downloading') }}
          <template v-if="downloadPercent >= 0">{{ downloadPercent }}%</template>
        </span>
      </div>
    </div>

    <template #footer>
      <NButton :disabled="busy" @click="dismiss">{{ t('settings.aboutTab.update.later') }}</NButton>
      <NButton v-if="selfUpdateEnabled" type="primary" :loading="busy" @click="updateNow">
        <template #icon><UiIcon name="download" :size="16" /></template>
        {{ busy ? t('settings.aboutTab.update.updating') : t('settings.aboutTab.update.downloadAndRestart') }}
      </NButton>
      <NButton v-else-if="releaseUrl" type="primary" @click="viewRelease">
        <template #icon><UiIcon name="external-link" :size="16" /></template>
        {{ t('settings.aboutTab.update.releasePage') }}
      </NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { openExternalUrl } from '@/utils/openExternal'
import { useUpdateCheck } from '../composables/useUpdateCheck'
import { getUpdateVersionChannel } from '../model/updateModal'

defineOptions({ name: 'UpdateResultModal' })

defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const message = useLauncherMessage()
const { lastResult, selfUpdateEnabled, downloading, downloadPercent, downloadUpdate, applyUpdate } = useUpdateCheck()
const updating = ref(false)
const busy = computed(() => updating.value || downloading.value)
const result = computed(() => lastResult.value)
const version = computed(() => result.value?.latest_version || '')
const notes = computed(() => result.value?.latest_notes?.trim() || '')
const channelLabel = computed(() => t(`settings.aboutTab.version.types.${getUpdateVersionChannel(version.value)}`))
const releaseUrl = computed(() => {
  try {
    const url = new URL(result.value?.latest_url || '')
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
})

function dismiss(): void {
  if (busy.value) return
  emit('update:visible', false)
  emit('close')
}

async function viewRelease(): Promise<void> {
  if (releaseUrl.value) await openExternalUrl(releaseUrl.value)
}

async function updateNow(): Promise<void> {
  if (busy.value || !selfUpdateEnabled.value) return
  updating.value = true
  const title = t('settings.aboutTab.update.title')
  const loadingMessage = message.loading(t('settings.aboutTab.update.preparing'))
  try {
    const targetVersion = await downloadUpdate()
    loadingMessage.destroy()
    if (!targetVersion) {
      message.error(t('settings.aboutTab.update.downloadFailed'), { title, duration: 6000 })
      return
    }
    const restarting = await applyUpdate()
    if (restarting) {
      message.success(t('settings.aboutTab.update.restarting', { version: targetVersion }), { title, duration: 6000 })
      emit('update:visible', false)
    } else {
      message.error(t('settings.aboutTab.update.applyFailed'), { title, duration: 6000 })
    }
  } finally {
    loadingMessage.destroy()
    updating.value = false
  }
}
</script>

<style src="@/styles/views/settings/UpdateResultModal.css"></style>
