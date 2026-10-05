<template>
  <UiCard class="skin-avatar-card" :title="t('tools.skinAvatar.title')" icon="photo">
    <div class="skin-avatar-body">
      <UiButton variant="secondary" icon="folder-open" :disabled="saving" :loading="loading" @click="chooseSkin">
        {{ t('tools.skinAvatar.choose') }}
      </UiButton>
      <div v-if="avatarPngDataUrl" class="skin-avatar-preview">
        <img :src="avatarPngDataUrl" :alt="t('tools.skinAvatar.preview')" width="96" height="96" />
        <p>{{ t('tools.skinAvatar.summary', { size: avatarSize, hat: hatSummary }) }}</p>
      </div>
      <p v-else class="skin-avatar-hint">{{ t('tools.skinAvatar.hint') }}</p>
      <details class="tool-options">
        <summary><UiIcon name="chevron-right" :size="16" />{{ t('tools.skinAvatar.settings') }}</summary>
        <div class="skin-avatar-settings">
          <label class="skin-avatar-hat">
            <input v-model="includeHat" type="checkbox" :disabled="saving" />
            {{ t('tools.skinAvatar.includeHat') }}
          </label>
          <fieldset class="skin-avatar-sizes" :disabled="saving">
            <legend>{{ t('tools.skinAvatar.size') }}</legend>
            <label v-for="option in avatarSizes" :key="option">
              <input v-model="avatarSize" type="radio" :value="option" name="skin-avatar-size" />
              {{ option }} × {{ option }}
            </label>
          </fieldset>
        </div>
      </details>
      <p v-if="error" class="skin-avatar-error" role="alert">{{ error }}</p>
      <p v-if="saved" class="skin-avatar-hint" role="status">{{ t('tools.skinAvatar.saved') }}</p>
      <div class="skin-avatar-actions">
        <UiButton
          size="lg"
          icon="download"
          :disabled="!avatarPngDataUrl || loading || saving"
          :loading="saving"
          @click="exportAvatar"
        >
          {{ t('tools.skinAvatar.export') }}
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { BackendCommandError, unwrapResponse } from '@/app/runtime/errorPresentation'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiIcon from '@/components/ui/Icon.vue'
import {
  avatarSizes,
  loadSkinPixels,
  renderAvatarPng,
  SkinAvatarError,
  type AvatarSize,
  type SkinPixels,
} from '@/features/tools/skinAvatar'
import { getErrorMessage } from '@/utils/error'

const { t } = useI18n()
const skinPixels = shallowRef<SkinPixels | null>(null)
const skinSourcePath = ref('')
const avatarSize = ref<AvatarSize>(128)
const includeHat = ref(true)
const avatarPngDataUrl = ref('')
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
let active = true
let selectionRevision = 0
let decoderController: AbortController | undefined
const hatSummary = computed(() => t(`tools.skinAvatar.${includeHat.value ? 'hatOn' : 'hatOff'}`))

function describeError(reason: unknown): string {
  if (reason instanceof SkinAvatarError) return t(`tools.skinAvatar.${reason.reason}`)
  if (reason instanceof BackendCommandError) {
    if (reason.errorCode === 'SKIN_AVATAR_SOURCE_CONFLICT') return t('tools.skinAvatar.sourceConflict')
    if (reason.errorCode === 'SKIN_AVATAR_INVALID_EXTENSION') return t('tools.skinAvatar.invalidExtension')
  }
  return getErrorMessage(reason)
}

watch([skinPixels, avatarSize, includeHat], () => {
  saved.value = false
  if (!skinPixels.value) return
  try {
    avatarPngDataUrl.value = renderAvatarPng(skinPixels.value, avatarSize.value, includeHat.value)
  } catch (reason) {
    avatarPngDataUrl.value = ''
    error.value = describeError(reason)
  }
})

async function chooseSkin(): Promise<void> {
  if (saving.value || loading.value) return
  const version = ++selectionRevision
  decoderController = new AbortController()
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    const selected = unwrapResponse(
      await backend.command('select_image', { purpose: 'skin' }),
      t('tools.skinAvatar.choose')
    )
    if (!active || version !== selectionRevision || !selected.path) return
    const file = unwrapResponse(
      await backend.command('fs_read_file', { path: selected.path, mode: 'base64' }),
      t('tools.skinAvatar.choose')
    )
    if (!active || version !== selectionRevision) return
    const pixels = await loadSkinPixels(file.content, decoderController.signal)
    if (!active || version !== selectionRevision) return
    // 只有完整解码成功才替换旧结果，取消或损坏文件不会丢失已有预览。
    const nextPreview = renderAvatarPng(pixels, avatarSize.value, includeHat.value)
    skinSourcePath.value = selected.path
    skinPixels.value = pixels
    avatarPngDataUrl.value = nextPreview
  } catch (reason) {
    if (active && version === selectionRevision) error.value = describeError(reason)
  } finally {
    if (active && version === selectionRevision) loading.value = false
  }
}

async function exportAvatar(): Promise<void> {
  if (!avatarPngDataUrl.value || saving.value || loading.value) return
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const result = unwrapResponse(
      await backend.command('skin_avatar_export', {
        data_url: avatarPngDataUrl.value,
        size: avatarSize.value,
        source_path: skinSourcePath.value,
      }),
      t('tools.skinAvatar.export')
    )
    if (active) saved.value = !!result.path
  } catch (reason) {
    if (active) error.value = describeError(reason)
  } finally {
    if (active) saving.value = false
  }
}

onBeforeUnmount(() => {
  active = false
  selectionRevision++
  decoderController?.abort()
  skinPixels.value = null
})
</script>

<style scoped src="@/styles/components/tools/SkinAvatarToolCard.css"></style>

<style scoped src="@/styles/components/tools/ToolOptions.css"></style>
