<template>
  <NSelect
    v-model:value="currentKey"
    :options="options"
    :renderLabel="renderLabel"
    :inputProps="{ 'aria-label': ariaLabel || placeholder || t('mods.selectInstance') }"
    :placeholder="placeholder || t('mods.selectInstance')"
    filterable
    :disabled="!target.ready.value || options.length === 0"
    :consistentMenuWidth="false"
    :menuProps="{ class: ['ris-select-menu', menuClass].filter(Boolean).join(' ') }"
    class="resource-instance-select"
  />
</template>

<script setup lang="ts">
import { NSelect } from 'naive-ui'
import { computed, h, type VNode } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import { instanceKey, type useResourceInstallTarget } from '@/composables/useResourceInstallTarget'
import { instanceDisplayName } from '@/features/instances/model/instancePresentation'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { ScannedVersion } from '@/types/instances'
import { normalizeGamePath } from '@/utils/path'

const props = withDefaults(
  defineProps<{
    target: ReturnType<typeof useResourceInstallTarget>
    placeholder?: string
    showNoneOption?: boolean
    noneLabel?: string
    compatibleOnly?: boolean
    showIcon?: boolean
    ariaLabel?: string
    menuClass?: string
  }>(),
  {
    placeholder: '',
    showNoneOption: false,
    noneLabel: '',
    compatibleOnly: false,
    showIcon: true,
    ariaLabel: '',
    menuClass: '',
  }
)

const emit = defineEmits<{
  (e: 'persist'): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 解析实例所在游戏路径的配置名称（如"默认路径"），未配置时回退到路径末段
function pathDisplayName(version: ScannedVersion): string {
  const normalized = normalizeGamePath(version.path)
  const entry = settingsStore.game.minecraft_paths.find((path) => {
    const value = typeof path === 'string' ? path : path.path
    return normalizeGamePath(value) === normalized
  })
  if (entry && typeof entry === 'object' && entry.name) return entry.name
  const parts = version.path.split(/[\\/]/)
  return parts[parts.length - 1] || version.path
}

const options = computed(() => {
  const list = (
    props.compatibleOnly ? props.target.compatibleInstances.value : props.target.installableInstances.value
  ).map((version) => ({
    label: `${instanceDisplayName(version)} · ${version.vanillaName} · ${version.primaryLoader} (${pathDisplayName(version)})`,
    value: instanceKey(version),
  }))
  if (props.showNoneOption) {
    return [{ label: props.noneLabel || t('mods.noneInstance'), value: '' }, ...list]
  }
  return list
})

const currentKey = computed({
  get: () => props.target.selectedKey.value,
  set: (key: string) => {
    if (!key) {
      props.target.clearTarget()
    } else {
      const version = props.target.installableInstances.value.find((v) => instanceKey(v) === key)
      if (version) props.target.setTarget(version)
    }
    emit('persist')
  },
})

function renderLabel(option: { label: string; value: string }): VNode {
  return h('span', { class: 'ris-option' }, [
    props.showIcon ? h(UiIcon, { name: 'game-controller', size: 14 }) : null,
    h('span', { class: 'ris-option-label', title: option.label }, option.label),
  ])
}
</script>

<style scoped>
/* 宽度由使用方通过 :deep(.resource-instance-select) 控制，组件不写死固定宽度 */

/* renderLabel 输出的元素不带 scoped 属性，需用 :global 使样式生效 */
:global(.ris-option) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

:global(.ris-option .icon) {
  flex-shrink: 0;
}

:global(.ris-option svg) {
  flex-shrink: 0;
  color: var(--primary);
}

:global(.ris-option-label) {
  min-width: 0;
  white-space: nowrap;
}

/* naive-ui 选项内容默认带省略号截断，实例信息需完整展示，故覆盖为可见 */
:global(.ris-select-menu .n-base-select-option__content) {
  overflow: visible;
  text-overflow: clip;
}
</style>
