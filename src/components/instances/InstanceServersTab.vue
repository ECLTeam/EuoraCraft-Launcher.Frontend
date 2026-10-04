<template>
  <section class="servers-panel">
    <header class="servers-toolbar">
      <NInput v-model:value="query" clearable size="small" placeholder="搜索服务器名称、地址或 MOTD" />
      <div class="toolbar-actions">
        <NButton
          quaternary
          circle
          size="small"
          :loading="loading"
          title="刷新列表"
          aria-label="刷新列表"
          @click="reload"
        >
          <template #icon><UiIcon name="refresh" :size="16" /></template>
        </NButton>
        <NButton
          quaternary
          circle
          size="small"
          :loading="statusLoading"
          title="刷新状态"
          aria-label="刷新状态"
          @click="refreshStatus"
        >
          <template #icon><UiIcon name="wifi" :size="16" /></template>
        </NButton>
        <NButton size="small" type="primary" class="toolbar-primary-btn" aria-label="添加服务器" @click="edit()">
          <template #icon><UiIcon name="plus" :size="13" /></template>
          添加服务器
        </NButton>
      </div>
    </header>
    <InstanceContentState :loading="loading" :empty="filtered.length === 0" emptyDescription="服务器列表为空">
      <div class="servers-content">
        <div class="server-list">
          <article v-for="server in filtered" :key="server.id" class="server-row">
            <div class="server-row-main">
              <div class="server-icon">
                <img
                  v-if="iconSource(server)"
                  :src="iconSource(server)"
                  :alt="server.name"
                  @error="failedIcons.add(iconSource(server)!)"
                />
                <UiIcon v-else name="server" :size="24" />
              </div>
              <div class="server-info">
                <div class="server-name-row">
                  <span class="server-name" :title="server.name">{{ server.name }}</span>
                  <span v-if="server.favorite" class="server-fav" title="已收藏" aria-label="已收藏">★</span>
                </div>
                <span class="server-address" :title="server.address">{{ server.address }}</span>
                <p class="server-motd" :title="motdText(server)">{{ motdText(server) }}</p>
              </div>
            </div>
            <div class="server-status">
              <span :class="['server-status-label', statusClass(server)]" :title="statusLabel(server)">
                <span :class="['status-dot', statusClass(server)]" />{{
                  statusLoading ? '查询中' : statusOf(server) ? (statusOf(server)?.online ? '在线' : '离线') : '未查询'
                }}
              </span>
              <div v-if="!statusLoading && statuses[server.address]?.online" class="server-badges">
                <span class="server-badge players">
                  <UiIcon name="users" :size="12" />
                  {{ statuses[server.address]?.playersOnline }}/{{ statuses[server.address]?.playersMax }}
                </span>
                <span :class="['server-badge', 'latency', latencyClass(server)]">
                  <UiIcon name="bolt" :size="12" />
                  {{ statuses[server.address]?.latency }} ms
                </span>
                <span
                  v-if="statuses[server.address]?.version"
                  class="server-badge version"
                  :title="statuses[server.address]?.version"
                >
                  {{ statuses[server.address]?.version }}
                </span>
              </div>
            </div>
            <div class="server-actions">
              <NButton
                size="small"
                type="primary"
                class="server-connect"
                title="启动并连接"
                aria-label="启动并连接"
                @click="connect(server)"
              >
                <template #icon><UiIcon name="player-play" :size="15" /></template
                ><span class="server-connect-label">启动并连接</span>
              </NButton>
              <NButton
                quaternary
                circle
                size="small"
                title="复制地址"
                aria-label="复制地址"
                @click="copyAddress(server)"
              >
                <template #icon><UiIcon name="copy" :size="15" /></template>
              </NButton>
              <NButton quaternary circle size="small" title="编辑" aria-label="编辑" @click="edit(server)">
                <template #icon><UiIcon name="settings" :size="15" /></template>
              </NButton>
              <NButton
                quaternary
                circle
                size="small"
                type="error"
                title="删除"
                aria-label="删除"
                @click="remove(server)"
              >
                <template #icon><UiIcon name="trash" :size="15" /></template>
              </NButton>
            </div>
          </article>
        </div>
      </div>
    </InstanceContentState>
    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :content="confirmContent"
      :loading="confirmLoading"
      :danger="confirmDanger"
      :closeOnConfirm="false"
      @confirm="handleConfirm"
    />
    <Modal v-model:visible="editorVisible" :title="form.id ? '编辑服务器' : '添加服务器'" width="480px"
      ><div class="server-form">
        <label>名称<NInput v-model:value="form.name" /></label
        ><label>地址<NInput v-model:value="form.address" placeholder="play.example.com:25565" /></label
        ><label><NSwitch v-model:value="form.favorite" /> 收藏服务器</label>
      </div>
      <template #footer
        ><NButton @click="editorVisible = false">取消</NButton
        ><NButton type="primary" @click="save">保存</NButton></template
      ></Modal
    >
  </section>
</template>

<script setup lang="ts">
import { NButton, NInput, NSwitch } from 'naive-ui'
import { computed, reactive, ref, watch } from 'vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import { useRequestScope } from '@/composables/useRequestScope'
import { instanceKey } from '@/composables/useResourceInstallTarget'
import { instanceWorkspaceApi, workspaceTarget } from '@/features/instances/api/instanceWorkspaceApi'
import type { ScannedVersion, ServerEntry, ServerStatus } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'
import InstanceContentState from './InstanceContentState.vue'
const props = defineProps<{ version: ScannedVersion }>()
const message = useLauncherMessage()
const servers = ref<ServerEntry[]>([])
const statuses = reactive<Record<string, ServerStatus>>({})
const loading = ref(false)
const statusLoading = ref(false)
const failedIcons = reactive(new Set<string>())
function iconSource(server: ServerEntry): string | undefined {
  for (const raw of [statuses[server.address]?.icon, server.icon]) {
    if (typeof raw !== 'string' || raw.length > 350000) continue
    const data = raw.replace(/^data:image\/png;base64,/, '')
    if (!data.startsWith('iVBORw0KGgo') || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) continue
    const source = `data:image/png;base64,${data}`
    if (!failedIcons.has(source)) return source
  }
  return undefined
}
const query = ref('')
const editorVisible = ref(false)
const form = reactive<{ id?: string; name: string; address: string; favorite: boolean }>({
  name: '',
  address: '',
  favorite: false,
})
const target = computed(() => workspaceTarget(props.version))
const serverRequests = useRequestScope(() => instanceKey(props.version))
const statusRequests = useRequestScope(() => instanceKey(props.version))
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return servers.value.filter(
    (s) => !needle || `${s.name} ${s.address} ${statuses[s.address]?.motd || ''}`.toLocaleLowerCase().includes(needle)
  )
})
function statusOf(server: ServerEntry): ServerStatus | undefined {
  return statuses[server.address]
}
function statusClass(server: ServerEntry): string {
  if (statusLoading.value) return 'unknown'
  const st = statusOf(server)
  if (!st) return 'unknown'
  if (st.online) return 'online'
  return 'offline'
}
function statusLabel(server: ServerEntry): string {
  if (statusLoading.value) return '正在查询状态'
  const st = statusOf(server)
  if (!st) return '尚未查询状态'
  if (st.online) return '在线'
  return st.error || '离线'
}
function motdText(server: ServerEntry): string {
  if (statusLoading.value) return '正在查询状态'
  const st = statusOf(server)
  if (!st) return '尚未查询状态'
  return st.motd || st.error || '无 MOTD'
}
function latencyClass(server: ServerEntry): string {
  const ms = statusOf(server)?.latency ?? 0
  if (ms <= 0) return ''
  if (ms < 80) return 'good'
  if (ms < 200) return 'ok'
  return 'bad'
}
async function load() {
  const isCurrent = serverRequests.begin()
  const requestedTarget = target.value
  loading.value = true
  try {
    const loaded = await instanceWorkspaceApi.servers(requestedTarget)
    if (isCurrent()) servers.value = loaded
  } catch (reason) {
    if (isCurrent()) message.error(reason instanceof Error ? reason.message : '读取服务器失败')
  } finally {
    if (isCurrent()) loading.value = false
  }
}
async function reload() {
  instanceWorkspaceApi.invalidateCache(target.value, 'servers')
  await load()
}
async function refreshStatus() {
  const isCurrent = statusRequests.begin()
  statusLoading.value = true
  try {
    const addresses = [...new Set(servers.value.map((server) => server.address))]
    for (let offset = 0; offset < addresses.length; offset += 64) {
      const loaded = await instanceWorkspaceApi.serverStatuses(addresses.slice(offset, offset + 64))
      if (!isCurrent()) return
      for (const status of loaded) statuses[status.address] = status
    }
  } catch (reason) {
    if (isCurrent()) message.error(reason instanceof Error ? reason.message : '查询服务器失败')
  } finally {
    if (isCurrent()) statusLoading.value = false
  }
}
function edit(server?: ServerEntry) {
  form.id = server?.id
  form.name = server?.name || ''
  form.address = server?.address || ''
  form.favorite = Boolean(server?.favorite)
  editorVisible.value = true
}
async function save() {
  if (!form.name.trim() || !form.address.trim()) return message.warning('请填写服务器名称和地址')
  await instanceWorkspaceApi.saveServer(target.value, { ...form })
  editorVisible.value = false
  await load()
}
async function connect(server: ServerEntry) {
  await instanceWorkspaceApi.launchServer(target.value, server.address)
  message.success(`正在连接 ${server.name}`)
}
async function copyAddress(server: ServerEntry) {
  await navigator.clipboard.writeText(server.address)
  message.success('地址已复制')
}
function remove(server: ServerEntry) {
  openConfirm(
    '删除服务器',
    `从 servers.dat 删除“${server.name}”？`,
    async () => {
      await instanceWorkspaceApi.deleteServer(target.value, server.id)
      await load()
    },
    true
  )
}
watch(
  () => instanceKey(props.version),
  async () => {
    const key = instanceKey(props.version)
    servers.value = []
    for (const address of Object.keys(statuses)) delete statuses[address]
    failedIcons.clear()
    editorVisible.value = false
    await load()
    if (key === instanceKey(props.version)) await refreshStatus()
  },
  { immediate: true }
)

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmDanger = ref(false)
const confirmLoading = ref(false)
let confirmAction: (() => Promise<void>) | null = null

function openConfirm(title: string, content: string, action: () => Promise<void>, danger = false) {
  confirmTitle.value = title
  confirmContent.value = content
  confirmDanger.value = danger
  confirmAction = action
  confirmLoading.value = false
  confirmVisible.value = true
}

async function handleConfirm() {
  if (!confirmAction || confirmLoading.value) return
  confirmLoading.value = true
  try {
    await confirmAction()
    confirmVisible.value = false
    confirmAction = null
  } catch (error) {
    // 确认动作失败保持弹窗打开并提示，避免静默的未处理 rejection
    console.error('[InstanceServersTab] 确认操作失败:', error)
    message.error(getErrorMessage(error, '操作失败'))
  } finally {
    confirmLoading.value = false
  }
}
</script>

<style scoped>
.servers-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  container-type: inline-size;
  overflow: hidden;
  background: var(--ecl-surface);
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
  box-shadow: var(--ecl-shadow-surface);
}
.servers-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ecl-border);
}
.servers-toolbar > .n-input {
  flex: 1;
  min-width: 180px;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  margin-left: auto;
}
.toolbar-primary-btn {
  margin-left: 12px;
}
.servers-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px 12px;
}
.server-list {
  display: flex;
  flex-direction: column;
}
.server-row {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: minmax(0, 1fr) 150px auto;
  grid-template-areas: 'main status actions';
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 72px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-control);
  transition: background var(--duration-fast) var(--ease-emphasized);
}
.server-row:last-child {
  border-bottom: 0;
}
.server-row:hover {
  background: var(--ecl-hover);
}
.server-row-main {
  grid-area: main;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.server-icon {
  display: flex;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: var(--ecl-radius-control);
  color: var(--ecl-primary);
}
.server-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.server-status {
  grid-area: status;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.server-status-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ecl-text-secondary);
}
.server-status-label.online {
  color: var(--success);
}
.server-status-label.offline {
  color: var(--error);
}
.status-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--ecl-text-tertiary);
}
.status-dot.online {
  background: var(--success);
}
.status-dot.offline {
  background: var(--error);
}
.server-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.server-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.server-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ecl-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.server-fav {
  flex-shrink: 0;
  color: var(--warning);
  font-size: 13px;
}
.server-address {
  font-size: 12px;
  color: var(--ecl-text-secondary);
  font-family: 'JetBrains Mono', 'Consolas', 'Cascadia Code', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.server-motd {
  margin: 0;
  font-size: 12px;
  color: var(--ecl-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.server-badges {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.server-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--ecl-hover);
  color: var(--ecl-text-secondary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.server-badge.players {
  color: var(--success);
}
.server-badge.latency.good {
  color: var(--success);
}
.server-badge.latency.ok {
  color: var(--warning);
}
.server-badge.latency.bad {
  color: var(--error);
}
.server-badge.version {
  display: block;
  font-family: 'JetBrains Mono', 'Consolas', 'Cascadia Code', monospace;
}
.server-actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  flex-shrink: 0;
}
@container (max-width: 680px) {
  .server-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'main actions' 'status actions';
    gap: 6px 8px;
    padding: 8px;
  }
  .server-status {
    margin-left: 42px;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  .server-connect-label {
    display: none;
  }
  .server-connect {
    width: 28px;
    padding: 0;
  }
  .server-connect :deep(.n-button__icon) {
    margin: 0;
  }
  .server-actions {
    gap: 2px;
  }
}
.server-form {
  display: grid;
  gap: 14px;
}
.server-form label {
  display: flex;
  align-items: center;
  gap: 12px;
}
.server-form .n-input {
  flex: 1;
}
</style>
