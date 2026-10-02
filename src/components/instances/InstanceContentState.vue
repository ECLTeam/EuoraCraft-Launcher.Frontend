<template>
  <div class="instance-content-state" :class="{ 'is-placeholder': loading || empty }">
    <UiLoading v-if="loading" mode="block" />
    <NEmpty v-else-if="empty" :description="emptyDescription">
      <template v-if="$slots['empty-actions']" #extra><slot name="empty-actions" /></template>
    </NEmpty>
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { NEmpty } from 'naive-ui'
import UiLoading from '@/components/ui/Loading.vue'

defineProps<{ loading: boolean; empty: boolean; emptyDescription: string }>()
</script>

<style scoped>
.instance-content-state {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
.instance-content-state.is-placeholder {
  min-height: 180px;
  align-items: center;
  justify-content: center;
}
.instance-content-state > .ui-loading {
  flex: 1;
  width: 100%;
}
</style>
