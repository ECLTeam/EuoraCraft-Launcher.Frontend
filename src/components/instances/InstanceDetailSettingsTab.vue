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
        <SettingRow :label="t('versions.detail.customMemory')" :description="t('versions.detail.customMemoryDesc')">
          <NSwitch v-model:value="versionSettings.customMemory" />
        </SettingRow>

        <div
          v-if="versionSettings.customMemory"
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
        <SettingRow :label="t('versions.detail.customJava')" :description="t('versions.detail.customJavaDesc')">
          <NSwitch v-model:value="versionSettings.customJava" />
        </SettingRow>
        <SettingRow v-if="versionSettings.customJava" :label="t('versions.detail.javaPath')">
          <div class="java-selector">
            <NSelect
              class="java-path-select"
              :value="versionSettings.javaPath || null"
              :options="javaOptions"
              :placeholder="t('versions.detail.javaPathPlaceholder')"
              filterable
              :loading="javaScanning"
              @update:value="handleJavaPathChange"
            />
            <NButton size="small" :loading="javaSelecting" @click="selectJava">
              {{ t('common.browse') }}
            </NButton>
          </div>
        </SettingRow>
      </div>

      <div class="settings-subgroup">
        <div class="settings-subgroup__title">{{ t('versions.detail.jvmArgs') }}</div>
        <SettingRow :label="t('versions.detail.customJvmArgs')" :description="t('versions.detail.customJvmArgsDesc')">
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
        <SettingRow :label="t('versions.detail.customGameArgs')" :description="t('versions.detail.customGameArgsDesc')">
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
        <div class="settings-subgroup__title">{{ t('versions.detail.advancedOptions') }}</div>
        <SettingRow :label="t('settings.wrapperCommand')" :description="t('versions.detail.inheritGlobalDesc')">
          <NInput v-model:value="versionSettings.wrapperCommand" />
        </SettingRow>
        <SettingRow :label="t('settings.postExitCommand')" :description="t('versions.detail.inheritGlobalDesc')">
          <NInput v-model:value="versionSettings.postExitCommand" />
        </SettingRow>
        <SettingRow :label="t('settings.envVars')" :description="t('versions.detail.inheritGlobalDesc')">
          <NInput
            v-model:value="versionSettings.envVars"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 5 }"
            :placeholder="t('settings.envVarsPlaceholder')"
          />
        </SettingRow>
        <SettingRow :label="t('settings.windowTitle')" :description="t('versions.detail.inheritGlobalDesc')">
          <NInput v-model:value="versionSettings.windowTitle" />
        </SettingRow>
        <SettingRow :label="t('settings.launcherVisibility')" :description="t('versions.detail.inheritGlobalDesc')">
          <NSelect v-model:value="versionSettings.launcherVisibility" :options="visibilityOptions" />
        </SettingRow>
      </div>
    </SettingSection>
  </template>
</template>

<script setup lang="ts">
import { NButton, NInput, NSelect, NSwitch } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiLoading from '@/components/ui/Loading.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { instanceSettingsApi } from '@/features/instances/api/instanceSettingsApi'
import {
  createDefaultVersionSettings,
  normalizeVersionSettings,
  type VersionSettingsTarget,
} from '@/features/instances/model/instanceSettings'
import { settingsApi } from '@/features/settings/api/settingsApi'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import SettingSection from '@/features/settings/components/SettingSection.vue'
import type { SystemMemoryInfo } from '@/types/config'
import type { JavaInstallation, ScannedVersion } from '@/types/instances'

defineOptions({ name: 'InstanceDetailSettingsTab' })

const props = defineProps<{
  version: ScannedVersion | null
  visible: boolean
}>()

const { t } = useI18n()
const message = useLauncherMessage()

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

const versionSettings = reactive(createDefaultVersionSettings())
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const javaSelecting = ref(false)
const javaScanning = ref(false)
const javaList = ref<JavaInstallation[]>([])
const systemMemory = ref<SystemMemoryInfo>({ totalMb: 16384, usedMb: 4096, freeMb: 12288, percentUsed: 25 })
const systemMemoryError = ref(false)

const MEMORY_MIN = 1024
const maxMemory = computed(() => Math.max(systemMemory.value.totalMb, 2048))
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
const javaOptions = computed(() => {
  const options = javaList.value.map((java) => ({
    value: java.path,
    label: `Java ${java.major_version} (${java.java_type}) · ${java.version} · ${java.arch}`,
  }))
  const selectedPath = versionSettings.javaPath
  if (selectedPath && !options.some((option) => option.value === selectedPath)) {
    options.unshift({ value: selectedPath, label: selectedPath })
  }
  return options
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
let resaveQueued = false

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
  Object.assign(versionSettings, defaults)
  savedSettingsSnapshot.value = JSON.stringify(defaults)
  settingsLoading.value = true
  try {
    const settings = await instanceSettingsApi.get(target)
    if (requestId !== settingsRequestId) return
    // 归一化补齐缺失字段后再存快照，保证脏检查的键集与响应对象一致
    Object.assign(versionSettings, normalizeVersionSettings(settings))
    savedSettingsSnapshot.value = JSON.stringify(versionSettings)
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
  if (versionSettings.customMemory && (versionSettings.memory < 512 || versionSettings.memory > 65536)) {
    return t('versions.detail.invalidMemory')
  }
  if (versionSettings.customJava && !versionSettings.javaPath.trim()) {
    return t('versions.detail.javaPathRequired')
  }
  return null
}

async function persistSettings() {
  if (settingsSaving.value) {
    resaveQueued = true
    return
  }
  const target = getSettingsTarget()
  if (!target) return
  const invalid = validateSettings()
  if (invalid) {
    message.warning(invalid)
    return
  }
  settingsSaving.value = true
  try {
    await instanceSettingsApi.save(target, { ...versionSettings })
    savedSettingsSnapshot.value = JSON.stringify(versionSettings)
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.saveSettingsFailed'))
  } finally {
    settingsSaving.value = false
    if (resaveQueued) {
      resaveQueued = false
      void persistSettings()
    }
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
  () => props.visible,
  (val) => {
    if (val) {
      void loadSettings()
      void loadRuntimeInfo()
    } else flushSettingsSave()
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
  const target = getSettingsTarget()
  if (!target) return
  settingsSaving.value = true
  try {
    await instanceSettingsApi.reset(target)
    skipSettingsWatch = true
    const defaults = createDefaultVersionSettings()
    Object.assign(versionSettings, defaults)
    savedSettingsSnapshot.value = JSON.stringify(defaults)
    message.success(t('versions.detail.settingsReset'))
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.saveSettingsFailed'))
  } finally {
    settingsSaving.value = false
    await nextTick()
    skipSettingsWatch = false
  }
}

async function selectJava() {
  javaSelecting.value = true
  try {
    const path = await instanceSettingsApi.selectJava()
    if (path) versionSettings.javaPath = path
  } catch (error) {
    message.error(error instanceof Error ? error.message : t('versions.detail.javaSelectFailed'))
  } finally {
    javaSelecting.value = false
  }
}

function handleJavaPathChange(value: string | number | null) {
  versionSettings.javaPath = typeof value === 'string' ? value : ''
}

async function loadRuntimeInfo() {
  try {
    const java = await settingsApi.listJava()
    if (Array.isArray(java) && java.length) javaList.value = java
  } catch {
    // 扫描失败时仍可通过浏览按钮手动选择
  }
  try {
    const mem = await settingsApi.getSystemMemory()
    if (mem && typeof mem.totalMb === 'number') systemMemory.value = mem
  } catch {
    systemMemoryError.value = true
  }
}

// 切换到其他 tab / 组件卸载时，同样 flush 挂起中的自动保存
onBeforeUnmount(() => {
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer)
  if (settingsDirty.value) void persistSettings()
})
</script>

<style scoped src="@/styles/views/instances/InstanceDetailModal.css"></style>
