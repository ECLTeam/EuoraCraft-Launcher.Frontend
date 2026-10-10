<template>
  <div ref="element" class="debug-tools-host" :class="{ 'has-debug-tools': store.mode !== 'closed' }" />
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { debugToolsHosts } from '@/features/debug/model/debugToolsHosts'
import { useDebugToolsWindowStore } from '@/features/debug/stores/debugToolsWindowStore'

const props = withDefaults(defineProps<{ hostId?: string }>(), { hostId: 'page' })
const store = useDebugToolsWindowStore()
const element = ref<HTMLElement | null>(null)
watch(
  element,
  (host) => {
    if (host) debugToolsHosts.set(props.hostId, host)
  },
  { flush: 'post' }
)
onUnmounted(() => debugToolsHosts.delete(props.hostId))
</script>

<style scoped>
.debug-tools-host {
  position: sticky;
  z-index: 90;
  top: 0;
  flex-shrink: 0;
  height: 0;
}
.debug-tools-host.has-debug-tools {
  height: 60px;
}
</style>
