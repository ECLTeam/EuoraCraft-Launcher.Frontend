<!-- src/components/ui/Icon.vue -->
<template>
  <span :class="['icon', `icon-${name}`, className, { spin: isSpinner }]" :style="style">
    <!-- 品牌图标（微软登录）以内联 SVG 渲染，保持四色方块 -->
    <svg
      v-if="name === 'microsoft'"
      class="icon-microsoft"
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 21 21"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
    <Icon v-else :icon="`tabler:${getIconName(name)}`" :width="iconSize" :height="iconSize" :aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue/offline'
import { computed } from 'vue'
import { getIconName } from './iconify'

defineOptions({ name: 'UiIcon' })

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  className: '',
  style: () => ({}),
})

const iconSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const isSpinner = computed(() => props.name === 'spinner' || props.name === 'loading')

interface Props {
  name: string
  size?: number | string
  className?: string
  style?: Record<string, string>
}
</script>

<style scoped src="@/styles/components/ui/Icon.css"></style>
