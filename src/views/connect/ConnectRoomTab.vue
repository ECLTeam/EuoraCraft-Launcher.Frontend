<template>
  <div class="connect-page workspace-page">
    <section class="connect-workspace workspace-shell">
      <div class="connect-workspace__body">
        <div v-if="flowDebug" class="connect-debug-bar">
          <span class="connect-debug-bar__label">
            <UiIcon name="bug" :size="13" />
            {{ t('connect.debug.label') }}
          </span>
          <div class="connect-debug-bar__nav">
            <UiButton
              size="sm"
              variant="outline"
              icon="arrow-left"
              :disabled="debugStageIndex <= 0"
              @click="prevDebugStage"
            >
              {{ t('connect.debug.prev') }}
            </UiButton>
            <div class="connect-debug-chips">
              <button
                v-for="(stage, index) in debugStages"
                :key="stage.key"
                type="button"
                class="connect-debug-chip"
                :class="{ active: debugStageIndex === index }"
                @click="applyDebugStage(index)"
              >
                {{ stage.label }}
              </button>
            </div>
            <UiButton
              size="sm"
              variant="outline"
              icon="arrow-right"
              :disabled="debugStageIndex >= debugStages.length - 1"
              @click="nextDebugStage"
            >
              {{ t('connect.debug.next') }}
            </UiButton>
          </div>
          <UiButton v-if="stageOverride" size="sm" variant="text" @click="resetLiveStage">
            {{ t('connect.debug.live') }}
          </UiButton>
        </div>

        <div
          class="connect-scroll-area workspace-scroll-area"
          :class="{ 'connect-room-container': displayStatus.mode === 'host' || displayStatus.mode === 'guest' }"
        >
          <Transition name="page" mode="out-in">
            <template v-if="displayStatus.mode === 'idle'">
              <div :key="`idle-${displayHostStep}`" class="connect-idle-layout">
                <div class="connect-idle-primary">
                  <UiCard v-if="displayHostStep !== 2" class="connect-main-card">
                    <template #header>
                      <div class="connect-join-heading">
                        <div class="connect-card-heading">
                          <UiIcon name="login" :size="18" />
                          <div>
                            <strong>{{ t('connect.join.title') }}</strong>
                            <span>{{ t('connect.join.hint') }}</span>
                          </div>
                        </div>
                        <UiButton
                          size="sm"
                          variant="ghost"
                          icon="settings"
                          data-action="connector-settings"
                          :disabled="busy || status.mode === 'starting'"
                          @click="openConnectorSettings"
                        >
                          {{ t('advanced.nodesEntry') }}
                        </UiButton>
                      </div>
                    </template>
                    <div class="connect-form">
                      <label for="connect-room-code">{{ t('connect.join.roomCode') }}</label>
                      <div class="connect-room-input-row connect-join-row">
                        <div ref="roomCodeField" class="connect-code-field" :class="{ 'has-clear': roomCode }">
                          <UiInput
                            id="connect-room-code"
                            v-model="roomCode"
                            placeholder="U/XXXX-XXXX-XXXX-XXXX"
                            prefixIcon="link"
                            :aria-label="t('connect.join.roomCode')"
                            :disabled="!serviceReady"
                            @enter="joinRoom"
                          />
                          <UiButton
                            v-if="roomCode"
                            class="connect-code-clear"
                            variant="ghost"
                            shape="square"
                            size="sm"
                            icon="close"
                            :title="t('common.clear')"
                            :aria-label="t('common.clear')"
                            :disabled="!serviceReady || !roomCode"
                            @click="clearRoomCode"
                          />
                        </div>
                        <UiButton
                          class="connect-code-paste"
                          variant="ghost"
                          shape="square"
                          icon="clipboard"
                          :title="t('connect.join.paste')"
                          :aria-label="t('connect.join.paste')"
                          :disabled="!serviceReady"
                          @click="pasteRoomCode"
                        />
                        <UiButton
                          icon="login"
                          :loading="busy"
                          :disabled="!serviceReady || !roomCode.trim()"
                          @click="joinRoom"
                        >
                          {{ t('connect.join.action') }}
                        </UiButton>
                      </div>
                    </div>
                  </UiCard>

                  <UiCard
                    class="connect-main-card"
                    :class="{ 'connect-main-card--disabled': busy }"
                    :aria-disabled="busy"
                  >
                    <template #header>
                      <div class="connect-card-heading">
                        <UiIcon name="server" :size="18" />
                        <div>
                          <strong>{{ t('connect.create.title') }}</strong>
                          <span>{{ t('connect.create.hint') }}</span>
                        </div>
                      </div>
                    </template>

                    <div v-if="displayHostStep === 1" class="connect-form">
                      <label for="connect-instance">{{ t('connect.create.selectInstance') }}</label>
                      <div class="connect-room-input-row connect-instance-row">
                        <UiSelect
                          id="connect-instance"
                          v-model="selectedInstanceKey"
                          :options="runningInstanceOptions"
                          :placeholder="
                            t(
                              runningInstances.length
                                ? 'connect.create.instancePlaceholder'
                                : 'connect.create.noRunningInstancePlaceholder'
                            )
                          "
                          :disabled="createRoomDisabled || !runningInstances.length"
                        />
                        <UiButton
                          icon="arrow-right"
                          :disabled="createRoomDisabled || !selectedInstanceKey"
                          @click="goToPortStep"
                        >
                          {{ t('connect.create.next') }}
                        </UiButton>
                      </div>
                      <div class="connect-create-assist">
                        <p v-if="!runningInstances.length && serviceReady" class="connect-help-text">
                          {{ t('connect.create.noRunningInstance') }}
                        </p>
                        <UiButton
                          class="connect-manual-entry"
                          variant="text"
                          size="sm"
                          :disabled="createRoomDisabled"
                          @click="goToManualPort"
                        >
                          {{ t('connect.create.manualPortEntry') }}
                          <UiIcon name="arrow-right" :size="14" />
                        </UiButton>
                      </div>
                      <div v-if="runningInstances.length" class="connect-running-games">
                        <span class="connect-running-games__hint">{{ t('connect.create.runningGameHint') }}</span>
                        <ul class="connect-running-games__list">
                          <li v-for="instance in runningInstances" :key="instance.id" class="connect-running-game">
                            <span class="connect-running-game__name">
                              <UiIcon name="game" :size="14" />
                              {{ instance.name || instance.versionId }}
                            </span>
                            <UiButton
                              size="sm"
                              variant="outline"
                              :disabled="createRoomDisabled"
                              @click="quickCreate(instance)"
                            >
                              {{ t('connect.create.createRoom') }}
                            </UiButton>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div v-else class="connect-form">
                      <p class="connect-help-text">{{ t('connect.create.lanHint') }}</p>
                      <div class="connect-port-scan">
                        <div v-if="displayScanning" class="connect-scan-state">
                          <UiLoading mode="inline" size="md" decorative />
                          <span>{{
                            scanPhase === 'detecting' ? t('connect.create.detecting') : t('connect.create.searching')
                          }}</span>
                        </div>
                        <div v-else-if="displayDetectedPort" class="connect-detected-port">
                          <div>
                            <span>{{ t('connect.create.detectedPort') }}</span>
                            <strong>{{ displayDetectedPort }}</strong>
                            <span v-if="selectedInstance" class="connect-detected-game">
                              {{ t('connect.create.runningGame', { name: selectedInstance.name }) }}
                            </span>
                          </div>
                          <UiButton :loading="busy" :disabled="createRoomDisabled" @click="createDetectedPort">
                            {{ t('connect.create.createRoom') }}
                          </UiButton>
                        </div>
                        <div v-else class="connect-scan-state">
                          <UiIcon name="info" :size="18" />
                          <span>{{ t('connect.create.noPort') }}</span>
                          <UiButton size="sm" variant="text" :disabled="createRoomDisabled" @click="startPortScan">
                            {{ t('common.refresh') }}
                          </UiButton>
                        </div>
                      </div>
                      <label for="connect-port">{{ t('connect.create.manualPort') }}</label>
                      <div class="connect-port-input">
                        <UiInput
                          id="connect-port"
                          v-model="port"
                          type="number"
                          placeholder="25565"
                          :aria-label="t('connect.create.manualPort')"
                          :disabled="createRoomDisabled"
                          @enter="createManualPort"
                        />
                        <UiButton :loading="busy" :disabled="createRoomDisabled" @click="createManualPort">
                          {{ t('connect.create.createRoom') }}
                        </UiButton>
                      </div>
                      <UiButton
                        class="connect-mode-link"
                        variant="text"
                        size="sm"
                        icon="arrow-left"
                        :disabled="busy"
                        @click="goBackToInstanceStep"
                      >
                        {{ t('connect.create.back') }}
                      </UiButton>
                    </div>
                  </UiCard>
                </div>
              </div>
            </template>

            <UiCard
              v-else-if="displayStatus.mode === 'starting'"
              key="starting"
              class="connect-main-card connect-state-card"
            >
              <div v-if="displayStatus.error" class="connect-state-content connect-state-error">
                <UiIcon name="alert-circle" :size="32" />
                <h2>{{ t('connect.starting.failed') }}</h2>
                <p>{{ displayStatus.error }}</p>
                <UiButton @click="leave">{{ t('common.confirm') }}</UiButton>
              </div>
              <div v-else class="connect-state-content">
                <UiLoading mode="inline" size="lg" decorative class="connect-state-icon" />
                <h2>{{ t('connect.starting.title') }}</h2>
                <p>{{ t('connect.starting.description') }}</p>
                <UiProgress processing :height="6" />
                <UiButton variant="danger" :loading="busy" @click="leave">{{ t('common.cancel') }}</UiButton>
              </div>
            </UiCard>

            <div v-else key="room" class="connect-room-layout" :class="`connect-room-layout--${displayStatus.mode}`">
              <UiCard class="connect-main-card connect-room-card connect-room-main">
                <template #header>
                  <div class="connect-card-heading connect-members-heading">
                    <span class="connect-members-heading__icon"><UiIcon name="users" :size="18" /></span>
                    <div>
                      <strong>{{ t('connect.players.title', { count: displayStatus.players.length }) }}</strong>
                      <span>
                        {{
                          t(displayStatus.mode === 'host' ? 'connect.host.description' : 'connect.guest.description')
                        }}
                      </span>
                    </div>
                  </div>
                </template>
                <PlayerList
                  :players="displayStatus.players"
                  :hostControls="displayStatus.mode === 'host'"
                  :busy="busy"
                  @kick="kick"
                />
              </UiCard>

              <aside class="connect-side-panel connect-room-sidebar">
                <UiCard class="connect-side-card connect-room-summary-card">
                  <template #header>
                    <div class="connect-card-heading connect-card-heading--compact">
                      <UiIcon name="info" :size="17" />
                      <strong>{{ t('connect.roomInfo.title') }}</strong>
                    </div>
                  </template>

                  <div class="connect-room-owner">
                    <ConnectorPlayerAvatar
                      :skinBase64="hostPlayer?.iconBase64"
                      :name="hostName || t('connect.host.title')"
                      :size="32"
                    />
                    <div class="connect-room-owner__identity">
                      <strong :title="hostName || t('connect.host.title')">{{
                        hostName || t('connect.host.title')
                      }}</strong>
                      <span>{{ t('connect.roomInfo.creator') }}</span>
                    </div>
                  </div>

                  <div class="connect-room-code-block">
                    <span>{{ t('connect.join.roomCode') }}</span>
                    <div>
                      <code>{{ displayStatus.roomCode }}</code>
                      <UiButton
                        size="sm"
                        variant="ghost"
                        shape="square"
                        icon="copy"
                        :title="t('connect.copy')"
                        :aria-label="t('connect.copy')"
                        @click="copyCurrentRoomCode"
                      />
                    </div>
                  </div>
                  <div class="connect-side-status">
                    <div v-if="displayStatus.gameInfo" class="connect-side-status-row">
                      <span>{{ t('connect.roomInfo.game') }}</span>
                      <code>{{ displayStatus.gameInfo.gameVersion }}</code>
                    </div>
                    <div v-if="displayStatus.mode === 'guest'" class="connect-side-status-row">
                      <span>{{ t('connect.guest.serverAddress') }}</span>
                      <div class="connect-copy-value">
                        <code>{{ serverAddress }}</code>
                        <UiButton
                          size="sm"
                          variant="ghost"
                          shape="square"
                          icon="copy"
                          :title="t('connect.copy')"
                          :aria-label="t('connect.copy')"
                          @click="copyServerAddress"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="connect-room-summary-divider"></div>

                  <div class="connect-room-operation-list">
                    <UiButton size="sm" variant="ghost" icon="refresh" :loading="busy" @click="() => refreshStatus()">
                      {{ t('connect.players.refresh') }}
                    </UiButton>
                    <UiButton size="sm" variant="danger" icon="logout" :loading="busy" @click="leave">
                      {{ t(displayStatus.mode === 'host' ? 'connect.host.close' : 'connect.guest.leave') }}
                    </UiButton>
                  </div>
                </UiCard>
              </aside>
            </div>
          </Transition>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ConnectorPlayerAvatar from '@/components/connect/ConnectorPlayerAvatar.vue'
import PlayerList from '@/components/connect/PlayerList.vue'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiIcon from '@/components/ui/Icon.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLoading from '@/components/ui/Loading.vue'
import UiProgress from '@/components/ui/Progress.vue'
import UiSelect from '@/components/ui/Select.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useConnectFlowDebug } from '@/features/connect/composables/useConnectFlowDebug'
import { useConnectorContext } from '@/features/connect/connectorContext'
import { validateRoomCode } from '@/features/connect/roomCode'
import { instanceRuntimeApi } from '@/features/instances/api/instanceRuntimeApi'
import type { GameInstance } from '@/types/instances'
const { t } = useI18n()
const router = useRouter()
const message = useLauncherMessage()
const hostStep = ref<1 | 2>(1)
const selectedInstanceKey = ref('')
const port = ref('25565')
const roomCode = ref('')
const roomCodeField = ref<HTMLDivElement>()
const runningInstances = ref<GameInstance[]>([])
let unsubscribeRunning: (() => void) | null = null

const connector = useConnectorContext()
const {
  availability,
  status,
  busy,
  scanning,
  scanPhase,
  detectedPort,
  hostPort,
  join,
  leave,
  kick,
  startPortScan,
  stopPortScan,
  refreshStatus,
} = connector
const { initialize } = connector

function openConnectorSettings() {
  if (busy.value || status.value.mode === 'starting') return
  void router.push({ path: '/settings/launcher', query: { section: 'connector' } })
}

const {
  flowDebug,
  debugStageIndex,
  stageOverride,
  debugStages,
  displayStatus,
  displayHostStep,
  displayDetectedPort,
  displayScanning,
  applyDebugStage,
  prevDebugStage,
  nextDebugStage,
  resetLiveStage,
  updateDebugStageIndexFromStatus,
  stageIndex,
} = useConnectFlowDebug({ status, hostStep, detectedPort, scanning })

const runningInstanceOptions = computed(() =>
  runningInstances.value.map((instance) => ({
    label: instance.name || instance.versionId,
    value: instance.id,
  }))
)

const selectedInstance = computed(
  () => runningInstances.value.find((instance) => instance.id === selectedInstanceKey.value) ?? null
)

async function loadRunningInstances(): Promise<void> {
  try {
    const all = await instanceRuntimeApi.list()
    runningInstances.value = all.filter((instance) => instance.isRunning)
  } catch {
    runningInstances.value = []
  }
}

const serviceReady = computed(() => availability.value === 'available')
const createRoomDisabled = computed(() => !serviceReady.value || busy.value)
const serverAddress = computed(
  () => `${displayStatus.value.mcHost || '127.0.0.1'}:${displayStatus.value.mcPort || 25565}`
)
const hostName = computed(() => displayStatus.value.players.find((p) => p.kind === 'host')?.name ?? '')
const hostPlayer = computed(() => displayStatus.value.players.find((player) => player.kind === 'host'))

function goToPortStep(): void {
  if (busy.value) return
  if (flowDebug.value) {
    applyDebugStage(stageIndex('create-port'))
    startPortScan()
    return
  }
  if (!selectedInstanceKey.value) {
    message.warning(t('connect.validation.instance'))
    return
  }
  hostStep.value = 2
  // 等待端口界面渲染完成后再开始嗅探，避免扫描状态先于界面显示
  void nextTick(() => startPortScan())
}

function quickCreate(instance: GameInstance): void {
  if (busy.value) return
  selectedInstanceKey.value = instance.id
  goToPortStep()
}

function goBackToInstanceStep(): void {
  if (flowDebug.value) {
    applyDebugStage(stageIndex('idle'))
    stopPortScan()
    return
  }
  hostStep.value = 1
  stopPortScan()
}

function goToManualPort(): void {
  if (busy.value) return
  if (flowDebug.value) {
    applyDebugStage(stageIndex('create-port'))
    stopPortScan()
    return
  }
  hostStep.value = 2
  // 进入端口界面后自动开始探测，避免直接显示「未检测到」的结论状态
  void nextTick(() => startPortScan())
}

function validPort(): number | null {
  const parsed = Number.parseInt(port.value, 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    message.warning(t('connect.validation.port'))
    return null
  }
  return parsed
}

async function createManualPort(): Promise<void> {
  if (busy.value) return
  const parsed = validPort()
  if (parsed !== null) await hostPort(parsed)
}

async function createDetectedPort(): Promise<void> {
  if (busy.value) return
  if (detectedPort.value !== null) await hostPort(detectedPort.value)
}

async function joinRoom(): Promise<void> {
  const code = roomCode.value.trim()
  if (!code) {
    message.warning(t('connect.validation.roomCode'))
    return
  }
  if (!validateRoomCode(code)) {
    message.warning(t('connect.validation.roomCodeFormat'))
    return
  }
  const joined = await join(code)
  if (joined) await refreshStatus()
}

async function pasteRoomCode(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    if (text) roomCode.value = text.trim()
  } catch {
    message.error(t('connect.validation.pasteFailed'))
  }
}

async function copyCurrentRoomCode(): Promise<void> {
  const code = displayStatus.value.roomCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    message.success(t('connect.copied'))
  } catch {
    message.error(t('connect.validation.copyFailed'))
  }
}

async function copyServerAddress(): Promise<void> {
  try {
    await navigator.clipboard.writeText(serverAddress.value)
    message.success(t('connect.copied'))
  } catch {
    message.error(t('connect.validation.copyFailed'))
  }
}

function clearRoomCode(): void {
  roomCode.value = ''
  roomCodeField.value?.querySelector<HTMLInputElement>('input')?.focus()
}

watch(
  () => status.value.mode,
  (mode) => {
    if (mode === 'idle') {
      hostStep.value = 1
      stopPortScan()
    }
    if (flowDebug.value) updateDebugStageIndexFromStatus()
  }
)

watch(
  () => flowDebug.value,
  (enabled) => {
    if (enabled) updateDebugStageIndexFromStatus()
    else {
      stageOverride.value = null
      debugStageIndex.value = 0
    }
  }
)

onMounted(() => {
  void initialize()
  void loadRunningInstances()
  unsubscribeRunning = instanceRuntimeApi.onChanged(() => void loadRunningInstances())
})

onUnmounted(() => {
  stopPortScan()
  unsubscribeRunning?.()
})
</script>

<style scoped src="@/styles/views/Connect.css"></style>

<style scoped src="@/styles/views/Workspace.css"></style>
