<template>
  <div v-if="settingsLoading" class="settings-loading-state">
    <UiLoading mode="inline" size="sm" decorative />
    <span>{{ t('versions.detail.loadingSettings') }}</span>
  </div>
  <template v-else>
    <div class="settings-summary">
      <div class="settings-summary-copy">
        <strong>{{
          isCustomized ? t('versions.detail.customizedSettings') : t('versions.detail.usingGlobalSettings')
        }}</strong>
        <span>{{ t('versions.detail.settings') }} · {{ version?.versionId || '-' }}</span>
      </div>
      <NButton
        size="small"
        secondary
        :disabled="settingsSaving || !isCustomized"
        :loading="settingsSaving"
        @click="resetSettings"
      >
        {{ t('versions.detail.inheritGlobal') }}
      </NButton>
    </div>

    <SettingSection :title="t('versions.detail.launchConfig')">
      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.launchOptions') }}</div>
        <SettingRow :label="t('versions.detail.isolated')" :description="t('versions.detail.isolatedDesc')">
          <NSelect v-model:value="versionSettings.isolationMode" :options="isolationModeOptions" />
        </SettingRow>
      </div>

      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.memoryAllocation') }}</div>
        <SettingRow :label="t('versions.detail.memoryAllocation')" :description="inheritedDescription('memory_auto')">
          <NSelect v-model:value="versionSettings.memoryMode" :options="runtimeModeOptions" />
        </SettingRow>

        <div
          v-if="versionSettings.memoryMode === 'manual'"
          class="memory-manual-section"
          :style="{ '--memory-slider-progress': sliderValuePosition + '%' }"
        >
          <div class="memory-header">
            <div class="memory-header-copy">
              <div class="memory-header-label">{{ t('versions.detail.memorySize') }}</div>
              <div class="memory-header-desc">{{ t('settings.memorySizeDesc') }}</div>
            </div>
            <output class="memory-current-value" :class="{ 'is-over-recommended': isOverRecommended }">
              {{ formatMemory(safeMemorySize) }}
            </output>
          </div>

          <div class="memory-slider-block">
            <input
              v-model.number="safeMemorySize"
              type="range"
              min="1024"
              :max="maxMemory"
              step="256"
              class="memory-slider-input"
              :aria-label="t('versions.detail.memorySize')"
              :aria-valuetext="formatMemory(safeMemorySize)"
            />
            <div class="memory-slider-scale">
              <span>1 GB</span>
              <span>
                {{ formatMemory(maxMemory) }}
                <span class="memory-total-hint">({{ t('settings.systemMemory') }})</span>
              </span>
            </div>
            <div class="memory-recommended-hint">
              {{ t('settings.memoryRecommendedMax') }}: {{ formatMemory(recommendedMaxMemory) }}
              <span v-if="isOverRecommended" class="memory-over-recommended-text">
                — {{ t('settings.memoryOverRecommended') }}
              </span>
            </div>
          </div>

          <div class="memory-bar-wrapper">
            <div class="memory-bar-track">
              <div
                class="memory-bar-segment system-used"
                :style="{ width: memoryBarSegments.systemUsedPct + '%' }"
                :title="t('settings.memoryUsed') + ': ' + formatMemory(systemMemory.usedMb)"
              />
              <div
                class="memory-bar-segment game-allocated"
                :style="{ width: memoryBarSegments.gameAllocatedPct + '%' }"
                :title="t('settings.memoryAllocated') + ': ' + formatMemory(safeMemorySize)"
              />
              <div
                class="memory-bar-segment remaining"
                :style="{ width: memoryBarSegments.remainingPct + '%' }"
                :title="t('settings.memoryRemaining') + ': ' + formatMemory(remainingMemory)"
              />
            </div>
            <div class="memory-bar-legend">
              <span class="legend-item">
                <i class="system-used" />
                {{ t('settings.memoryUsed') }} {{ formatMemory(systemMemory.usedMb) }}
              </span>
              <span class="legend-item">
                <i class="game-allocated" />
                {{ t('settings.memoryAllocated') }} {{ formatMemory(safeMemorySize) }}
              </span>
              <span class="legend-item">
                <i class="remaining" />
                {{ t('settings.memoryRemaining') }} {{ formatMemory(remainingMemory) }}
              </span>
            </div>
          </div>
          <div v-if="systemMemoryError" class="memory-error-hint">无法读取真实内存信息，当前为默认占位值。</div>
        </div>
      </div>

      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.javaRuntime') }}</div>
        <SettingRow :label="t('versions.detail.javaRuntime')" :description="inheritedDescription('java_auto')">
          <NSelect v-model:value="versionSettings.javaMode" :options="runtimeModeOptions" />
        </SettingRow>
        <SettingRow v-if="versionSettings.javaMode === 'manual'" :label="t('settings.javaPath')">
          <JavaRuntimeSelector v-model:value="versionSettings.javaPath" />
        </SettingRow>
      </div>

      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.jvmArgs') }}</div>
        <SettingRow
          :label="t('versions.detail.customJvmArgs')"
          :description="inheritedDescription('jvm_args') + ' · ' + t('versions.detail.customJvmArgsDesc')"
        >
          <NInput
            v-model:value="versionSettings.jvmArgs"
            class="argument-input"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            :placeholder="t('versions.detail.jvmArgsPlaceholder')"
          />
        </SettingRow>
      </div>

      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.gameArgs') }}</div>
        <SettingRow
          :label="t('versions.detail.customGameArgs')"
          :description="inheritedDescription('game_args_tail') + ' · ' + t('versions.detail.customGameArgsDesc')"
        >
          <NInput
            v-model:value="versionSettings.gameArgs"
            class="argument-input"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            :placeholder="t('versions.detail.gameArgsPlaceholder')"
          />
        </SettingRow>
      </div>

      <div class="settings-subgroup">
        <SettingRow
          v-for="field in booleanFields"
          :key="field.key"
          :label="t(field.label)"
          :description="inheritedDescription(field.global)"
        >
          <NSelect
            :value="
              versionSettings[field.key] === null ? 'inherit' : versionSettings[field.key] ? 'enabled' : 'disabled'
            "
            :options="isolationModeOptions"
            @update:value="versionSettings[field.key] = $event === 'inherit' ? null : $event === 'enabled'"
          />
        </SettingRow>
        <SettingRow :label="t('settings.processPriority')" :description="inheritedDescription('process_priority')">
          <NSelect
            :value="versionSettings.processPriority || 'inherit'"
            :options="priorityOptions"
            @update:value="versionSettings.processPriority = $event === 'inherit' ? null : $event"
          />
        </SettingRow>
        <SettingRow
          :label="t('settings.windowSize')"
          :description="inheritedDescription('game_width') + ' × ' + (settingsStore.game.game_height || 480)"
        >
          <div class="instance-window-controls">
            <NInputNumber
              v-model:value="versionSettings.width"
              :min="320"
              :max="16384"
              :placeholder="t('instanceSettings.inherit')"
            />
            <span>×</span>
            <NInputNumber
              v-model:value="versionSettings.height"
              :min="240"
              :max="16384"
              :placeholder="t('instanceSettings.inherit')"
            />
          </div>
        </SettingRow>
        <SettingRow v-if="isWindows" :label="t('settings.renderer')" :description="inheritedDescription('renderer')">
          <NSelect
            :value="versionSettings.renderer || 'inherit'"
            :options="rendererOptions"
            @update:value="versionSettings.renderer = $event === 'inherit' ? null : $event"
          />
        </SettingRow>
      </div>
      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.advancedOptions') }}</div>
        <SettingRow :label="t('settings.preLaunchCommand')" :description="inheritedDescription('pre_launch_command')">
          <div class="instance-command-controls">
            <NSelect
              :value="versionSettings.preLaunchCommand === null ? 'inherit' : 'custom'"
              :options="commandModeOptions"
              @update:value="versionSettings.preLaunchCommand = $event === 'inherit' ? null : ''"
            />
            <NInput
              v-if="versionSettings.preLaunchCommand !== null"
              v-model:value="versionSettings.preLaunchCommand"
              type="textarea"
            />
          </div>
        </SettingRow>
        <SettingRow :label="t('settings.wrapperCommand')" :description="inheritedDescription('wrapper_command')">
          <NSelect
            :value="versionSettings.commandOverrides.includes('wrapperCommand') ? 'custom' : 'inherit'"
            :options="commandModeOptions"
            @update:value="setCommandOverride('wrapperCommand', $event === 'custom')"
          />
          <NInput
            v-model:value="versionSettings.wrapperCommand"
            :disabled="!versionSettings.commandOverrides.includes('wrapperCommand')"
            class="argument-input"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 8 }"
            :placeholder="t('settings.wrapperCommandPlaceholder')"
          />
        </SettingRow>
        <SettingRow :label="t('settings.postExitCommand')" :description="inheritedDescription('post_exit_command')">
          <NSelect
            :value="versionSettings.commandOverrides.includes('postExitCommand') ? 'custom' : 'inherit'"
            :options="commandModeOptions"
            @update:value="setCommandOverride('postExitCommand', $event === 'custom')"
          />
          <NInput
            v-model:value="versionSettings.postExitCommand"
            :disabled="!versionSettings.commandOverrides.includes('postExitCommand')"
            class="argument-input"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 8 }"
            :placeholder="t('settings.postExitCommandPlaceholder')"
          />
        </SettingRow>
        <SettingRow :label="t('settings.envVars')" :description="inheritedDescription('env_vars')">
          <NSelect
            :value="versionSettings.commandOverrides.includes('envVars') ? 'custom' : 'inherit'"
            :options="commandModeOptions"
            @update:value="setCommandOverride('envVars', $event === 'custom')"
          />
          <NInput
            v-model:value="versionSettings.envVars"
            :disabled="!versionSettings.commandOverrides.includes('envVars')"
            class="argument-input"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 8 }"
            :placeholder="t('settings.envVarsPlaceholder')"
          />
        </SettingRow>
        <SettingRow :label="t('settings.windowTitle')" :description="inheritedDescription('window_title_template')">
          <NSelect
            :value="versionSettings.commandOverrides.includes('windowTitle') ? 'custom' : 'inherit'"
            :options="commandModeOptions"
            @update:value="setCommandOverride('windowTitle', $event === 'custom')"
          />
          <NInput
            v-model:value="versionSettings.windowTitle"
            :disabled="!versionSettings.commandOverrides.includes('windowTitle')"
          />
        </SettingRow>
        <SettingRow
          :label="t('settings.launcherVisibility')"
          :description="inheritedDescription('launcher_visibility')"
        >
          <NSelect v-model:value="versionSettings.launcherVisibility" :options="visibilityOptions" />
        </SettingRow>
      </div>
    </SettingSection>
    <SettingSection v-if="isWindows" :title="t('advanced.shortcutTitle')">
      <SettingRow :label="t('advanced.shortcutTitle')" :description="t('advanced.shortcutHint')">
        <div class="instance-window-controls">
          <NButton :loading="shortcutCreating" :disabled="shortcutCreating" @click="createShortcut(false)">{{
            t('advanced.shortcutDesktop')
          }}</NButton>
          <NButton :disabled="shortcutCreating" @click="createShortcut(true)">{{
            t('advanced.shortcutChoose')
          }}</NButton>
        </div>
      </SettingRow>
    </SettingSection>
  </template>
</template>

<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import UiLoading from '@/components/ui/Loading.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceSettingsApi } from '@/features/instances/api/instanceSettingsApi'
import { settingsSaveSession } from '@/features/instances/model/instanceSaveSession'
import {
  createDefaultVersionSettings,
  normalizeVersionSettings,
  type VersionSettingsTarget,
  type VersionLaunchSettings,
} from '@/features/instances/model/instanceSettings'
import { settingsApi } from '@/features/settings/api/settingsApi'
import JavaRuntimeSelector from '@/features/settings/components/JavaRuntimeSelector.vue'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import SettingSection from '@/features/settings/components/SettingSection.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { SystemMemoryInfo } from '@/types/config'
import type { ScannedVersion } from '@/types/instances'
import { gamePathIdentity } from '@/utils/path'
defineOptions({ name: 'InstanceDetailSettingsTab' })

const props = defineProps<{
  version: ScannedVersion | null
  visible: boolean
}>()

const { t } = useI18n()
const message = useLauncherMessage()

const shortcutCreating = ref(false)
async function createShortcut(chooseLocation: boolean) {
  if (!props.version) return
  const target = { game_path: props.version.path, version_id: props.version.versionId }
  shortcutCreating.value = true
  try {
    let outputPath: string | undefined
    if (chooseLocation) {
      const selected = unwrapResponse(
        await backend.command('select_save_file', {
          purpose: 'instance-shortcut',
          default_name: `${props.version.alias || props.version.versionId}.lnk`.replace(/[<>:"/\\|?*]/g, '_'),
        }),
        t('advanced.shortcutTitle')
      )
      if (!selected.path) return
      outputPath = selected.path
    }
    unwrapResponse(
      await backend.command('game_instance_shortcut_create', { ...target, output_path: outputPath }),
      t('advanced.shortcutTitle')
    )
    message.success(t('advanced.shortcutCreated'))
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : String(cause))
  } finally {
    shortcutCreating.value = false
  }
}

const visibilityOptions = [
  { value: 'inherit', label: t('settings.visibilityOptions.inherit') },
  { value: 'none', label: t('settings.visibilityOptions.none') },
  { value: 'minimize', label: t('settings.visibilityOptions.minimize') },
  { value: 'quit', label: t('settings.visibilityOptions.quit') },
]

const isolationModeOptions = [
  { value: 'inherit', label: t('versions.detail.isolationModes.inherit') },
  { value: 'enabled', label: t('versions.detail.isolationModes.enabled') },
  { value: 'disabled', label: t('versions.detail.isolationModes.disabled') },
]

const settingsStore = useSettingsStore()
const isWindows = window.navigator.userAgent.toLowerCase().includes('windows')
const runtimeModeOptions = computed(() =>
  ['inherit', 'auto', 'manual'].map((value) => ({ value, label: t(`instanceSettings.${value}`) }))
)
const commandModeOptions = computed(() =>
  ['inherit', 'custom'].map((value) => ({ value, label: t(`instanceSettings.${value}`) }))
)
const priorityOptions = computed(() => [
  { value: 'inherit', label: t('instanceSettings.inherit') },
  ...['idle', 'below_normal', 'normal', 'above_normal', 'high'].map((value) => ({
    value,
    label: t(`settings.processPriorityOptions.${value}`),
  })),
])
const rendererOptions = computed(() => [
  { value: 'inherit', label: t('instanceSettings.inherit') },
  ...['default', 'software', 'directx12', 'vulkan'].map((value) => ({
    value,
    label: t(`settings.rendererOptions.${value}`),
  })),
])
const booleanFields = computed(() => [
  { key: 'lockMemory' as const, global: 'lock_memory' as const, label: 'settings.lockMemory' },
  { key: 'fullscreen' as const, global: 'fullscreen' as const, label: 'settings.fullscreen' },
  {
    key: 'disableCrashAnalysis' as const,
    global: 'disable_crash_analysis' as const,
    label: 'settings.disableCrashAnalysis',
  },
  ...(isWindows
    ? [
        {
          key: 'preferHighPerformanceGpu' as const,
          global: 'prefer_high_performance_gpu' as const,
          label: 'settings.preferHighPerformanceGpu',
        },
        { key: 'useJavaExe' as const, global: 'use_java_exe' as const, label: 'settings.useJavaExe' },
      ]
    : []),
])
function inheritedDescription(key: keyof typeof settingsStore.game) {
  let value: string
  if (key === 'java_auto')
    value = settingsStore.game.java_auto ? t('instanceSettings.auto') : settingsStore.game.java_path || '-'
  else if (key === 'memory_auto')
    value = settingsStore.game.memory_auto
      ? t('instanceSettings.auto')
      : formatMemory(settingsStore.game.memory_size ?? 4096)
  else if (typeof settingsStore.game[key] === 'boolean')
    value = t(
      settingsStore.game[key] ? 'versions.detail.isolationModes.enabled' : 'versions.detail.isolationModes.disabled'
    )
  else value = String(settingsStore.game[key] || t('instanceSettings.empty'))
  return t('instanceSettings.effectiveGlobal', { value })
}
function setCommandOverride(key: VersionLaunchSettings['commandOverrides'][number], enabled: boolean) {
  versionSettings.commandOverrides = enabled
    ? [...new Set([...versionSettings.commandOverrides, key])]
    : versionSettings.commandOverrides.filter((item) => item !== key)
}
const versionSettings = reactive(createDefaultVersionSettings())
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const systemMemory = ref<SystemMemoryInfo>({ totalMb: 16384, usedMb: 4096, freeMb: 12288, percentUsed: 25 })
const systemMemoryError = ref(false)

const MEMORY_MIN = 1024
const maxMemory = computed(() => Math.min(65536, Math.max(systemMemory.value.totalMb, 2048)))
const recommendedMaxMemory = computed(() => Math.max(Math.floor(systemMemory.value.totalMb * 0.8), 2048))
const clampVersionMemory = (value: number) => Math.min(Math.max(value, MEMORY_MIN), maxMemory.value)
const safeMemorySize = computed({
  // get 只保下限、不缩上限，避免存量分配值超过滑块范围时被锁死而无法调整
  get: () => Math.max(versionSettings.memory, MEMORY_MIN),
  set: (value: number) => {
    versionSettings.memory = clampVersionMemory(value)
  },
})
const isOverRecommended = computed(() => versionSettings.memory > recommendedMaxMemory.value)
const sliderValuePosition = computed(() => {
  const range = maxMemory.value - MEMORY_MIN
  if (range <= 0) return 0
  return Math.min(Math.max(((versionSettings.memory - MEMORY_MIN) / range) * 100, 0), 100)
})
const remainingMemory = computed(() =>
  Math.max(0, systemMemory.value.totalMb - systemMemory.value.usedMb - safeMemorySize.value)
)
const memoryBarSegments = computed(() => {
  const total = systemMemory.value.totalMb || 1
  const usedPct = (systemMemory.value.usedMb / total) * 100
  const allocatedPct = (safeMemorySize.value / total) * 100
  const remainingPct = Math.max(0, 100 - usedPct - allocatedPct)
  if (usedPct + allocatedPct <= 100) {
    return {
      systemUsedPct: Math.round(usedPct),
      gameAllocatedPct: Math.round(allocatedPct),
      remainingPct: Math.round(remainingPct),
    }
  }
  const scale = 100 / (usedPct + allocatedPct)
  return {
    systemUsedPct: Math.round(usedPct * scale),
    gameAllocatedPct: Math.round(allocatedPct * scale),
    remainingPct: 0,
  }
})
const formatMemory = (mb: number): string => {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
  return mb + ' MB'
}

const savedSettingsSnapshot = ref(JSON.stringify(createDefaultVersionSettings()))
const settingsDirty = computed(() => JSON.stringify(versionSettings) !== savedSettingsSnapshot.value)
const isCustomized = computed(() => JSON.stringify(versionSettings) !== JSON.stringify(createDefaultVersionSettings()))

/** 加载/重置阶段跳过自动保存 watch */
let skipSettingsWatch = false
/** 300ms 防抖定时器（参考 GameTab.vue 的 debouncedSaveConfig） */
let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null
/** 保存串行化：保存中再有新变更则排队重存，避免 API 读-改-写竞态 */
let saveChain: Promise<void> = Promise.resolve()
let loadedSettingsTarget: VersionSettingsTarget | null = null

function getSettingsTarget(): VersionSettingsTarget | null {
  if (!props.version) return null
  return {
    versionId: props.version.versionId || props.version.id,
    path: props.version.path || props.version.jsonPath || '',
  }
}

// 请求序号守卫：快速切换实例时丢弃晚到的旧设置响应，防止把 A 实例的设置写进 B
let settingsRequestId = 0

async function loadSettings() {
  const target = getSettingsTarget()
  if (!target) return
  const requestId = ++settingsRequestId
  skipSettingsWatch = true
  const defaults = createDefaultVersionSettings()
  loadedSettingsTarget = null
  for (const key of Object.keys(versionSettings)) delete (versionSettings as unknown as Record<string, unknown>)[key]
  Object.assign(versionSettings, defaults)
  savedSettingsSnapshot.value = JSON.stringify(defaults)
  settingsLoading.value = true
  try {
    const settings = await instanceSettingsApi.get(target)
    if (requestId !== settingsRequestId) return
    // 归一化补齐缺失字段后再存快照，保证脏检查的键集与响应对象一致
    Object.assign(versionSettings, normalizeVersionSettings(settings))
    loadedSettingsTarget = target
    savedSettingsSnapshot.value = JSON.stringify(versionSettings)
    const pendingDraft = settingsSaveSession.draft(`${gamePathIdentity(target.path)}\0${target.versionId}`)
    if (pendingDraft) Object.assign(versionSettings, pendingDraft)
  } catch (error) {
    if (requestId === settingsRequestId) {
      message.error(error instanceof Error ? error.message : t('versions.detail.loadSettingsFailed'))
    }
  } finally {
    if (requestId === settingsRequestId) {
      settingsLoading.value = false
      await nextTick()
      skipSettingsWatch = false
    }
  }
}

function validateSettings(): string | null {
  if (versionSettings.memoryMode === 'manual' && (versionSettings.memory < 512 || versionSettings.memory > 65536)) {
    return t('versions.detail.invalidMemory')
  }
  if (versionSettings.javaMode === 'manual' && !versionSettings.javaPath.trim()) {
    return t('versions.detail.javaPathRequired')
  }
  return null
}

async function persistSettings() {
  const target = loadedSettingsTarget
  if (!target) return
  const invalid = validateSettings()
  if (invalid) {
    message.warning(invalid)
    return
  }
  const snapshot = JSON.stringify(versionSettings)
  settingsSaving.value = true
  const queued = settingsSaveSession.enqueue(
    `${gamePathIdentity(target.path)}\0${target.versionId}`,
    JSON.parse(snapshot) as VersionLaunchSettings,
    (submitted) => instanceSettingsApi.save(target, submitted)
  )
  saveChain = queued
  try {
    await queued
    if (loadedSettingsTarget?.versionId === target.versionId && loadedSettingsTarget?.path === target.path)
      savedSettingsSnapshot.value = snapshot
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.saveSettingsFailed'))
  } finally {
    if (saveChain === queued) settingsSaving.value = false
  }
}

/** 修改即自动保存：300ms 防抖（参考 GameTab.vue） */
function scheduleSettingsSave(delay = 300) {
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
  settingsSaveTimer = setTimeout(() => {
    settingsSaveTimer = null
    void persistSettings()
  }, delay)
}

/** 关闭弹窗时立即落盘（flush），丢弃未决定时器 */
function flushSettingsSave() {
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer)
    settingsSaveTimer = null
  }
  if (settingsDirty.value) void persistSettings()
}

// 打开时加载；关闭时 flush 挂起中的自动保存（复刻原父组件行为）
watch(
  () => [props.visible, props.version?.path, props.version?.versionId] as const,
  ([visible]) => {
    flushSettingsSave()
    if (visible) {
      void loadSettings()
      void loadRuntimeInfo()
    } else settingsRequestId += 1
  },
  { immediate: true }
)

// deep watch：用户修改自动触发保存；加载/重置阶段用 skipSettingsWatch 跳过
watch(
  versionSettings,
  () => {
    if (skipSettingsWatch) return
    scheduleSettingsSave()
  },
  { deep: true }
)

async function resetSettings() {
  const target = loadedSettingsTarget
  if (!target) return
  if (settingsSaveTimer) {
    clearTimeout(settingsSaveTimer)
    settingsSaveTimer = null
  }
  settingsSaving.value = true
  const defaults = createDefaultVersionSettings()
  const beforeReset = JSON.stringify(versionSettings)
  const queued = settingsSaveSession.enqueue(`${gamePathIdentity(target.path)}\0${target.versionId}`, defaults, () =>
    instanceSettingsApi.reset(target)
  )
  saveChain = queued
  try {
    await queued
    if (loadedSettingsTarget?.versionId !== target.versionId || loadedSettingsTarget?.path !== target.path) return
    skipSettingsWatch = true
    if (JSON.stringify(versionSettings) === beforeReset) Object.assign(versionSettings, defaults)
    savedSettingsSnapshot.value = JSON.stringify(defaults)
    message.success(t('versions.detail.settingsReset'))
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.saveSettingsFailed'))
  } finally {
    if (saveChain === queued) settingsSaving.value = false
    await nextTick()
    skipSettingsWatch = false
  }
}

async function loadRuntimeInfo() {
  await settingsStore.load().catch((error) => message.error(error instanceof Error ? error.message : String(error)))
  try {
    const mem = await settingsApi.getSystemMemory()
    if (mem && typeof mem.totalMb === 'number') systemMemory.value = mem
  } catch {
    systemMemoryError.value = true
  }
}

// 切换到其他 tab / 组件卸载时，同样 flush 挂起中的自动保存
onBeforeUnmount(() => {
  settingsRequestId += 1
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
  if (settingsDirty.value) void persistSettings()
})
</script>

<style scoped src="@/styles/views/instances/InstanceDetailModal.css"></style>

<style scoped>
.instance-window-controls {
  display: flex;
  gap: 8px;
}
:deep(.argument-input) {
  min-width: 260px;
}
:deep(.setting-control:has(.argument-input)) {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  width: min(600px, 60%);
}
.instance-command-controls {
  display: grid;
  gap: 8px;
  width: 100%;
}
</style>
