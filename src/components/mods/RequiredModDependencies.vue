<template>
  <section v-if="loading || dependencies.length" class="required-dependencies">
    <div class="required-dependencies-title">
      <UiIcon name="packages" :size="15" />
      {{ t('mods.requiredDependencies') }}
    </div>
    <UiLoading :show="loading" mode="overlay" size="sm">
      <div class="dependency-mod-list" :class="{ loading }">
        <button
          v-for="dependency in dependencies"
          :key="dependency.id"
          type="button"
          class="dependency-mod-card"
          @click="emit('open', dependency)"
        >
          <span class="dependency-mod-icon">
            <img v-if="dependency.iconUrl" :src="dependency.iconUrl" :alt="dependency.title" loading="lazy" />
            <UiIcon v-else name="cube" :size="18" />
          </span>
          <span class="dependency-mod-main">
            <span class="dependency-mod-title">
              <span class="dependency-mod-name">{{ dependency.title }}</span>
              <span class="dependency-mod-tags">
                <NTag v-for="loader in dependency.loaders.slice(0, 2)" :key="loader" size="tiny" :bordered="false">
                  {{ loaderName(loader) }}
                </NTag>
              </span>
            </span>
            <span class="dependency-mod-description">{{ dependency.description }}</span>
            <span class="dependency-mod-meta">
              <span v-if="gameVersion">{{ gameVersion }}</span>
              <span>{{ dependency.author }}</span>
              <span>Modrinth</span>
            </span>
          </span>
          <UiIcon name="chevron-right" :size="16" class="dependency-open-icon" />
        </button>
      </div>
    </UiLoading>
    <p class="required-dependencies-hint">
      {{ t('mods.dependencyOpenHint', { version: gameVersion }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { UiIcon, UiLoading } from '@/components/ui'
import type { ModInfo } from '@/types/mods'

withDefaults(
  defineProps<{
    dependencies: ModInfo[]
    loading?: boolean
    gameVersion?: string
  }>(),
  { loading: false, gameVersion: '' }
)

const emit = defineEmits<{
  open: [dependency: ModInfo]
}>()

const { t } = useI18n()

function loaderName(value: string): string {
  if (value.toLocaleLowerCase() === 'neoforge') return 'NeoForge'
  return value.charAt(0).toUpperCase() + value.slice(1)
}
</script>

<style scoped>
.required-dependencies {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  background: color-mix(in srgb, var(--ecl-surface) 88%, var(--primary) 12%);
  border: 1px solid color-mix(in srgb, var(--ecl-border) 72%, var(--primary) 28%);
  border-radius: 8px;
}

.required-dependencies-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ecl-text);
  font-size: 12px;
  font-weight: 650;
}

.dependency-mod-list {
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
}

.dependency-mod-list.loading {
  min-height: 44px;
}

.dependency-mod-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 9px;
  color: var(--ecl-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--ecl-surface);
  border: 1px solid var(--ecl-border);
  border-radius: 7px;
  transition:
    border-color var(--duration-fast) var(--ease-emphasized),
    background var(--duration-fast) var(--ease-emphasized);
}

.dependency-mod-card:hover {
  background: var(--glass-item-hover);
  border-color: color-mix(in srgb, var(--primary) 58%, var(--ecl-border));
}

.dependency-mod-icon {
  display: flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: 7px;
}

.dependency-mod-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dependency-mod-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dependency-mod-title,
.dependency-mod-tags,
.dependency-mod-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dependency-mod-name,
.dependency-mod-description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dependency-mod-name {
  min-width: 0;
  font-size: 12px;
  font-weight: 650;
}

.dependency-mod-tags {
  flex-shrink: 0;
}

.dependency-mod-description,
.dependency-mod-meta,
.required-dependencies-hint {
  color: var(--ecl-text-secondary);
  font-size: 11px;
}

.dependency-mod-meta {
  gap: 9px;
}

.dependency-open-icon {
  flex-shrink: 0;
  color: var(--ecl-text-secondary);
}

.required-dependencies-hint {
  margin: 0;
}
</style>
