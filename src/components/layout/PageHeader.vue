<template>
  <header class="ecl-page-header">
    <div class="ecl-page-header__identity">
      <div v-if="icon" class="ecl-page-header__icon">
        <UiIcon :name="icon" :size="20" />
      </div>
      <div>
        <h1 class="ecl-page-header__title">{{ title }}</h1>
        <p v-if="description" class="ecl-page-header__description">{{ description }}</p>
      </div>
    </div>
    <div v-if="$slots.default" class="ecl-page-header__actions">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { UiIcon } from '@/components/ui'

defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>
