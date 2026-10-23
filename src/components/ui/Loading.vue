<template>
  <component
    :is="rootTag"
    class="ui-loading"
    :class="[`ui-loading--${mode}`, `ui-loading--${size}`, { 'is-visible': show }]"
    :aria-busy="show || undefined"
  >
    <slot />
    <span
      v-if="show"
      class="ui-loading__indicator"
      :role="decorative ? undefined : 'status'"
      :aria-live="decorative ? undefined : 'polite'"
      :aria-label="decorative ? undefined : label || t('app.loading')"
    >
      <svg
        class="ui-loading__ring"
        :width="ringSize"
        :height="ringSize"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle class="ui-loading__ring-track" cx="12" cy="12" r="9" />
        <circle class="ui-loading__ring-arc" cx="12" cy="12" r="9" />
      </svg>
      <span v-if="label" class="ui-loading__label">{{ label }}</span>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'UiLoading' })

const props = withDefaults(
  defineProps<{
    show?: boolean
    mode?: 'inline' | 'block' | 'overlay'
    size?: 'xs' | 'sm' | 'md' | 'lg'
    label?: string
    decorative?: boolean
  }>(),
  {
    show: true,
    mode: 'block',
    size: 'md',
    label: '',
    decorative: false,
  }
)

const { t } = useI18n()

const rootTag = computed(() => (props.mode === 'inline' ? 'span' : 'div'))
const ringSize = computed(() => {
  if (props.size === 'md' && props.mode !== 'inline') return 24
  return { xs: 12, sm: 16, md: 18, lg: 32 }[props.size]
})
</script>

<style scoped src="@/styles/components/ui/Loading.css"></style>
