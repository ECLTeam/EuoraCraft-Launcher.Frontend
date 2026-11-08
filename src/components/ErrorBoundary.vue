<template>
  <div :key="boundaryKey" class="error-boundary-root">
    <div v-if="!hasError" class="error-boundary-content">
      <slot />
    </div>
    <div v-else class="error-boundary-fallback">
      <div class="error-boundary-card">
        <UiIcon name="alert-triangle" :size="40" class="error-boundary-icon" />
        <h3 class="error-boundary-title">{{ title || t('errorBoundary.title') }}</h3>
        <p class="error-boundary-desc">{{ description || t('errorBoundary.description') }}</p>
        <NButton type="primary" size="small" @click="retry">
          <template #icon><UiIcon name="refresh" :size="14" /></template>
          {{ t('errorBoundary.retry') }}
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiIcon } from '@/components/ui'

defineOptions({ name: 'ErrorBoundary' })

withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
})

const { t } = useI18n()

const hasError = ref(false)
const errorMessage = ref('')
const boundaryKey = ref(0)

// 捕获后代组件渲染/生命周期错误，返回 false 阻止继续冒泡，避免影响其他页面
onErrorCaptured((err, _instance, info) => {
  hasError.value = true
  errorMessage.value = err instanceof Error ? err.message : String(err)
  console.error('[ErrorBoundary] 捕获到页面渲染错误:', err, info)
  return false
})

// 重试时更换根节点 key 强制重建整个边界，避免复用错误后损坏的 DOM 子树
const retry = () => {
  boundaryKey.value += 1
  hasError.value = false
  errorMessage.value = ''
}

interface Props {
  title?: string
  description?: string
}
</script>

<style src="@/styles/components/ErrorBoundary.css"></style>
