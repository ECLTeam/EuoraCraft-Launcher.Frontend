<template>
  <Modal
    :visible="visible"
    type="content"
    :title="t('settings.aboutTab.debugInfo.title')"
    icon="info"
    width="min(560px, calc(100vw - 32px))"
    wrapperClass="debug-info-modal-container"
    titlebarInteractive
    :priority="60"
    @update:visible="emit('update:visible', $event)"
    @close="emit('close')"
  >
    <div class="debug-info-modal">
      <div class="debug-info-modal__identity">
        <img src="/favicon.ico" alt="EuoraCraft" class="debug-info-modal__logo" />
        <div class="debug-info-modal__identity-text">
          <strong class="debug-info-modal__name">EuoraCraft Launcher</strong>
          <span class="debug-info-modal__version">{{ versionText }}</span>
        </div>
        <span v-if="debugEnabled" class="debug-info-modal__badge">DEBUG</span>
      </div>

      <section class="debug-info-modal__section">
        <h4 class="debug-info-modal__section-title">
          <UiIcon name="cpu" :size="15" />
          <span>{{ t('settings.aboutTab.debugInfo.sections.system') }}</span>
        </h4>
        <dl class="debug-info-modal__fields">
          <div v-for="field in systemFields" :key="field.label" class="debug-info-modal__field">
            <dt>{{ field.label }}</dt>
            <dd>{{ field.value }}</dd>
          </div>
        </dl>
      </section>

      <section class="debug-info-modal__section">
        <h4 class="debug-info-modal__section-title">
          <UiIcon name="terminal-2" :size="15" />
          <span>{{ t('settings.aboutTab.debugInfo.sections.launcher') }}</span>
        </h4>
        <dl class="debug-info-modal__fields">
          <div v-for="field in launcherFields" :key="field.label" class="debug-info-modal__field">
            <dt>{{ field.label }}</dt>
            <dd>{{ field.value }}</dd>
          </div>
        </dl>
      </section>

      <p class="debug-info-modal__hint">
        <UiIcon name="info" :size="15" />
        <span>{{ t('settings.aboutTab.debugInfo.footerHint') }}</span>
      </p>
    </div>

    <template #footer>
      <NButton @click="close">{{ t('common.close') }}</NButton>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, inject, isRef, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppRuntimeMode } from '@/app/runtime/mode'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { aboutApi } from '@/features/settings/api/aboutApi'
import type { LauncherInfo } from '@/types/system'

defineOptions({ name: 'DebugInfoModal' })

const props = defineProps<{ visible: boolean; debugEnabled: boolean }>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

/** 后端未提供或浏览器模式下的占位值 */
const unknownValue = '—'
const { t } = useI18n()

const launcherVersion = inject<Readonly<Ref<string>>>('launcherVersion')
const launcherVersionType = inject<Readonly<Ref<'alpha' | 'beta' | 'rc' | 'release'>>>('launcherVersionType')
// 根组件注入的是只读 ref，测试与局部渲染可能直接传入字符串，两种形态都要兼容
const injectedRuntimeMode = inject<Readonly<Ref<AppRuntimeMode>> | AppRuntimeMode>('runtimeMode', 'browser')
const runtimeMode = computed<AppRuntimeMode>(() =>
  isRef(injectedRuntimeMode) ? injectedRuntimeMode.value : injectedRuntimeMode
)
const frontendVersion = import.meta.env.VITE_APP_VERSION?.trim() || ''

const launcherInfo = ref<LauncherInfo | null>(null)

/**
 * 每次打开都重新读取后端信息，保证内存与版本等运行状态不是启动时的旧快照。
 * 读取失败时保留占位值，弹窗仍需展示前端已知的版本与运行形态。
 */
async function loadLauncherInfo(): Promise<void> {
  try {
    launcherInfo.value = await aboutApi.getLauncherInfo()
  } catch {
    launcherInfo.value = null
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void loadLauncherInfo()
  },
  { immediate: true }
)

function close(): void {
  emit('update:visible', false)
  emit('close')
}

interface InfoField {
  label: string
  value: string
}

const version = computed(() => launcherInfo.value?.version || launcherVersion?.value || frontendVersion)
const versionType = computed(() => launcherInfo.value?.version_type || launcherVersionType?.value || 'release')
const versionText = computed(() => (version.value ? `v${version.value}` : unknownValue))

const versionTypeLabel = computed(() => {
  const type = versionType.value
  const knownTypes = ['alpha', 'beta', 'rc', 'release']
  if (!knownTypes.includes(type)) return type || unknownValue
  return t(`settings.aboutTab.version.types.${type}`)
})

/** 版本号中的 ``+YYYYMMDD`` 后缀是构建日期，缺失时不做推测 */
const buildDateText = computed(() => {
  const matched = /\+(?<date>\d{8})$/.exec(version.value)
  const raw = matched?.groups?.date
  if (!raw) return unknownValue
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
})

const runtimeModeLabel = computed(() => {
  if (runtimeMode.value === 'desktop') {
    return import.meta.env.DEV
      ? t('settings.aboutTab.debugInfo.runtimeModes.desktopDev')
      : t('settings.aboutTab.debugInfo.runtimeModes.desktop')
  }
  if (runtimeMode.value === 'showcase') return t('settings.aboutTab.debugInfo.runtimeModes.showcase')
  return t('settings.aboutTab.debugInfo.runtimeModes.browser')
})

const windowChromeLabel = computed(() => {
  const chrome = launcherInfo.value?.active_window_chrome
  if (!chrome) return unknownValue
  return t(`settings.aboutTab.debugInfo.windowChromes.${chrome}`)
})

const memoryText = computed(() => {
  const totalMb = launcherInfo.value?.system?.memory_total_mb
  if (!totalMb || totalMb <= 0) return unknownValue
  const totalGb = totalMb / 1024
  return totalGb >= 10 ? `${totalGb.toFixed(1)} GB` : `${totalGb.toFixed(2)} GB`
})

const systemFields = computed<InfoField[]>(() => {
  const system = launcherInfo.value?.system
  return [
    { label: t('settings.aboutTab.debugInfo.fields.os'), value: system?.os_name || unknownValue },
    { label: t('settings.aboutTab.debugInfo.fields.osVersion'), value: system?.os_version || unknownValue },
    { label: t('settings.aboutTab.debugInfo.fields.architecture'), value: system?.architecture || unknownValue },
    { label: t('settings.aboutTab.debugInfo.fields.memory'), value: memoryText.value },
    { label: t('settings.aboutTab.debugInfo.fields.pythonVersion'), value: system?.python_version || unknownValue },
  ]
})

const launcherFields = computed<InfoField[]>(() => [
  { label: t('settings.aboutTab.debugInfo.fields.version'), value: versionText.value },
  { label: t('settings.aboutTab.debugInfo.fields.versionType'), value: versionTypeLabel.value },
  { label: t('settings.aboutTab.debugInfo.fields.buildDate'), value: buildDateText.value },
  { label: t('settings.aboutTab.debugInfo.fields.runtime'), value: runtimeModeLabel.value },
  { label: t('settings.aboutTab.debugInfo.fields.frontendVersion'), value: frontendVersion || unknownValue },
  { label: t('settings.aboutTab.debugInfo.fields.windowChrome'), value: windowChromeLabel.value },
  {
    label: t('settings.aboutTab.debugInfo.fields.debugMode'),
    value: props.debugEnabled ? t('settings.aboutTab.debugInfo.enabled') : t('settings.aboutTab.debugInfo.disabled'),
  },
])
</script>

<style src="@/styles/views/settings/DebugInfoModal.css"></style>
