<template>
  <div class="game-launch-bar">
    <div v-if="javaRecoveryMessage" role="alert" class="java-recovery">
      <span>{{ javaRecoveryMessage }}</span>
      <NButton size="small" :loading="isRescanningJava" @click="emit('rescanJava')">{{
        t('javaRecovery.rescan')
      }}</NButton>
      <NButton size="small" @click="emit('selectJava')">{{ t('javaRecovery.select') }}</NButton>
      <NButton size="small" @click="emit('downloadJava')">{{ t('javaManager.downloadSuitable') }}</NButton>
    </div>
    <PluginSlotHost slotId="plugin-slot-game-launch-before" class="plugin-slot-container" />
    <div class="launch-action-row">
      <!-- 分裂按钮：启动实例 + 最近实例切换 -->
      <div
        v-if="versionsCount > 0"
        class="split-launch-btn"
        :class="{ disabled: launching || !selectedVersion || !hasAccount }"
      >
        <button class="split-main" :disabled="launching || !selectedVersion || !hasAccount" @click="emit('launch')">
          <span class="split-main-icon"><UiIcon name="play" :size="16" /></span>
          <span class="launch-main-content">
            <span class="launch-main-label">{{ launching ? t('game.launching') : t('game.launch') }}</span>
            <span class="launch-version" :title="selectedInstanceName">{{ selectedInstanceName }}</span>
          </span>
        </button>
        <span class="split-divider"></span>
        <NPopover v-model:show="isRecentInstancesOpen" trigger="click" placement="top-end" :showArrow="false" raw>
          <template #trigger>
            <button class="split-arrow" :disabled="launching" :title="t('game.recentInstances')">
              <UiIcon
                name="chevron-up"
                :size="14"
                class="split-arrow-icon"
                :class="{ rotated: isRecentInstancesOpen }"
              />
            </button>
          </template>
          <div class="recent-instances-popover" :class="{ wide: recentInstances.length > 5 }">
            <div class="recent-popover-header">
              {{ t('game.recentInstances') }}
            </div>
            <div v-if="recentInstances.length === 0" class="recent-popover-empty">
              {{ t('game.noRecentInstances') }}
            </div>
            <div v-else class="recent-instances-list" :class="{ 'two-columns': recentInstances.length > 5 }">
              <button
                v-for="item in recentInstances"
                :key="`${item.gamePath}\0${item.versionId}`"
                class="recent-instance-item"
                :class="{
                  active: item.versionId === selectedVersion && item.gamePath === currentGamePath,
                  pinned: item.pinned,
                }"
                @click="handleSelectRecent(item)"
              >
                <UiIcon v-if="item.pinned" name="pin-filled" :size="11" class="recent-pin-flag" />
                <span class="recent-instance-name">{{ instanceNameOf(item) }}</span>
                <span v-if="instancePathNameOf(item)" class="recent-instance-path">{{ instancePathNameOf(item) }}</span>
                <span class="recent-item-actions" @click.stop>
                  <span
                    role="button"
                    tabindex="-1"
                    class="recent-action-btn"
                    :class="{ active: item.pinned, disabled: !item.pinned && pinCapReached }"
                    :aria-disabled="!item.pinned && pinCapReached"
                    :title="pinTitle(item)"
                    @click.stop="handleTogglePin(item)"
                  >
                    <UiIcon :name="item.pinned ? 'pin-filled' : 'pin'" :size="12" />
                  </span>
                  <span
                    role="button"
                    tabindex="-1"
                    class="recent-action-btn danger"
                    :title="t('app.delete')"
                    @click.stop="handleRemoveRecent(item)"
                  >
                    <UiIcon name="delete" :size="12" />
                  </span>
                </span>
                <UiIcon
                  v-if="item.versionId === selectedVersion && item.gamePath === currentGamePath"
                  name="check"
                  :size="12"
                />
              </button>
            </div>
          </div>
        </NPopover>
      </div>

      <!-- 无版本时安装按钮 -->
      <NButton
        v-else
        class="fab-launch-btn no-version launch-main-button"
        type="primary"
        size="large"
        @click="emit('manageVersions')"
      >
        <template #icon><UiIcon name="download" :size="16" /></template>
        <span class="launch-main-label">{{ t('game.noVersionInstall') }}</span>
      </NButton>

      <NButton
        class="launch-manage-button"
        type="primary"
        secondary
        size="large"
        :title="t('versions.title')"
        :aria-label="t('versions.title')"
        @click="emit('manageVersions')"
      >
        <template #icon><UiIcon name="list" :size="17" /></template>
      </NButton>
    </div>
    <NButton
      class="launch-settings-button"
      secondary
      block
      :title="t('game.versionSettings')"
      :aria-label="t('game.versionSettings')"
      :disabled="!selectedVersion"
      @click="emit('versionSettings')"
    >
      <template #icon><UiIcon name="settings" :size="15" /></template>
      {{ t('game.versionSettings') }}
    </NButton>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopover } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiIcon from '@/components/ui/Icon.vue'
import { MAX_PINNED_ITEMS, type RecentInstance } from '@/composables/useRecentInstances'
import { instanceDisplayName } from '@/features/instances/model/instancePresentation'
import { useInstanceStore } from '@/features/instances/stores/instanceStore'
import PluginSlotHost from '@/features/plugins/slots/PluginSlotHost.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { gamePathIdentity } from '@/utils/path'

const props = defineProps<{
  versionsCount: number
  launching: boolean
  selectedVersion: string
  currentGamePath: string
  hasAccount: boolean
  recentInstances: RecentInstance[]
  javaRecoveryMessage?: string
  isRescanningJava?: boolean
}>()

const emit = defineEmits<{
  launch: []
  manageVersions: []
  versionSettings: []
  selectVersion: [versionId: string, gamePath?: string]
  togglePin: [item: RecentInstance]
  removeRecent: [item: RecentInstance]
  rescanJava: []
  selectJava: []
  downloadJava: []
}>()

const instanceStore = useInstanceStore()
const settingsStore = useSettingsStore()
const isRecentInstancesOpen = ref(false)

const selectedInstanceName = computed(() => {
  const matched = matchedInstance(props.selectedVersion, props.currentGamePath)
  return matched ? instanceDisplayName(matched) : props.selectedVersion
})

const pinCapReached = computed(() => props.recentInstances.filter((item) => item.pinned).length >= MAX_PINNED_ITEMS)

const getPathDisplayName = (gamePath: string): string => {
  const parts = gamePath.replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts[parts.length - 1] || gamePath
}

function matchedInstance(versionId: string, gamePath: string) {
  return instanceStore.scannedVersions.find(
    (v) => v.versionId === versionId && gamePathIdentity(v.path) === gamePathIdentity(gamePath)
  )
}

function instanceNameOf(item: RecentInstance): string {
  const matched = matchedInstance(item.versionId, item.gamePath)
  return matched ? instanceDisplayName(matched) : item.versionName
}

function instancePathNameOf(item: RecentInstance): string {
  const entry = settingsStore.game.minecraft_paths.find(
    (p) => gamePathIdentity(typeof p === 'string' ? p : p.path) === gamePathIdentity(item.gamePath)
  )
  if (!entry) return getPathDisplayName(item.gamePath)
  return typeof entry === 'string' ? getPathDisplayName(entry) : entry.name || getPathDisplayName(entry.path)
}

function pinTitle(item: RecentInstance): string {
  if (item.pinned) return t('game.recentUnpin')
  return pinCapReached.value ? t('game.recentPinLimit') : t('game.recentPin')
}

function handleSelectRecent(item: RecentInstance) {
  emit('selectVersion', item.versionId, item.gamePath)
}

function handleTogglePin(item: RecentInstance) {
  if (!item.pinned && pinCapReached.value) return
  emit('togglePin', item)
}

function handleRemoveRecent(item: RecentInstance) {
  emit('removeRecent', item)
}

const { t } = useI18n()
</script>

<style scoped>
.java-recovery {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  color: var(--warning);
}
.java-recovery span {
  flex-basis: 100%;
  font-size: 12px;
}
.game-launch-bar {
  display: flex;
  width: 100%;
  margin-top: auto;
  flex-direction: column;
  gap: 10px;
}

.launch-action-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 48px;
  gap: 10px;
}

.launch-main-button {
  width: 100%;
  height: 48px;
  min-width: 0;
  border-radius: var(--r-md);
}

.launch-main-button :deep(.n-button__content) {
  min-width: 0;
}

/* ========== 分裂按钮 ========== */
.split-launch-btn {
  display: flex;
  width: 100%;
  height: 48px;
  border-radius: var(--r-md);
  background: var(--primary);
  overflow: hidden;
  transition:
    filter var(--duration-fast) var(--ease-emphasized),
    opacity var(--duration-fast) var(--ease-emphasized);
}

.split-launch-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.split-launch-btn:not(.disabled):hover {
  filter: brightness(0.95);
}

.split-launch-btn:not(.disabled):active {
  filter: brightness(0.9);
}

.split-main {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 9px;
  height: 100%;
  padding: 0 14px;
  border: none;
  background: transparent;
  color: var(--text-on-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  outline: none;
  transition: background var(--duration-fast) var(--ease-emphasized);
}

.split-main:hover {
  background: rgba(255, 255, 255, 0.06);
}

.split-main-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.launch-main-content {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.launch-main-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 650;
}

.split-divider {
  width: 1px;
  align-self: stretch;
  margin: 10px 0;
  background: color-mix(in srgb, var(--text-on-primary) 26%, transparent);
  flex-shrink: 0;
}

.split-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 100%;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-on-primary);
  cursor: pointer;
  outline: none;
  transition: background var(--duration-fast) var(--ease-emphasized);
  border-radius: 0 var(--r-md) var(--r-md) 0;
}

.split-arrow:hover {
  background: rgba(255, 255, 255, 0.1);
}

.split-arrow:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.split-arrow-icon {
  transform-origin: center;
  transition: transform var(--duration-normal) var(--ease-emphasized);
}

.split-arrow-icon.rotated {
  transform: rotate(180deg);
}

/* ========== 最近实例 Popover ========== */
.recent-instances-popover {
  min-width: 180px;
  padding: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}

.recent-instances-popover.wide {
  min-width: 340px;
}

.recent-popover-header {
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.recent-popover-empty {
  padding: 16px 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.recent-instances-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.recent-instances-list.two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 6px;
}

.recent-instance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  gap: 8px;
  transition: background var(--duration-fast) var(--ease-emphasized);
}

.recent-instance-item:hover {
  background: var(--bg-hover);
}

.recent-instance-item.active {
  color: var(--primary);
  font-weight: 600;
}

.recent-instance-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.recent-instance-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 80px;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-tertiary);
}

/* 两列时单元格更窄，路径允许换行省略并让出宽度 */
.recent-instances-list.two-columns .recent-instance-path {
  flex-shrink: 1;
  min-width: 0;
  max-width: none;
}

.recent-pin-flag {
  flex-shrink: 0;
  color: var(--primary);
}

.recent-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-emphasized);
}

.recent-instance-item:hover .recent-item-actions,
.recent-instance-item.pinned .recent-item-actions {
  opacity: 1;
}

.recent-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-emphasized),
    color var(--duration-fast) var(--ease-emphasized);
}

.recent-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.recent-action-btn.active {
  color: var(--primary);
}

.recent-action-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.recent-action-btn.disabled:hover {
  background: transparent;
  color: var(--text-tertiary);
}

.recent-action-btn.danger:hover {
  background: var(--error-alpha);
  color: var(--error);
}

/* ========== 管理按钮 ========== */
.launch-manage-button {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: var(--r-md);
  border: 1px solid var(--primary) !important;
  background: var(--primary-alpha-strong) !important;
  transition:
    background-color var(--duration-fast) var(--ease-emphasized),
    border-color var(--duration-fast) var(--ease-emphasized);
}

.launch-manage-button:hover:not(:disabled) {
  filter: brightness(0.92);
}

.launch-version {
  overflow: hidden;
  max-width: 105px;
  padding-left: 10px;
  color: color-mix(in srgb, var(--text-on-primary) 72%, transparent);
  font-size: 11px;
  font-weight: 500;
  border-left: 1px solid color-mix(in srgb, var(--text-on-primary) 26%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-settings-button {
  height: 34px;
  border-radius: var(--r-md);
  color: var(--text-primary) !important;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--ecl-border) !important;
  background: var(--ecl-surface) !important;
  box-shadow: var(--ecl-shadow-surface);
  transition:
    background-color var(--duration-fast) var(--ease-emphasized),
    border-color var(--duration-fast) var(--ease-emphasized),
    color var(--duration-fast) var(--ease-emphasized);
}

.launch-settings-button:hover:not(:disabled) {
  color: var(--primary) !important;
  background: var(--ecl-surface-muted) !important;
  border-color: var(--ecl-border-strong) !important;
}

.launch-settings-button:disabled {
  opacity: 0.45;
}
</style>
