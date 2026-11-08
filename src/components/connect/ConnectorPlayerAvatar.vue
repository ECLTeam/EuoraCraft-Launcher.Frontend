<template>
  <UiAvatar :src="headSrc" :name="name" :size="size" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { UiAvatar } from '@/components/ui'
import { renderSkinAvatar } from '@/composables/useAvatarRenderer'

defineOptions({ name: 'ConnectorPlayerAvatar' })

const props = withDefaults(
  defineProps<{
    // 联机协议交换的完整皮肤 base64（PNG），需裁剪出头部再显示
    skinBase64?: string | null
    name?: string
    size?: number
  }>(),
  {
    skinBase64: null,
    name: '',
    size: 40,
  }
)

// 跨组件复用裁剪结果，避免同一皮肤反复走 canvas
const headCache = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

const headSrc = ref<string | ''>('')
let renderRequest = 0

async function updateHead(): Promise<void> {
  const base64 = props.skinBase64?.trim()
  const request = ++renderRequest
  if (!base64) {
    headSrc.value = ''
    return
  }
  const key = `${props.size}:${base64}`
  const cached = headCache.get(key)
  if (cached) {
    headSrc.value = cached
    return
  }
  const url = `data:image/png;base64,${base64}`
  let task = pending.get(key)
  if (!task) {
    task = renderSkinAvatar(url, props.size).finally(() => pending.delete(key))
    pending.set(key, task)
  }
  const result = await task
  if (request !== renderRequest) return
  if (result) {
    headCache.set(key, result)
    headSrc.value = result
  } else {
    headSrc.value = ''
  }
}

onMounted(updateHead)
watch(() => [props.skinBase64, props.size] as const, updateHead)
</script>
