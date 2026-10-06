<template>
  <div ref="settingsPage" class="tab-pane launcher-settings">
    <SettingSection :title="t('settings.languageRegion')">
      <SettingRow :label="t('settings.language')" :description="t('settings.languageDesc')">
        <NSelect
          class="setting-select"
          :value="currentLocale"
          :options="languageOptions"
          @update:value="handleLanguageUpdate"
        />
      </SettingRow>
    </SettingSection>

    <SettingSection :title="t('settings.downloadSettings')">
      <SettingRow :label="t('settings.gameDownloadSource')" :description="t('settings.downloadSourceDesc')">
        <NSelect
          class="setting-select"
          :value="downloadSettings.mirror_source"
          :options="downloadSourceOptions"
          @update:value="handleDownloadSourceChange"
        />
      </SettingRow>
      <SettingRow :label="t('settings.modSource')" :description="t('settings.modSourceDesc')">
        <NSelect
          class="setting-select"
          :value="downloadSettings.mod_source ?? 'official'"
          :options="modSourceOptions"
          @update:value="handleModSourceChange"
        />
      </SettingRow>
    </SettingSection>

    <SettingSection :title="t('settings.launcherProxy')">
      <SettingRow :label="t('settings.proxyMode')" :description="t('settings.apiProxyModeDesc')">
        <NSelect
          class="setting-select"
          :value="apiProxyMode"
          :options="proxyModeOptions"
          @update:value="handleApiProxyModeChange"
        />
      </SettingRow>
      <SettingRow
        v-if="apiProxyMode === 'custom'"
        :label="t('settings.proxyUrl')"
        :description="t('settings.apiProxyUrlDesc')"
      >
        <NInput
          :value="apiProxyUrl"
          :placeholder="t('settings.proxyUrlPlaceholder')"
          clearable
          @update:value="handleApiProxyUrlChange"
        />
      </SettingRow>
      <SettingRow :label="t('settings.requestTimeout')" :description="t('settings.requestTimeoutDesc')">
        <NInputNumber
          :value="requestTimeout"
          :min="1"
          :max="120"
          :precision="0"
          :showButton="false"
          @update:value="handleRequestTimeoutChange"
        />
      </SettingRow>
      <SettingRow :label="t('settings.requestRetries')" :description="t('settings.requestRetriesDesc')">
        <NInputNumber
          :value="requestRetries"
          :min="0"
          :max="5"
          :precision="0"
          :showButton="false"
          @update:value="handleRequestRetriesChange"
        />
      </SettingRow>
      <SettingRow :label="t('settings.disableSslVerify')" :description="t('settings.disableSslVerifyDesc')">
        <NSwitch :value="disableSslVerify" @update:value="handleDisableSslVerifyChange" />
      </SettingRow>
    </SettingSection>

    <SettingSection :title="t('settings.downloadProxy')">
      <SettingRow :label="t('settings.proxyMode')" :description="t('settings.proxyModeDesc')">
        <NSelect
          class="setting-select"
          :value="proxyMode"
          :options="proxyModeOptions"
          @update:value="handleProxyModeChange"
        />
      </SettingRow>
      <SettingRow
        v-if="proxyMode === 'custom'"
        :label="t('settings.proxyUrl')"
        :description="t('settings.proxyUrlDesc')"
      >
        <NInput
          :value="proxyUrl"
          :placeholder="t('settings.proxyUrlPlaceholder')"
          clearable
          @update:value="handleProxyUrlChange"
        />
      </SettingRow>
    </SettingSection>

    <div
      ref="connectorSection"
      class="connector-settings-target"
      data-settings-section="connector"
      role="region"
      tabindex="-1"
      :aria-label="t('advanced.nodesTitle')"
    >
      <SettingSection :title="t('advanced.nodesTitle')">
        <ConnectorNodeSettings />
      </SettingSection>
    </div>

    <SettingSection :title="t('settings.developer')">
      <SettingRow :label="t('settings.debugMode')" :description="t('settings.debugModeDesc')">
        <NSwitch :value="debugMode" @update:value="handleDebugModeChange" />
      </SettingRow>
      <SettingRow :label="t('settings.debugLogLevel')" :description="t('settings.debugLogLevelDesc')">
        <NSelect
          class="setting-select"
          :value="debugLogLevel"
          :options="logLevelOptions"
          @update:value="handleDebugLogLevelChange"
        />
      </SettingRow>
    </SettingSection>

    <PluginSlotHost slotId="plugin-slot-settings-download-section-after" class="plugin-slot-container" />
    <PluginSlotHost slotId="plugin-slot-settings-general-section-after" class="plugin-slot-container" />
    <PluginSlotHost slotId="plugin-slot-settings-launcher-section-after" class="plugin-slot-container" />
  </div>
</template>

<script setup lang="ts">
import { NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ConnectorNodeSettings from '@/components/connect/ConnectorNodeSettings.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useDebugMode } from '@/composables/useDebugMode'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import SettingRow from '@/features/settings/components/SettingRow.vue'
import SettingSection from '@/features/settings/components/SettingSection.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { setLocale, supportedLocales, type LocaleCode } from '@/i18n'
import type { LauncherConfig } from '@/types/config'

type ProxyMode = NonNullable<LauncherConfig['proxy_mode']>

const { t, locale } = useI18n()
const route = useRoute()
const settingsPage = ref<HTMLElement>()
const connectorSection = ref<HTMLElement>()
let locationGeneration = 0
let locationFrame: number | null = null
let locationTimer: ReturnType<typeof setTimeout> | null = null

function cancelLocation() {
  locationGeneration++
  if (locationFrame !== null) cancelAnimationFrame(locationFrame)
  if (locationTimer !== null) clearTimeout(locationTimer)
  locationFrame = null
  locationTimer = null
}

// RouterView 的进入过渡完成前定位会偏移；仅等待本页动画，离页即取消。
async function locateConnectorSection() {
  cancelLocation()
  if (route.query.section !== 'connector') return
  const generation = locationGeneration
  await nextTick()
  if (generation !== locationGeneration) return
  locationFrame = requestAnimationFrame(() => {
    locationFrame = requestAnimationFrame(() => {
      locationFrame = null
      const focusSection = () => {
        if (generation !== locationGeneration || !connectorSection.value?.isConnected) return
        if (locationTimer !== null) clearTimeout(locationTimer)
        locationTimer = null
        connectorSection.value.scrollIntoView({ block: 'start', behavior: 'instant' })
        connectorSection.value.focus({ preventScroll: true })
      }
      const animations = settingsPage.value?.getAnimations?.() ?? []
      if (!animations.length) {
        focusSection()
        return
      }
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        focusSection()
      }
      locationTimer = setTimeout(finish, 1000)
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish)
    })
  })
}

watch(() => route.query.section, locateConnectorSection, { immediate: true, flush: 'post' })
onBeforeUnmount(cancelLocation)
const { run } = useAsyncAction({ showSuccess: false, showError: true, errorMessage: t('common.error') })
const settingsStore = useSettingsStore()
const { download: downloadSettings } = storeToRefs(settingsStore)
const { debugMode, setDebugMode, debugLogLevel, setDebugLogLevel } = useDebugMode()

const currentLocale = computed(() => locale.value as LocaleCode)
const disableSslVerify = computed(() => settingsStore.launcher.disable_ssl_verify === true)
// 启动器通道代理无旧版布尔配置，无效值一律回退直连。
const apiProxyMode = computed<ProxyMode>(() => {
  const mode = settingsStore.launcher.api_proxy_mode
  return mode === 'custom' || mode === 'system' ? mode : 'none'
})
const apiProxyUrl = computed(() => settingsStore.launcher.api_proxy_url ?? '')
const proxyMode = computed<ProxyMode>(() => {
  const mode = settingsStore.launcher.proxy_mode
  if (mode === 'custom' || mode === 'system') return mode
  // 兼容旧版 ignore_proxy 布尔配置：false→使用系统代理、true/缺失使用代理
  const legacy = (settingsStore.launcher as LauncherConfig & { ignore_proxy?: boolean }).ignore_proxy
  return legacy === false ? 'system' : 'none'
})
const proxyUrl = computed(() => settingsStore.launcher.proxy_url ?? '')
const requestTimeout = computed(() => settingsStore.launcher.request_timeout ?? 15)
const requestRetries = computed(() => settingsStore.launcher.request_retries ?? 2)

const proxyModeOptions = computed(() => [
  { label: t('settings.proxyNone'), value: 'none' },
  { label: t('settings.proxySystem'), value: 'system' },
  { label: t('settings.proxyCustom'), value: 'custom' },
])

const languageOptions = computed(() =>
  supportedLocales.map((language) => ({
    label: language.name,
    value: language.code,
  }))
)

const downloadSourceOptions = computed(() => [
  { value: 'official', label: t('settings.downloadSourceOfficialFirst') },
  { value: 'bmclapi', label: t('settings.downloadSourceBmclapiFirst') },
])

const modSourceOptions = computed(() => [
  { value: 'official', label: t('settings.modSourceOfficial') },
  { value: 'mcim', label: t('settings.modSourceMcim') },
])

const logLevelOptions = computed(() => [
  { label: t('settings.logLevelDebug'), value: 'debug' },
  { label: t('settings.logLevelInfo'), value: 'info' },
  { label: t('settings.logLevelWarning'), value: 'warning' },
  { label: t('settings.logLevelError'), value: 'error' },
])

async function handleLanguageChange(languageCode: LocaleCode): Promise<void> {
  await setLocale(languageCode)
  await run(() => settingsStore.patchUi({ locale: languageCode }))
}

function handleLanguageUpdate(languageCode: string): void {
  void handleLanguageChange(languageCode as LocaleCode)
}

async function handleDownloadSourceChange(value: 'official' | 'bmclapi'): Promise<void> {
  await run(() => settingsStore.patchDownload({ mirror_source: value }))
}

async function handleModSourceChange(value: 'official' | 'mcim'): Promise<void> {
  await run(() => settingsStore.patchDownload({ mod_source: value }))
}

async function handleDebugModeChange(value: boolean): Promise<void> {
  await run(() => setDebugMode(value))
}

async function handleDebugLogLevelChange(value: string): Promise<void> {
  await run(() => setDebugLogLevel(value as NonNullable<LauncherConfig['debug_log_level']>))
}

async function handleDisableSslVerifyChange(value: boolean): Promise<void> {
  await run(() => settingsStore.patchLauncher({ disable_ssl_verify: value }))
}

async function handleApiProxyModeChange(value: string): Promise<void> {
  await run(() => settingsStore.patchLauncher({ api_proxy_mode: value as ProxyMode }))
}

async function handleApiProxyUrlChange(value: string): Promise<void> {
  await run(() => settingsStore.patchLauncher({ api_proxy_url: value }))
}

async function handleProxyModeChange(value: string): Promise<void> {
  await run(() => settingsStore.patchLauncher({ proxy_mode: value as ProxyMode }))
}

async function handleProxyUrlChange(value: string): Promise<void> {
  await run(() => settingsStore.patchLauncher({ proxy_url: value }))
}

async function handleRequestTimeoutChange(value: number | null): Promise<void> {
  if (value === null) return
  await run(() => settingsStore.patchLauncher({ request_timeout: value }))
}

async function handleRequestRetriesChange(value: number | null): Promise<void> {
  if (value === null) return
  await run(() => settingsStore.patchLauncher({ request_retries: value }))
}
</script>

<style scoped src="@/styles/views/settings/LauncherTab.css"></style>
