<template>
  <section class="worlds-panel">
    <header class="worlds-toolbar">
      <NInput v-model:value="query" clearable size="small" placeholder="搜索世界名称、目录、种子或版本" />
      <NSelect v-model:value="sortKey" :options="sortOptions" size="small" class="sort-select" />
      <div class="worlds-toolbar-actions">
        <NButton quaternary circle size="small" :loading="loading" title="刷新" aria-label="刷新" @click="load">
          <template #icon><UiIcon name="refresh" :size="16" /></template>
        </NButton>
        <NButton quaternary circle size="small" title="游戏设置" aria-label="游戏设置" @click="editOptions">
          <template #icon><UiIcon name="settings" :size="16" /></template>
        </NButton>
        <NButton quaternary circle size="small" title="打开存档目录" aria-label="打开存档目录" @click="openFolder">
          <template #icon><UiIcon name="folder-open" :size="16" /></template>
        </NButton>
        <NDropdown trigger="click" :options="importOptions" @select="importWorld">
          <NButton size="small" type="primary" class="worlds-toolbar-primary" aria-label="导入存档">
            <template #icon><UiIcon name="upload" :size="13" /></template>
            导入
          </NButton>
        </NDropdown>
      </div>
    </header>
    <InstanceContentState :loading="loading" :empty="filtered.length === 0" emptyDescription="没有找到存档">
      <div class="world-grid">
        <article v-for="world in filtered" :key="world.id" class="world-card">
          <img v-if="world.iconPath" :src="iconUrls[world.id]" :alt="world.name" class="world-cover" />
          <div v-else class="world-cover fallback">🌍</div>
          <div class="world-copy">
            <strong>{{ world.name }}</strong
            ><small>{{ world.id }}</small>
            <div class="world-badges">
              <span>{{ world.gameMode || '未知模式' }}</span
              ><span>{{ world.difficulty || '未知难度' }}</span
              ><span>{{ world.version || '未知版本' }}</span>
            </div>
            <p :title="world.seedError || undefined">
              种子 {{ normalizeWorldSeed(world.seed) ?? '未知' }} · 上次游玩 {{ formatDate(world.lastPlayedAt) }}
            </p>
            <p v-if="world.error" class="world-error">{{ world.error }}</p>
          </div>
          <div class="world-actions">
            <NButton quaternary circle size="tiny" type="primary" title="快速进入" @click="quickPlay(world)">
              <template #icon><UiIcon name="player-play" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" title="备份" @click="backup(world)">
              <template #icon><UiIcon name="archive" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" title="难度与作弊" @click="editWorld(world)">
              <template #icon><UiIcon name="settings" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" title="恢复" @click="manageBackups(world)">
              <template #icon><UiIcon name="rotate-2" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" title="图标" @click="setIcon(world)">
              <template #icon><UiIcon name="photo" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" title="复制" @click="copyWorld(world)">
              <template #icon><UiIcon name="copy" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" title="导出" @click="exportWorld(world)">
              <template #icon><UiIcon name="file-download" :size="14" /></template>
            </NButton>
            <NButton
              quaternary
              circle
              size="tiny"
              title="Chunkbase"
              :disabled="normalizeWorldSeed(world.seed) === undefined"
              @click="chunkbase(world)"
            >
              <template #icon><UiIcon name="external-link" :size="14" /></template>
            </NButton>
            <NButton quaternary circle size="tiny" type="error" title="删除" @click="remove(world)">
              <template #icon><UiIcon name="trash" :size="14" /></template>
            </NButton>
          </div>
        </article>
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
    <Modal v-model:visible="editorVisible" title="世界设置" width="520px">
      <div class="world-editor">
        <label>游戏模式<NSelect v-model:value="editor.gameMode" :options="gameModeOptions" /></label>
        <label>难度<NSelect v-model:value="editor.difficulty" :options="difficultyOptions" /></label>
        <label>出生点 X<NInputNumber v-model:value="editor.spawnX" :min="-30000000" :max="30000000" /></label>
        <label>出生点 Y<NInputNumber v-model:value="editor.spawnY" :min="-30000000" :max="30000000" /></label>
        <label>出生点 Z<NInputNumber v-model:value="editor.spawnZ" :min="-30000000" :max="30000000" /></label>
        <label
          >世界种子<NInput v-model:value="editor.seed" :disabled="!seedCanEdit" placeholder="完整整数种子" />
          <small v-if="!seedCanEdit">{{ editing?.seedError || '无法读取世界种子，保留原存档数据' }}</small>
        </label>
        <div class="world-editor-row">
          <label><NSwitch v-model:value="editor.allowCommands" /> 允许作弊</label>
          <label><NSwitch v-model:value="editor.difficultyLocked" /> 锁定难度</label>
          <label><NSwitch v-model:value="editor.raining" /> 下雨</label>
          <label><NSwitch v-model:value="editor.thundering" /> 雷暴</label>
        </div>
      </div>
      <template #footer
        ><NButton @click="editorVisible = false">取消</NButton
        ><NButton type="primary" :loading="savingWorld" @click="saveWorld">保存（自动备份）</NButton></template
      >
    </Modal>
    <Modal v-model:visible="backupsVisible" title="存档备份" width="660px">
      <div class="backup-list">
        <div v-for="backupItem in backups" :key="backupItem.id">
          <span
            ><strong>{{ backupItem.createdAt || backupItem.id }}</strong
            ><small
              >{{ backupItem.automatic ? '自动备份' : '手动备份' }} · {{ Math.ceil(backupItem.size / 1024) }} KiB</small
            ></span
          ><NButton size="tiny" @click="toggleBackupLock(backupItem)">{{ backupItem.locked ? '解锁' : '锁定' }}</NButton
          ><NButton size="tiny" type="primary" @click="restoreBackup(backupItem)">恢复</NButton
          ><NButton size="tiny" type="error" secondary @click="deleteBackup(backupItem)">删除</NButton>
        </div>
      </div>
    </Modal>
    <Modal v-model:visible="optionsVisible" title="游戏设置" width="560px">
      <InstanceContentState
        :loading="optionsLoading"
        :empty="optionsEntries.length === 0"
        emptyDescription="没有检测到可编辑的游戏设置"
      >
        <div class="options-editor">
          <div v-for="entry in optionsEntries" :key="entry.key" class="options-row">
            <span class="options-label">{{ optionLabel(entry.key) }}</span>
            <NSwitch
              v-if="entry.type === 'bool'"
              :value="optionValues[entry.key] === true"
              @update:value="optionValues[entry.key] = $event"
            />
            <NInputNumber
              v-else-if="entry.type === 'int' || entry.type === 'float'"
              :value="Number(optionValues[entry.key])"
              :min="entry.min"
              :max="entry.max"
              :step="entry.type === 'float' ? 0.1 : 1"
              @update:value="optionValues[entry.key] = ($event ?? 0) as number"
            />
            <NInput
              v-else
              :value="String(optionValues[entry.key] ?? '')"
              @update:value="optionValues[entry.key] = $event"
            />
          </div>
        </div>
      </InstanceContentState>
      <template #footer
        ><NButton @click="optionsVisible = false">取消</NButton
        ><NButton type="primary" :loading="savingOptions" :disabled="!optionsEntries.length" @click="saveOptions"
          >保存设置</NButton
        ></template
      >
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { NButton, NDropdown, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import backend from '@/api/client'
import { unwrapResponse } from '@/app/runtime/errorPresentation'
import ConfirmDialog from '@/components/modals/ConfirmDialog.vue'
import Modal from '@/components/modals/Modal.vue'
import UiIcon from '@/components/ui/Icon.vue'
import { useLauncherMessage } from '@/composables/useLauncherMessage'
import {
  instanceWorkspaceApi,
  workspaceTarget,
  type GameOptionEntry,
} from '@/features/instances/api/instanceWorkspaceApi'
import { normalizeWorldSeed } from '@/features/instances/worldSeeds'
import type { ScannedVersion, WorldEntry, WorldPatch } from '@/types/instances'
import { getErrorMessage } from '@/utils/error'
import InstanceContentState from './InstanceContentState.vue'

const props = defineProps<{ version: ScannedVersion }>()
const emit = defineEmits<{ changed: [worlds: WorldEntry[]] }>()
const message = useLauncherMessage()
const worlds = ref<WorldEntry[]>([])
const loading = ref(false)
const query = ref('')
const sortKey = ref<'name' | 'modifiedAt' | 'lastPlayedAt' | 'createdAt'>('modifiedAt')
const iconUrls = reactive<Record<string, string>>({})
const editorVisible = ref(false)
const editing = ref<WorldEntry | null>(null)
const savingWorld = ref(false)
const seedCanEdit = computed(
  () => editing.value?.seedEditable !== false && normalizeWorldSeed(editing.value?.seed) !== undefined
)
const editor = reactive({
  difficulty: 2,
  gameMode: 0,
  allowCommands: false,
  difficultyLocked: false,
  raining: false,
  thundering: false,
  seed: '',
  spawnX: 0,
  spawnY: 64,
  spawnZ: 0,
})
const backupsVisible = ref(false)
const backupWorld = ref<WorldEntry | null>(null)
const backups = ref<Array<{ id: string; createdAt?: string; locked: boolean; automatic: boolean; size: number }>>([])
const optionsVisible = ref(false)
const optionsLoading = ref(false)
const savingOptions = ref(false)
const optionsEntries = ref<GameOptionEntry[]>([])
const optionValues = reactive<Record<string, number | string | boolean>>({})
const target = computed(() => workspaceTarget(props.version))
const sortOptions = [
  { label: '名称', value: 'name' },
  { label: '修改时间', value: 'modifiedAt' },
  { label: '上次游玩', value: 'lastPlayedAt' },
  { label: '创建时间', value: 'createdAt' },
]
const gameModeOptions = [
  { label: '生存', value: 0 },
  { label: '创造', value: 1 },
  { label: '冒险', value: 2 },
  { label: '旁观', value: 3 },
]
const difficultyOptions = [
  { label: '和平', value: 0 },
  { label: '简单', value: 1 },
  { label: '普通', value: 2 },
  { label: '困难', value: 3 },
]
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return [...worlds.value]
    .filter((w) => !needle || `${w.name} ${w.id} ${w.seed} ${w.version}`.toLocaleLowerCase().includes(needle))
    .sort((a, b) =>
      sortKey.value === 'name'
        ? a.name.localeCompare(b.name)
        : String(b[sortKey.value] || '').localeCompare(String(a[sortKey.value] || ''))
    )
})
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '从未游玩')
async function load() {
  loading.value = true
  try {
    worlds.value = await instanceWorkspaceApi.worlds(target.value)
    emit('changed', worlds.value)
    for (const world of worlds.value) {
      if (world.iconPath) iconUrls[world.id] = (await backend.file.toUrl(world.iconPath)) || ''
    }
  } finally {
    loading.value = false
  }
}
async function openFolder() {
  await instanceWorkspaceApi.folders(target.value, 'saves')
}
async function quickPlay(world: WorldEntry) {
  try {
    await instanceWorkspaceApi.launchWorld(target.value, world.id)
    message.success(`正在进入 ${world.name}`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '该版本不支持快速进入世界')
  }
}
function editWorld(world: WorldEntry) {
  editing.value = world
  editor.difficulty = world.difficultyId ?? 2
  editor.gameMode = world.gameModeId ?? 0
  editor.allowCommands = Boolean(world.allowCommands)
  editor.difficultyLocked = Boolean(world.difficultyLocked)
  editor.raining = Boolean(world.weather?.raining)
  editor.thundering = Boolean(world.weather?.thundering)
  editor.seed = normalizeWorldSeed(world.seed) ?? ''
  editor.spawnX = world.spawn?.x ?? 0
  editor.spawnY = world.spawn?.y ?? 64
  editor.spawnZ = world.spawn?.z ?? 0
  editorVisible.value = true
}
async function saveWorld() {
  if (!editing.value || savingWorld.value) return
  const patch: WorldPatch = {
    difficulty: editor.difficulty,
    gameMode: editor.gameMode,
    allowCommands: editor.allowCommands,
    difficultyLocked: editor.difficultyLocked,
    raining: editor.raining,
    thundering: editor.thundering,
    spawn: { x: editor.spawnX, y: editor.spawnY, z: editor.spawnZ },
  }
  if (seedCanEdit.value && editor.seed !== normalizeWorldSeed(editing.value.seed)) {
    const seed = normalizeWorldSeed(editor.seed)
    if (seed === undefined) return message.error('种子必须是有符号 64 位范围内的完整整数')
    patch.seed = seed
  }
  savingWorld.value = true
  try {
    await instanceWorkspaceApi.patchWorld(target.value, editing.value.id, patch)
    editorVisible.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error, '保存存档失败'))
  } finally {
    savingWorld.value = false
  }
}
async function backup(world: WorldEntry) {
  await instanceWorkspaceApi.backupWorld(target.value, world.id)
  message.success('备份已创建')
}
async function manageBackups(world: WorldEntry) {
  backupWorld.value = world
  backups.value = await instanceWorkspaceApi.worldBackups(target.value, world.id)
  backupsVisible.value = true
}
async function editOptions() {
  optionsVisible.value = true
  optionsLoading.value = true
  try {
    const result = await instanceWorkspaceApi.readOptions(target.value)
    optionsEntries.value = result.options
    for (const key in optionValues) delete optionValues[key]
    for (const entry of result.options) optionValues[entry.key] = entry.value
  } finally {
    optionsLoading.value = false
  }
}
async function saveOptions() {
  if (!optionsEntries.value.length) return
  savingOptions.value = true
  try {
    await instanceWorkspaceApi.patchOptions(target.value, { ...optionValues })
    message.success('游戏设置已保存')
    optionsVisible.value = false
  } finally {
    savingOptions.value = false
  }
}
function optionLabel(key: string) {
  const labels: Record<string, string> = {
    language: '语言',
    fullscreen: '全屏',
    vsync: '垂直同步',
    renderDistance: '渲染距离',
    guiScale: '界面缩放',
    fov: '视野',
    sensitivity: '鼠标灵敏度',
    mouseSensitivity: '鼠标灵敏度',
    gamma: '亮度',
    difficulty: '难度',
    particles: '粒子效果',
    clouds: '云层',
  }
  if (key.startsWith('soundCategory_')) return `音量·${key.slice('soundCategory_'.length)}`
  return labels[key] ?? key
}
async function toggleBackupLock(item: { id: string; locked: boolean }) {
  if (!backupWorld.value) return
  await instanceWorkspaceApi.lockWorldBackup(target.value, backupWorld.value.id, item.id, !item.locked)
  await manageBackups(backupWorld.value)
}
function restoreBackup(item: { id: string }) {
  if (!backupWorld.value) return
  openConfirm('恢复存档', '恢复前会完整验证备份，当前存档仅在验证成功后被替换。', async () => {
    await instanceWorkspaceApi.restoreWorldBackup(target.value, backupWorld.value!.id, item.id)
    message.success('恢复任务已创建')
  })
}
async function deleteBackup(item: { id: string }) {
  if (!backupWorld.value) return
  await instanceWorkspaceApi.deleteWorldBackup(target.value, backupWorld.value.id, item.id)
  await manageBackups(backupWorld.value)
}
async function setIcon(world: WorldEntry) {
  const selected = unwrapResponse(await backend.command('select_image', { purpose: 'instance_icon' }), '选择世界图标')
  if (selected.path) {
    await instanceWorkspaceApi.setWorldIcon(target.value, world.id, selected.path)
    await load()
  }
}
function copyWorld(world: WorldEntry) {
  openConfirm('复制存档', `将创建 ${world.id}-copy`, async () => {
    await instanceWorkspaceApi.copyWorld(target.value, world.id, `${world.id}-copy`)
    message.success('复制任务已创建')
  })
}
const importOptions = [
  { label: 'ZIP 文件', key: 'world-import' },
  { label: '存档文件夹', key: 'world-import-folder' },
]
async function importWorld(purpose: 'world-import' | 'world-import-folder') {
  const selected = unwrapResponse(await backend.command('select_file', { purpose }), '选择存档')
  if (selected.path) {
    await instanceWorkspaceApi.importWorld(target.value, selected.path)
    message.success('导入任务已创建')
  }
}
async function exportWorld(world: WorldEntry) {
  const selected = unwrapResponse(
    await backend.command('select_save_file', { purpose: 'world-export' }),
    '选择导出位置'
  )
  if (selected.path) {
    await instanceWorkspaceApi.exportWorld(target.value, world.id, selected.path)
    message.success('导出任务已创建')
  }
}
function remove(world: WorldEntry) {
  openConfirm(
    '删除存档',
    `删除存档“${world.name}”？该操作不可恢复。`,
    async () => {
      await instanceWorkspaceApi.deleteWorld(target.value, world.id)
      await load()
    },
    true
  )
}
async function chunkbase(world: WorldEntry) {
  const seed = normalizeWorldSeed(world.seed)
  if (seed === undefined) return message.error('无法读取世界种子')
  const url = `https://www.chunkbase.com/apps/seed-map#seed=${encodeURIComponent(seed)}&platform=java_${encodeURIComponent(world.version || '')}`
  await backend.command('open_url', { url })
}

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
  } finally {
    confirmLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.worlds-panel {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  overflow: hidden;
  background: var(--ecl-surface);
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
  box-shadow: var(--ecl-shadow-surface);
}

.worlds-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ecl-border);
}

.worlds-toolbar > .n-input {
  flex: 1;
  min-width: 180px;
}

.worlds-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: nowrap;
}

.worlds-toolbar-primary {
  margin-left: 12px;
}

.sort-select {
  width: 150px;
}

.world-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  padding: 12px;
}

.world-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
  background: var(--ecl-surface);
  transition:
    border-color var(--duration-fast) var(--ease-emphasized),
    background var(--duration-fast) var(--ease-emphasized);
}

.world-card:hover {
  border-color: var(--ecl-border);
  background: var(--ecl-hover);
}

.world-cover {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  image-rendering: pixelated;
  background: var(--ecl-hover);
}

.world-cover.fallback {
  display: grid;
  place-items: center;
  font-size: 52px;
}

.world-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
  padding: 10px 12px;
}

.world-copy strong {
  overflow: hidden;
  color: var(--ecl-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-copy small,
.world-copy p {
  margin: 0;
  color: var(--ecl-text-secondary);
}

.world-copy p {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.world-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.world-badges span {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ecl-hover);
  color: var(--ecl-text-secondary);
  font-size: 11px;
}

.world-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 4px 10px 12px;
}

.world-error {
  color: #d65c5c !important;
}

.world-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.world-editor label {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.world-editor .n-select,
.world-editor .n-input-number {
  flex: 1;
  width: 100%;
}

.world-editor-row {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 14px 22px;
  padding-top: 4px;
}

.world-editor-row label {
  gap: 8px;
}

.backup-list {
  display: grid;
  gap: 8px;
}

.options-editor {
  display: grid;
  max-height: 52vh;
  overflow-y: auto;
  gap: 10px;
  padding-right: 4px;
}

.options-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.options-row .n-select,
.options-row .n-input-number,
.options-row .n-input {
  width: 220px;
}

.options-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ecl-text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backup-list > div {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--ecl-border);
  border-radius: var(--ecl-radius-card);
}

.backup-list span {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.backup-list small {
  color: var(--ecl-text-secondary);
}
</style>
