<template>
  <div class="ui-input-wrapper" :class="[`input-${size}`, { 'is-focused': isFocused, 'is-disabled': disabled }]">
    <UiIcon v-if="leadingIcon" :name="leadingIcon.replace('icon-', '')" class="prefix-icon" />

    <input
      :id="id"
      ref="inputRef"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :aria-label="ariaLabel"
      autocomplete="off"
      class="ui-input"
      @input="handleInput"
      @focus="isFocused = true"
      @blur="isFocused = false"
      @keydown.enter="$emit('enter')"
    />

    <button
      v-if="clearable && modelValue && !readonly && !disabled"
      type="button"
      class="clear-icon"
      :aria-label="t('common.clearInput')"
      @click="handleClear"
    >
      <UiIcon name="close" />
    </button>

    <UiIcon v-if="suffixIcon" :name="suffixIcon.replace('icon-', '')" class="suffix-icon" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'UiInput' })

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    clearable?: boolean
    prefixIcon?: string
    suffixIcon?: string
    id?: string
    ariaLabel?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    type: 'text',
    modelValue: '',
    placeholder: '',
    disabled: false,
    readonly: false,
    clearable: false,
    prefixIcon: '',
    suffixIcon: '',
    id: '',
    ariaLabel: '',
    size: 'md',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'enter'): void
  (e: 'clear'): void
}>()

const leadingIcon = computed(() => props.prefixIcon)
const { t } = useI18n()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const handleClear = () => {
  if (props.readonly || props.disabled) return
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}
</script>

<style scoped src="@/styles/components/ui/Input.css"></style>
