<template>
  <UiCard class="skin-avatar-card" :title="t('connect.tools.skinAvatar.title')" icon="photo">
    <div class="skin-avatar-body">
      <UiButton variant="secondary" icon="folder-open" :disabled="saving" :loading="loading" @click="chooseSkin">
        {{ t('connect.tools.skinAvatar.choose') }}
      </UiButton>
      <div v-if="preview" class="skin-avatar-preview">
        <img :src="preview" :alt="t('connect.tools.skinAvatar.preview')" width="96" height="96" />
        <p>{{ t('connect.tools.skinAvatar.summary', { size, hat: hatSummary }) }}</p>
      </div>
      <p v-else class="skin-avatar-hint">{{ t('connect.tools.skinAvatar.hint') }}</p>
      <details class="tool-options">
        <summary><UiIcon name="chevron-right" :size="16" />{{ t('connect.tools.skinAvatar.settings') }}</summary>
        <div class="skin-avatar-settings">
          <label class="skin-avatar-hat">
            <input v-model="includeHat" type="checkbox" :disabled="saving" />
            {{ t('connect.tools.skinAvatar.includeHat') }}
          </label>
          <fieldset class="skin-avatar-sizes" :disabled="saving">
            <legend>{{ t('connect.tools.skinAvatar.size') }}</legend>
            <label v-for="option in avatarSizes" :key="option">
              <input v-model="size" type="radio" :value="option" name="skin-avatar-size" />
              {{ option }} × {{ option }}
            </label>
          </fieldset>
        </div>
      </details>
      <p v-if="error" class="skin-avatar-error" role="alert">{{ error }}</p>
      <p v-if="saved" class="skin-avatar-hint" role="status">{{ t('connect.tools.skinAvatar.saved') }}</p>
      <div class="skin-avatar-actions">
        <UiButton
          size="lg"
          icon="download"
          :disabled="!preview || loading || saving"
          :loading="saving"
          @click="exportAvatar"
        >
          {{ t('connect.tools.skinAvatar.export') }}
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
const skin = shallowRef<SkinPixels | null>(null)
const sourcePath = ref('')
const size = ref<AvatarSize>(128)
const includeHat = ref(true)
const preview = ref('')
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
let active = true
let requestVersion = 0
let decoderController: AbortController | undefined
const hatSummary = computed(() => t(`connect.tools.skinAvatar.${includeHat.value ? 'hatOn' : 'hatOff'}`))

function describeError(reason: unknown): string {
  if (reason instanceof SkinAvatarError) return t(`connect.tools.skinAvatar.${reason.reason}`)
  if (reason instanceof BackendCommandError) {
    if (reason.errorCode === 'SKIN_AVATAR_SOURCE_CONFLICT') return t('connect.tools.skinAvatar.sourceConflict')
    if (reason.errorCode === 'SKIN_AVATAR_INVALID_EXTENSION') return t('connect.tools.skinAvatar.invalidExtension')
  }
  return getErrorMessage(reason)
}

watch([skin, size, includeHat], () => {
  saved.value = false
  if (!skin.value) return
  try {
    preview.value = renderAvatarPng(skin.value, size.value, includeHat.value)
  } catch (reason) {
    preview.value = ''
    error.value = describeError(reason)
  }
})

async function chooseSkin(): Promise<void> {
  if (saving.value || loading.value) return
  const version = ++requestVersion
  decoderController = new AbortController()
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    const selected = unwrapResponse(
      await backend.command('select_image', { purpose: 'skin' }),
      t('connect.tools.skinAvatar.choose')
    )
    if (!active || version !== requestVersion || !selected.path) return
    const file = unwrapResponse(
      await backend.command('fs_read_file', { path: selected.path, mode: 'base64' }),
      t('connect.tools.skinAvatar.choose')
    )
    if (!active || version !== requestVersion) return
    const pixels = await loadSkinPixels(file.content, decoderController.signal)
    if (!active || version !== requestVersion) return
    // 只有完整解码成功才替换旧结果，取消或损坏文件不会丢失已有预览。
    const nextPreview = renderAvatarPng(pixels, size.value, includeHat.value)
    sourcePath.value = selected.path
    skin.value = pixels
    preview.value = nextPreview
  } catch (reason) {
    if (active && version === requestVersion) error.value = describeError(reason)
  } finally {
    if (active && version === requestVersion) loading.value = false
  }
}

async function exportAvatar(): Promise<void> {
  if (!preview.value || saving.value || loading.value) return
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const result = unwrapResponse(
      await backend.command('skin_avatar_export', {
        data_url: preview.value,
        size: size.value,
        source_path: sourcePath.value,
      }),
      t('connect.tools.skinAvatar.export')
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
  requestVersion++
  decoderController?.abort()
  skin.value = null
})
</script>

<style scoped src="@/styles/components/connect/SkinAvatarToolCard.css"></style>

<style scoped src="@/styles/components/connect/ToolOptions.css"></style>
