<template>
  <div class="tab-pane game-settings">
    <SettingSection :title="t('settings.javaSettings')">
      <SettingRow :label="t('settings.javaAuto')" :description="javaAutoDesc">
        <NSwitch :value="localSettings.java_auto" @update:value="handleJavaAutoToggle" />
      </SettingRow>

      <SettingRow
        v-if="!localSettings.java_auto"
        :label="t('settings.javaPath')"
        :description="t('settings.javaPathDesc')"
      >
        <JavaRuntimeSelector :value="localSettings.java_path" @update:value="handleJavaPathChange" />
      </SettingRow>
    </SettingSection>

    <SettingSection :title="t('settings.memory')">
      <SettingRow :label="t('settings.memoryAuto')" :description="memoryAutoDesc">
        <NSwitch :value="localSettings.memory_auto" @update:value="handleMemoryAutoToggle" />
      </SettingRow>

      <div
        class="memory-manual-section"
        :class="{ 'is-auto': localSettings.memory_auto }"
        :style="{ '--memory-slider-progress': localSettings.memory_auto ? '0%' : sliderValuePosition + '%' }"
      >
        <div class="memory-header">
          <div class="memory-header-copy">
            <div class="memory-header-label">
              {{ t('settings.memorySize') }}
              <span v-if="localSettings.memory_auto" class="auto-badge">{{ t('settings.memoryAuto') }}</span>
            </div>
            <div class="memory-header-desc">
              {{ t('settings.memorySizeDesc') }}
            </div>
          </div>
          <output
            class="memory-current-value"
            :class="{ 'is-auto': localSettings.memory_auto, 'is-over-recommended': isOverRecommended }"
          >
            {{ formatMemory(safeMemorySize) }}
          </output>
        </div>

        <div class="memory-slider-block">
          <input
            v-model.number="safeMemorySize"
            type="range"
            :disabled="localSettings.memory_auto"
            min="1024"
            :max="maxMemory"
            step="256"
            class="memory-slider-input"
            :aria-label="t('settings.memorySize')"
            :aria-valuetext="formatMemory(safeMemorySize)"
            @input="debouncedSaveConfig()"
          />
          <div class="memory-slider-scale">
            <span>1 GB</span>
            <span>
              {{ formatMemory(maxMemory) }}
              <span class="memory-total-hint">({{ t('settings.systemMemory') }})</span>
            </span>
          </div>
          <div v-if="!localSettings.memory_auto" class="memory-recommended-hint">
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
          <div v-if="systemMemoryError" class="memory-error-hint">
            无法读取真实内存信息，当前为默认占位值。请重启后端或检查控制台日志。
          </div>
        </div>
      </div>

      <SettingRow :label="t('settings.processPriority')" :description="t('settings.processPriorityDesc')">
        <NSelect
          :value="localSettings.process_priority || 'normal'"
          :options="priorityOptions"
          class="process-priority-select"
          @update:value="handlePriorityChange"
        />
      </SettingRow>
    </SettingSection>

    <SettingSection :title="t('settings.runtime')">
      <SettingRow
        :label="t('settings.instanceIsolationPolicy')"
        :description="t('settings.instanceIsolationPolicyDesc')"
      >
        <NSelect
          :value="localSettings.instance_isolation_policy || 'all'"
          :options="isolationPolicyOptions"
          class="process-priority-select"
          @update:value="handleIsolationPolicyChange"
        />
      </SettingRow>

      <SettingRow :label="t('settings.fullscreen')" :description="t('settings.fullscreenDesc')">
        <NSwitch :value="localSettings.fullscreen" @update:value="handleFullscreenToggle" />
      </SettingRow>

      <SettingRow
        v-if="!localSettings.fullscreen"
        :label="t('settings.windowSize')"
        :description="t('settings.windowSizeDesc')"
      >
        <div class="window-size-inputs">
          <NInputNumber
            :value="localSettings.game_width"
            :min="320"
            :max="16384"
            :showButton="false"
            class="window-size-input"
            :placeholder="t('settings.windowWidth')"
            @update:value="handleWidthChange"
          />
          <span class="window-size-separator">×</span>
          <NInputNumber
            :value="localSettings.game_height"
            :min="240"
            :max="16384"
            :showButton="false"
            class="window-size-input"
            :placeholder="t('settings.windowHeight')"
            @update:value="handleHeightChange"
          />
        </div>
      </SettingRow>
    </SettingSection>

    <SettingSection :title="t('settings.launchAdvanced')">
      <SettingRow :label="t('settings.jvmArgs')" :description="t('settings.jvmArgsDesc')">
        <NInput
          v-model:value="globalJvmArgsText"
          class="advanced-argument-input"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          :placeholder="t('settings.jvmArgsPlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow :label="t('settings.gameArgsTail')" :description="t('settings.gameArgsTailDesc')">
        <NInput
          v-model:value="localSettings.game_args_tail"
          class="advanced-argument-input"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          :placeholder="t('settings.gameArgsTailPlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow v-if="isWindows" :label="t('settings.renderer')" :description="t('settings.rendererDesc')">
        <NSelect
          :value="localSettings.renderer || 'default'"
          :options="rendererOptions"
          class="process-priority-select"
          @update:value="handleRendererChange"
        />
      </SettingRow>

      <SettingRow :label="t('settings.preLaunchCommand')" :description="t('settings.preLaunchCommandDesc')">
        <NInput
          v-model:value="localSettings.pre_launch_command"
          class="advanced-argument-input"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :placeholder="t('settings.preLaunchCommandPlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow :label="t('settings.wrapperCommand')" :description="t('settings.wrapperCommandDesc')">
        <NInput
          v-model:value="localSettings.wrapper_command"
          class="advanced-argument-input"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :placeholder="t('settings.wrapperCommandPlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow :label="t('settings.postExitCommand')" :description="t('settings.postExitCommandDesc')">
        <NInput
          v-model:value="localSettings.post_exit_command"
          class="advanced-argument-input"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :placeholder="t('settings.postExitCommandPlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow :label="t('settings.envVars')" :description="t('settings.envVarsDesc')">
        <NInput
          v-model:value="localSettings.env_vars"
          class="advanced-argument-input"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          :placeholder="t('settings.envVarsPlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow :label="t('settings.windowTitle')" :description="t('settings.windowTitleDesc')">
        <NInput
          v-model:value="localSettings.window_title_template"
          :placeholder="t('settings.windowTitlePlaceholder')"
          @blur="saveConfig"
        />
      </SettingRow>

      <SettingRow :label="t('settings.launcherVisibility')" :description="t('settings.launcherVisibilityDesc')">
        <NSelect
          :value="localSettings.launcher_visibility || 'none'"
          :options="launcherVisibilityOptions"
          class="process-priority-select"
          @update:value="handleLauncherVisibilityChange"
        />
      </SettingRow>

      <SettingRow
        :label="t('settings.preferHighPerformanceGpu')"
        :description="t('settings.preferHighPerformanceGpuDesc')"
      >
        <NSwitch :value="localSettings.prefer_high_performance_gpu" @update:value="handleGpuPreferenceToggle" />
      </SettingRow>

      <SettingRow :label="t('settings.useJavaExe')" :description="t('settings.useJavaExeDesc')">
        <NSwitch :value="localSettings.use_java_exe" @update:value="handleUseJavaExeToggle" />
      </SettingRow>

      <SettingRow :label="t('settings.disableCrashAnalysis')" :description="t('settings.disableCrashAnalysisDesc')">
        <NSwitch :value="localSettings.disable_crash_analysis" @update:value="handleDisableCrashAnalysisToggle" />
      </SettingRow>

      <SettingRow :label="t('settings.lockMemory')" :description="t('settings.lockMemoryDesc')">
        <NSwitch :value="localSettings.lock_memory" @update:value="handleLockMemoryToggle" />
      </SettingRow>
    </SettingSection>

    <PluginSlotHost slotId="plugin-slot-settings-game-section-after" class="plugin-slot-container" />
  </div>
</template>

<script setup lang="ts">
import { NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { parseLaunchArguments } from '@/features/instances/model/instanceSettings'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { settingsApi } from '@/features/settings/api/settingsApi'
import JavaRuntimeSelector from '@/features/settings/components/JavaRuntimeSelector.vue'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import SettingSection from '@/features/settings/components/SettingSection.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { GameRenderer, InstanceIsolationPolicy, SystemMemoryInfo } from '@/types/config'
const { t } = useI18n()
const { run } = useAsyncAction({ showSuccess: false, showError: true, errorMessage: t('common.error') })
const settingsStore = useSettingsStore()
const { game: localSettings } = storeToRefs(settingsStore)
const isWindows = window.navigator.userAgent.toLowerCase().includes('windows')

const systemMemory = ref<SystemMemoryInfo>({
  totalMb: 16384,
  usedMb: 4096,
  freeMb: 12288,
  percentUsed: 25,
})

const systemMemoryError = ref(false)

const javaAutoDesc = computed(() => {
  return localSettings.value.java_auto ? t('settings.javaSelectionAutoDesc') : t('settings.javaSelectionManualDesc')
})

const memoryAutoDesc = computed(() => {
  return localSettings.value.memory_auto
    ? t('settings.memoryAllocationAutoDesc')
    : t('settings.memoryAllocationManualDesc')
})

const maxMemory = computed(() => {
  return Math.min(65536, Math.max(systemMemory.value.totalMb, 2048))
})

const recommendedMaxMemory = computed(() => {
  const maxAlloc = Math.floor(systemMemory.value.totalMb * 0.8)
  return Math.max(maxAlloc, 2048)
})

const isOverRecommended = computed(() => {
  return safeMemorySize.value > recommendedMaxMemory.value
})

const autoMemorySize = computed(() => {
  const step = 256
  const raw = Math.round((systemMemory.value.totalMb * 0.25) / step) * step
  return Math.min(Math.max(raw, 2048), 8192)
})

const clampMemorySize = (value: number): number => {
  const min = 1024
  return Math.min(Math.max(value, min), maxMemory.value)
}

const sliderValuePosition = computed(() => {
  const min = 1024
  const max = maxMemory.value
  const range = max - min
  if (range <= 0) return 0
  const percent = ((safeMemorySize.value - min) / range) * 100
  return Math.min(Math.max(percent, 0), 100)
})

const safeMemorySize = computed({
  // get 只保下限、不缩上限，避免存量分配值超过滑块范围时被锁死而无法调整
  get: () => Math.max(localSettings.value.memory_size ?? 1024, 1024),
  set: (value: number) => {
    localSettings.value.memory_size = clampMemorySize(value)
  },
})

const remainingMemory = computed(() => {
  return Math.max(0, systemMemory.value.totalMb - systemMemory.value.usedMb - safeMemorySize.value)
})

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
  // 分配值超过当前可用空间时按比例归一化，避免进度条溢出容器
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

const PROCESS_PRIORITIES = ['idle', 'below_normal', 'normal', 'above_normal', 'high'] as const
type ProcessPriority = (typeof PROCESS_PRIORITIES)[number]

const priorityOptions = PROCESS_PRIORITIES.map((value) => ({
  value,
  label: t(`settings.processPriorityOptions.${value}`),
}))

const ISOLATION_POLICIES = ['disabled', 'modded_only', 'non_release_only', 'modded_or_non_release', 'all'] as const
const isolationPolicyOptions = ISOLATION_POLICIES.map((value) => ({
  value,
  label: t(`settings.instanceIsolationPolicyOptions.${value}`),
}))

const RENDERERS: GameRenderer[] = ['default', 'software', 'directx12', 'vulkan']
const rendererOptions = RENDERERS.map((value) => ({
  value,
  label: t(`settings.rendererOptions.${value}`),
}))

const launcherVisibilityOptions = [
  { value: 'none', label: t('settings.visibilityOptions.none') },
  { value: 'minimize', label: t('settings.visibilityOptions.minimize') },
  { value: 'quit', label: t('settings.visibilityOptions.quit') },
]

const formatLaunchArgument = (value: string): string => {
  if (!/[\s"']/.test(value)) return value
  return JSON.stringify(value)
}

const globalJvmArgsText = computed({
  get: () => (localSettings.value.jvm_args || []).map(formatLaunchArgument).join(' '),
  set: (value: string) => {
    localSettings.value.jvm_args = parseLaunchArguments(value)
  },
})

const loadGameConfig = async () => {
  await run(async () => settingsStore.load())
}

const loadSystemMemory = async () => {
  systemMemoryError.value = false
  const result = await run(async () => settingsApi.getSystemMemory())
  if (!result) {
    systemMemoryError.value = true
    console.error('[GameTab] 读取系统内存失败，将使用默认占位数据')
    return
  }
  systemMemory.value = result
  if (localSettings.value.memory_auto) {
    localSettings.value.memory_size = autoMemorySize.value
    saveConfig()
  } else if ((localSettings.value.memory_size ?? 1024) > maxMemory.value) {
    localSettings.value.memory_size = maxMemory.value
    saveConfig()
  }
}

const saveConfig = async () => {
  const config = {
    java_auto: localSettings.value.java_auto,
    java_path: localSettings.value.java_path,
    memory_auto: localSettings.value.memory_auto,
    memory_size: localSettings.value.memory_size,
    lock_memory: localSettings.value.lock_memory,
    process_priority: localSettings.value.process_priority || 'normal',
    game_width: localSettings.value.game_width,
    game_height: localSettings.value.game_height,
    jvm_args: localSettings.value.jvm_args || [],
    renderer: localSettings.value.renderer || 'default',
    fullscreen: localSettings.value.fullscreen,
    instance_isolation_policy: localSettings.value.instance_isolation_policy || 'all',
    game_args_tail: localSettings.value.game_args_tail || '',
    pre_launch_command: localSettings.value.pre_launch_command || '',
    wrapper_command: localSettings.value.wrapper_command || '',
    post_exit_command: localSettings.value.post_exit_command || '',
    env_vars: localSettings.value.env_vars || '',
    window_title_template: localSettings.value.window_title_template || '',
    launcher_visibility: localSettings.value.launcher_visibility || 'none',
    prefer_high_performance_gpu: localSettings.value.prefer_high_performance_gpu === true,
    use_java_exe: localSettings.value.use_java_exe === true,
    disable_crash_analysis: localSettings.value.disable_crash_analysis === true,
  }
  await run(async () => settingsStore.patchGame(config))
}

/** 防抖保存：拖动滑块时延迟保存，避免高频请求 */
let saveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSaveConfig(delay = 300) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveConfig()
  }, delay)
}

const handleJavaAutoToggle = (value: boolean) => {
  localSettings.value.java_auto = value
  if (value) {
    localSettings.value.java_path = ''
  }
  saveConfig()
}

const handleMemoryAutoToggle = (value: boolean) => {
  localSettings.value.memory_auto = value
  if (value) {
    localSettings.value.memory_size = autoMemorySize.value
  }
  saveConfig()
}

const handleLockMemoryToggle = (value: boolean) => {
  localSettings.value.lock_memory = value
  saveConfig()
}

const handlePriorityChange = (value: ProcessPriority) => {
  localSettings.value.process_priority = value
  saveConfig()
}

const handleFullscreenToggle = (value: boolean) => {
  localSettings.value.fullscreen = value
  saveConfig()
}

const handleIsolationPolicyChange = (value: InstanceIsolationPolicy) => {
  localSettings.value.instance_isolation_policy = value
  saveConfig()
}

const handleRendererChange = (value: GameRenderer) => {
  localSettings.value.renderer = value
  saveConfig()
}

const handleLauncherVisibilityChange = (value: 'none' | 'minimize' | 'quit') => {
  localSettings.value.launcher_visibility = value
  saveConfig()
}

const handleGpuPreferenceToggle = (value: boolean) => {
  localSettings.value.prefer_high_performance_gpu = value
  saveConfig()
}

const handleUseJavaExeToggle = (value: boolean) => {
  localSettings.value.use_java_exe = value
  saveConfig()
}

const handleDisableCrashAnalysisToggle = (value: boolean) => {
  localSettings.value.disable_crash_analysis = value
  saveConfig()
}

// 全屏关闭时窗口尺寸才有意义；与后端归一化边界保持一致。
const WINDOW_WIDTH_LIMITS = { min: 320, max: 16384, fallback: 854 }
const WINDOW_HEIGHT_LIMITS = { min: 240, max: 16384, fallback: 480 }

const normalizeWindowSize = (value: number | null, limits: { min: number; max: number; fallback: number }): number => {
  if (value === null || Number.isNaN(value)) return limits.fallback
  return Math.min(Math.max(Math.round(value), limits.min), limits.max)
}

const handleWidthChange = (value: number | null) => {
  localSettings.value.game_width = normalizeWindowSize(value, WINDOW_WIDTH_LIMITS)
  debouncedSaveConfig()
}

const handleHeightChange = (value: number | null) => {
  localSettings.value.game_height = normalizeWindowSize(value, WINDOW_HEIGHT_LIMITS)
  debouncedSaveConfig()
}

const handleJavaPathChange = (path: string) => {
  localSettings.value.java_path = path
  saveConfig()
}

onMounted(() => {
  loadGameConfig().then(() => loadSystemMemory())
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped src="@/styles/views/settings/GameTab.css"></style>
