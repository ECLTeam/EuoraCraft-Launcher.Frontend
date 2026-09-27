import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import backend from '@/api/client'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import type { MinecraftPathEntry } from '@/types/config'

function derivePackName(path: string): string {
  if (!path) return ''
  const base = path.split(/[\\/]/).pop() || ''
  const stem = base.replace(/\.(zip|mrpack)$/i, '')
  return stem.replace(/[\\/:*?"<>|]/g, ' ').trim() || ''
}

export { derivePackName }

/**
 * 从拖放的 File 列表中提取首个整合包文件绝对路径（.zip / .mrpack）。
 * 供全局拖放使用；模组(.jar)/存档(.zip) 由各自面板的 @drop.prevent 先行拦截。
 */
export function extractPackPath(files: ArrayLike<File> | undefined): string | undefined {
  if (!files) return undefined
  return Array.from(files)
    .map((file) => (file as File & { path?: string }).path)
    .filter((path): path is string => Boolean(path))
    .find((path) => /\.(zip|mrpack)$/i.test(path))
}

/**
 * 在线整合包安装的预填信息：来源平台、项目与文件 ID、展示标题。
 */
export interface OnlinePackTarget {
  source: 'modrinth' | 'curseforge' | 'ftb'
  projectId: string
  fileId: string
  title: string
}

/**
 * 整合包导入对话框的全局状态。
 * 由「导入整合包」按钮与全局文件拖放共同打开；导入为全新安装，用户选择安装目录与实例名。
 * 在线安装（下载页整合包 Tab）复用同一对话框，仅预填来源与文件标识，跳过本地文件选择。
 */
export const useModpackImportStore = defineStore('modpackImport', () => {
  const visible = ref(false)
  const sourcePath = ref('')
  const versionName = ref('')
  const gamePath = ref('')
  const gamePaths = ref<{ value: string; label: string }[]>([])
  const importing = ref(false)
  const onlinePack = ref<OnlinePackTarget | null>(null)

  const isOnline = computed(() => Boolean(onlinePack.value))
  const onlineTitle = computed(() => onlinePack.value?.title || '')
  const canImport = computed(() =>
    onlinePack.value
      ? Boolean(versionName.value.trim() && gamePath.value)
      : Boolean(sourcePath.value && versionName.value.trim() && gamePath.value)
  )

  async function loadGamePaths(): Promise<string> {
    const settings = useSettingsStore()
    try {
      if (settings.status !== 'ready') await settings.load()
    } catch {
      /* 配置读取失败时退回空路径列表 */
    }
    const paths = settings.game.minecraft_paths || []
    gamePaths.value = paths.map((p: MinecraftPathEntry) => {
      const pathStr = typeof p === 'string' ? p : p.path || ''
      const label = typeof p === 'object' && p.name ? p.name : pathStr.split(/[\\/]/).pop() || '游戏目录'
      return { value: pathStr, label }
    })
    if (settings.game.last_install_path) return settings.game.last_install_path
    const first = paths[0]
    if (first) return typeof first === 'string' ? first : first.path || ''
    return ''
  }

  async function open(opts?: { sourcePath?: string }) {
    onlinePack.value = null
    sourcePath.value = opts?.sourcePath || ''
    versionName.value = derivePackName(sourcePath.value)
    importing.value = false
    gamePath.value = await loadGamePaths()
    visible.value = true
  }

  /** 打开在线整合包安装对话框：预填来源与文件，跳过本地文件选择。 */
  async function openOnline(target: OnlinePackTarget) {
    onlinePack.value = { ...target }
    sourcePath.value = ''
    versionName.value = target.title
    importing.value = false
    gamePath.value = await loadGamePaths()
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  function setSource(path: string) {
    sourcePath.value = path
    if (!versionName.value) versionName.value = derivePackName(path)
  }

  async function importPack(): Promise<{ ok: boolean; error?: string }> {
    if (!canImport.value || importing.value) return { ok: false }
    importing.value = true
    try {
      if (onlinePack.value) {
        const response = await backend.command('game_modpack_online_install', {
          source: onlinePack.value.source,
          project_id: onlinePack.value.projectId,
          file_id: onlinePack.value.fileId,
          game_path: gamePath.value,
          new_version_id: versionName.value.trim(),
        })
        if (!response.success) return { ok: false, error: response.message || '安装整合包失败' }
        visible.value = false
        return { ok: true }
      }
      const response = await backend.command('game_instance_import', {
        game_path: gamePath.value,
        source_path: sourcePath.value,
        new_version_id: versionName.value.trim(),
      })
      if (!response.success) return { ok: false, error: response.message || '导入整合包失败' }
      visible.value = false
      return { ok: true }
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : '导入整合包失败' }
    } finally {
      importing.value = false
    }
  }

  return {
    visible,
    sourcePath,
    versionName,
    gamePath,
    gamePaths,
    importing,
    onlinePack,
    isOnline,
    onlineTitle,
    canImport,
    open,
    openOnline,
    close,
    setSource,
    importPack,
  }
})
