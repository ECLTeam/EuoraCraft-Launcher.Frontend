<template>
  <FullscreenModal v-model:visible="visible" :title="t('javaManager.title')" :showFooter="false">
    <JavaManagerPanel
      v-if="visible"
      selectable
      :requiredMajor="requiredMajor"
      :initialView="initialView"
      :scopeKey="scopeKey"
      :gamePath="gamePath"
      :versionId="versionId"
      @selected="emit('selected', $event)"
    />
  </FullscreenModal>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FullscreenModal from '@/components/modals/FullscreenModal.vue'
import JavaManagerPanel from '@/features/java/components/JavaManagerPanel.vue'
import type { JavaRuntime } from '@/types/java'
const props = withDefaults(
  defineProps<{
    visible: boolean
    requiredMajor?: number | null
    initialView?: 'installed' | 'download'
    gamePath?: string
    versionId?: string
    scopeKey?: string
  }>(),
  { requiredMajor: null, initialView: 'installed', scopeKey: '', gamePath: '', versionId: '' }
)
const emit = defineEmits<{ 'update:visible': [value: boolean]; selected: [runtime: JavaRuntime] }>()
const { t } = useI18n()
const visible = computed({ get: () => props.visible, set: (value) => emit('update:visible', value) })
</script>
