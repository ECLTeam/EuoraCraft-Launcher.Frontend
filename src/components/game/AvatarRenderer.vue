<template>
  <div class="skin-container" :class="{ 'is-loading': loading, 'is-error': error }" :style="containerStyle">
    <img
      v-if="avatarUrl"
      :src="avatarUrl"
      class="skin-layer"
      :width="size"
      :height="size"
      :alt="`${username || 'Player'} avatar`"
      @error="handleImageError"
    />
    <span v-else-if="!loading" class="skin-fallback">{{ fallbackLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type CSSProperties } from 'vue'
import { useAvatarRenderer } from '@/composables/useAvatarRenderer'

defineOptions({ name: 'AvatarRenderer' })

const props = withDefaults(defineProps<Props>(), {
  uuid: '',
  username: '',
  typeName: 'Mojang',
  skinUrl: '',
  accountId: '',
  size: 64,
})

interface Props {
  uuid?: string
  username?: string
  typeName?: string
  skinUrl?: string
  accountId?: string
  size?: number
}

const avatarUrl = ref<string>('')
const { loading, error, renderAvatar, cacheRevision } = useAvatarRenderer()
let renderRequest = 0

const containerStyle = computed<CSSProperties>(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(10, Math.round(props.size * 0.42))}px`,
  position: 'relative',
}))

const fallbackLabel = computed(() => (props.username.trim().charAt(0) || '?').toUpperCase())

async function updateAvatar() {
  const request = ++renderRequest
  const url = await renderAvatar(props.uuid, props.username, props.size, props.skinUrl, props.accountId, props.typeName)
  if (request !== renderRequest) return
  avatarUrl.value = url || ''
}

function handleImageError() {
  avatarUrl.value = ''
}

onMounted(() => {
  updateAvatar()
})

watch(
  [
    () => props.uuid,
    () => props.username,
    () => props.typeName,
    () => props.skinUrl,
    () => props.accountId,
    () => props.size,
    cacheRevision,
  ],
  updateAvatar
)
</script>

<style scoped src="@/styles/components/game/AvatarRenderer.css"></style>
