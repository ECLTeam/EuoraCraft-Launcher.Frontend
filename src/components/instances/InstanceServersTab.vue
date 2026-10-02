<template>
  <section class="servers-panel">
    <header class="servers-toolbar">
      <NInput v-model:value="query" clearable size="small" placeholder="搜索服务器名称、地址或 MOTD" />
      <div class="toolbar-actions">
        <NButton quaternary circle size="small" :loading="loading" title="刷新列表" aria-label="刷新列表" @click="load">
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
              <div :class="['status-dot', statusClass(server)]" :title="statusLabel(server)" />
              <div class="server-info">
                <div class="server-name-row">
                  <span class="server-name">{{ server.name }}</span>
                  <span v-if="server.favorite" class="server-fav">★</span>
                  <span class="server-address">{{ server.address }}</span>
                </div>
                <p class="server-motd">{{ motdText(server) }}</p>
                <div v-if="statuses[server.address]?.online" class="server-badges">
                  <span class="server-badge players">
                    <UiIcon name="users" :size="12" />
                    {{ statuses[server.address]?.playersOnline }}/{{ statuses[server.address]?.playersMax }}
                  </span>
                  <span :class="['server-badge', 'latency', latencyClass(server)]">
                    <UiIcon name="bolt" :size="12" />
                    {{ statuses[server.address]?.latency }} ms
                  </span>
                  <span v-if="statuses[server.address]?.version" class="server-badge version">
                    {{ statuses[server.address]?.version }}
                  </span>
                </div>
              </div>
            </div>
            <div class="server-actions">
              <NButton size="small" type="primary" @click="connect(server)">启动并连接</NButton>
              <NButton quaternary circle size="small" title="复制地址" @click="copyAddress(server)">
                <template #icon><UiIcon name="copy" :size="15" /></template>
              </NButton>
              <NButton quaternary circle size="small" title="编辑" @click="edit(server)">
                <template #icon><UiIcon name="settings" :size="15" /></template>
              </NButton>
              <NButton quaternary circle size="small" type="error" title="删除" @click="remove(server)">
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
import { computed, onMounted, reactive, ref } from 'vue'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
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
const query = ref('')
const editorVisible = ref(false)
const form = reactive<{ id?: string; name: string; address: string; favorite: boolean }>({
  name: '',
  address: '',
  favorite: false,
})
const target = computed(() => workspaceTarget(props.version))
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
  const st = statusOf(server)
  if (!st) return 'unknown'
  if (st.online) return 'online'
  return 'offline'
}
function statusLabel(server: ServerEntry): string {
  const st = statusOf(server)
  if (!st) return '尚未查询状态'
  if (st.online) return '在线'
  return st.error || '离线'
}
function motdText(server: ServerEntry): string {
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
  loading.value = true
  try {
    servers.value = await instanceWorkspaceApi.servers(target.value)
  } finally {
    loading.value = false
  }
}
async function refreshStatus() {
  statusLoading.value = true
  try {
    for (const status of await instanceWorkspaceApi.serverStatuses(servers.value.map((s) => s.address)))
      statuses[status.address] = status
  } finally {
    statusLoading.value = false
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
onMounted(async () => {
  await load()
  await refreshStatus()
})

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
  min-height: 420px;
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
  padding: 12px;
}
.server-list {
  display: grid;
  gap: 8px;
}
.server-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--ecl-border);
  border-radius: 10px;
  transition: background var(--duration-fast) var(--ease-emphasized);
}
.server-row:hover {
  background: var(--ecl-hover);
}
.server-row-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}
.status-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #929aa6;
}
.status-dot.online {
  background: #48b96b;
  box-shadow: 0 0 8px #48b96b;
}
.status-dot.offline {
  background: #e5484d;
}
.server-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.server-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.server-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ecl-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.server-fav {
  color: #f5a623;
  font-size: 13px;
}
.server-address {
  font-size: 12px;
  color: var(--ecl-text-secondary);
  font-family: 'JetBrains Mono', 'Consolas', 'Cascadia Code', monospace;
}
.server-motd {
  font-size: 12px;
  color: var(--ecl-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 480px;
}
.server-badges {
  display: flex;
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
}
.server-badge.players {
  color: #48b96b;
}
.server-badge.latency.good {
  color: #48b96b;
}
.server-badge.latency.ok {
  color: #f5a623;
}
.server-badge.latency.bad {
  color: #e5484d;
}
.server-badge.version {
  font-family: 'JetBrains Mono', 'Consolas', 'Cascadia Code', monospace;
}
.server-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  flex-shrink: 0;
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
