<template>
  <span class="instance-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="imageUrl" :src="imageUrl" alt="" :style="{ width: `${size}px`, height: `${size}px` }" />
    <UiIcon v-else :name="fallbackIcon" :size="Math.max(16, Math.round(size * 0.55))" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import backend from '@/api/client'
import UiIcon from '@/components/ui/Icon.vue'
import { getLoaderIcon, getLoaderImage, getVersionImage } from '@/config/version'
import type { InstanceIconSource } from '@/types/instances'

const props = withDefaults(
  defineProps<{
    source: InstanceIconSource
    size?: number
  }>(),
  { size: 38 }
)

const localUrl = ref('')
let requestId = 0

const builtInImages: Record<string, string> = {
  grass: '/img/item/grass.png',
  chest: '/img/item/chest.png',
  command: '/img/item/command.png',
  coal: '/img/item/coal.png',
  iron: '/img/item/iron.png',
  quartz: '/img/item/quartz.png',
}

const imageUrl = computed(() => {
  const icon = props.source.icon
  if (icon?.type === 'data') return icon.value
  if (icon?.type === 'builtin') return builtInImages[icon.value] || getVersionImage(props.source.versionType)
  if (icon?.type === 'loader')
    return getLoaderImage(icon.value) || (icon.value === 'vanilla' ? builtInImages.grass : '')
  if (icon?.type === 'local' || icon?.type === 'external') return localUrl.value
  return getLoaderImage(props.source.primaryLoader) || getVersionImage(props.source.versionType)
})

const fallbackIcon = computed(() => getLoaderIcon(props.source.primaryLoader || 'vanilla'))

watch(
  () => props.source.icon,
  async (icon) => {
    localUrl.value = ''
    const currentRequest = ++requestId
    if (!icon || !['local', 'external'].includes(icon.type) || !icon.value) return
    const imageUrl = await backend.file.toUrl(icon.value)
    if (currentRequest === requestId) localUrl.value = imageUrl || ''
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
.instance-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--r-sm);
  color: var(--primary);
}

.instance-icon img {
  display: block;
  object-fit: contain;
  image-rendering: pixelated;
}
</style>
