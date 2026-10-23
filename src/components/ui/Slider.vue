<template>
  <div class="ui-slider" :class="{ 'ui-slider--disabled': disabled }">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      class="ui-slider-input"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-valuetext="suffix ? `${modelValue}${suffix}` : undefined"
      :style="{ '--ui-slider-percent': `${percentage}%` }"
      @input="handleInput"
    />
    <span class="ui-slider-value">{{ modelValue }}{{ suffix }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'UiSlider' })

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    suffix?: string
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    suffix: '',
    disabled: false,
    ariaLabel: '',
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const percentage = computed(() => {
  const range = props.max - props.min
  if (range <= 0 || !Number.isFinite(props.modelValue)) return 0
  return Math.max(0, Math.min(100, ((props.modelValue - props.min) / range) * 100))
})

function handleInput(e: Event) {
  if (props.disabled) return
  const value = (e.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value)) emit('update:modelValue', value)
}
</script>

<style scoped src="@/styles/components/ui/Slider.css"></style>
