<template>
  <NSelect
    v-model:show="isOpen"
    class="ui-select"
    role="combobox"
    :aria-label="ariaLabel || placeholder || t('common.selectPlaceholder')"
    :aria-expanded="isOpen"
    :aria-disabled="disabled"
    :value="selectedValue"
    :options="normalizedOptions"
    :size="naiveSize"
    :placeholder="placeholder || t('common.selectPlaceholder')"
    :filterable="searchable"
    :filter="filterOption"
    :disabled="disabled"
    :inputProps="{ id, 'aria-label': ariaLabel || placeholder || t('common.selectPlaceholder') }"
    :renderLabel="renderLabel"
    :consistentMenuWidth="false"
    to="#app"
    @update:value="select"
  >
    <template #empty>{{ emptyText || t('common.noOptions') }}</template>
  </NSelect>
</template>

<script setup lang="ts">
import { NSelect, type SelectOption as NaiveSelectOption } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export interface SelectOption {
  label?: string
  value: string
  desc?: string
}

defineOptions({ name: 'UiSelect' })

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SelectOption[]
    placeholder?: string
    searchable?: boolean
    emptyText?: string
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    id?: string
    ariaLabel?: string
  }>(),
  { size: 'md', disabled: false, searchable: false, placeholder: '', emptyText: '', id: '', ariaLabel: '' }
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const { t } = useI18n()
const isOpen = ref(false)
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) isOpen.value = false
  }
)
const naiveSize = computed(() => {
  if (props.size === 'sm') return 'small'
  if (props.size === 'lg') return 'large'
  return 'medium'
})
const normalizedOptions = computed(() =>
  props.options.map((option) => ({ ...option, label: option.label || option.value }))
)
const selectedValue = computed(() =>
  props.options.some((option) => option.value === props.modelValue) ? props.modelValue : null
)

function filterOption(pattern: string, option: NaiveSelectOption): boolean {
  const query = pattern.toLocaleLowerCase()
  const label = String(option.label ?? option.value).toLocaleLowerCase()
  const description = typeof option.desc === 'string' ? option.desc.toLocaleLowerCase() : ''
  return label.includes(query) || description.includes(query)
}

function renderLabel(option: NaiveSelectOption) {
  return h('div', { class: 'ui-select-option' }, [
    h('span', { class: 'ui-select-option-label' }, String(option.label ?? option.value)),
    typeof option.desc === 'string' && option.desc
      ? h('span', { class: 'ui-select-option-description' }, option.desc)
      : null,
  ])
}

function select(value: string | number | Array<string | number> | null) {
  if (props.disabled || typeof value !== 'string') return
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style src="@/styles/components/ui/Select.css"></style>
