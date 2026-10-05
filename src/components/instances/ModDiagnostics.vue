<template>
  <ul v-if="diagnostics?.length" class="mod-diagnostics">
    <li v-for="(diagnostic, index) in diagnostics" :key="index">
      <span>{{ t(`modDiagnostics.${diagnostic.code}`, { id: diagnostic.modId || '' }) }}</span>
      <small v-if="diagnostic.constraints?.length">{{ diagnostic.constraints.join(' || ') }}</small>
      <button
        v-if="diagnostic.code === 'disabled_provider' && diagnostic.providers?.length === 1"
        type="button"
        :disabled="busy"
        @click="emit('enable', diagnostic.providers[0]!)"
      >
        {{ t('modDiagnostics.enable') }}
      </button>
      <button
        v-if="diagnostic.modId && ['missing_required', 'version_mismatch'].includes(diagnostic.code)"
        type="button"
        @click="emit('search', diagnostic.modId)"
      >
        {{ t('modDiagnostics.search') }}
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LocalModDiagnostic } from '@/types/mods'

defineProps<{ diagnostics?: LocalModDiagnostic[]; busy?: boolean }>()
const emit = defineEmits<{ enable: [filename: string]; search: [modId: string] }>()
const { t } = useI18n()
</script>

<style scoped>
.mod-diagnostics {
  margin: 4px 0;
  padding: 0;
  list-style: none;
  color: var(--warning);
  font-size: 12px;
}
.mod-diagnostics li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.mod-diagnostics small {
  overflow-wrap: anywhere;
}
.mod-diagnostics button {
  color: var(--primary);
  border: 0;
  background: transparent;
  cursor: pointer;
  text-decoration: underline;
}
.mod-diagnostics button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
