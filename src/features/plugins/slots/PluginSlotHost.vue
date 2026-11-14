<template>
  <div
    ref="host"
    class="plugin-slot-host"
    :class="String($attrs.class || '')"
    :data-plugin-slot="slotId"
    :data-slot-context="contextKey"
    :data-slot-context-data="contextDataJson"
    :data-slot-label="descriptor?.purpose || slotId"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { pluginSlotDescriptors, registerPluginSlotHost, unregisterPluginSlotHost } from './slotRegistry'

defineOptions({ name: 'PluginSlotHost', inheritAttrs: false })
const props = defineProps<{ slotId: string; contextKey?: string; contextData?: Record<string, unknown> }>()
const host = ref<HTMLElement | null>(null)
const key = `${props.slotId}:${props.contextKey || 'all'}:${crypto.randomUUID()}`
const descriptor = computed(() => pluginSlotDescriptors.find((item) => item.id === props.slotId))
const contextDataJson = computed(() => (props.contextData ? JSON.stringify(props.contextData) : undefined))

onMounted(() => {
  if (!host.value) return
  registerPluginSlotHost({
    key,
    slotId: props.slotId,
    contextKey: props.contextKey,
    contextData: props.contextData,
    element: host.value,
  })
  // 保留未迁移插件依赖的单实例 DOM id；多上下文实例只依赖 data-plugin-slot。
  if (!props.contextKey && document.querySelectorAll(`[data-plugin-slot="${props.slotId}"]`).length === 1) {
    host.value.id = props.slotId
  }
  // 通知插件桥重新渲染该插槽，覆盖插件在容器挂载前就已注册内容的场景。
  window.dispatchEvent(new CustomEvent('ecl:slot-host-mounted', { detail: { slotId: props.slotId } }))
})
onBeforeUnmount(() => unregisterPluginSlotHost(key))
</script>

<style scoped>
.plugin-slot-host {
  min-width: 0;
}
/* 空插槽平时完全不占空间。可视化时只恢复为零尺寸定位锚点，
   实际边框和标签由画布的 fixed overlay 渲染，绝不参与页面布局。 */
:global(.theme-slot-visualization) .plugin-slot-host:empty {
  position: absolute !important;
  display: block !important;
  width: 0 !important;
  min-width: 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}
</style>
