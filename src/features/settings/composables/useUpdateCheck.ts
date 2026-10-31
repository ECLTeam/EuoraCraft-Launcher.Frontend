import { computed, readonly, ref } from 'vue'
import backend from '@/api/client'
import type { UpdateCheckResult } from '@/types/system'
import { updateApi } from '../api/updateApi'

/** 最近一次版本检测的结果，启动自动检测与手动检测共用同一份状态。 */
const lastResult = ref<UpdateCheckResult | null>(null)
const checking = ref(false)
/** 启动检查与“关于”页共用的更新弹窗开关，由 App 根节点统一渲染。 */
const updateDialogVisible = ref(false)

/** 当前运行形态是否允许自动更新（打包运行且通道在白名单内）。 */
const selfUpdateEnabled = ref(false)

/** 是否正在下载更新包。 */
const downloading = ref(false)

/** 下载进度描述，percentage 为 -1 表示表头未知。 */
const progress = ref({ received: 0, total: 0, percentage: -1, filename: '' })

let progressUnlisten: (() => void) | null = null
function bindProgressListener(): void {
  if (progressUnlisten || !backend.runtime.isDesktop) return
  progressUnlisten = backend.on('update:progress', (payload) => {
    if (!payload) return
    progress.value = {
      received: payload.received,
      total: payload.total,
      percentage: payload.total > 0 ? Math.min(100, Math.round((payload.received / payload.total) * 100)) : -1,
      filename: payload.name || '',
    }
    if (payload.phase === 'complete') {
      downloading.value = false
    }
  })
}
if (backend.runtime.isDesktop) {
  bindProgressListener()
  void updateApi
    .updateStatus()
    .then((status) => {
      selfUpdateEnabled.value = Boolean(status?.enabled)
    })
    .catch(() => {
      // 启动时读取更新状态失败不影响手动检查，保留"不支持自更新"的默认值。
      selfUpdateEnabled.value = false
    })
}

async function checkUpdate(): Promise<UpdateCheckResult | null> {
  if (checking.value) return null
  checking.value = true
  try {
    const result = await updateApi.checkUpdate()
    if (result) lastResult.value = result
    return result
  } finally {
    checking.value = false
  }
}

/** 接收后端进程启动时执行的单次更新检测结果。 */
function setStartupCheckResult(result: UpdateCheckResult): void {
  lastResult.value = result
}

/** 下载当前通道最新版本并落盘替换计划，返回目标版本号。 */
async function downloadUpdate(): Promise<string | null> {
  if (downloading.value) return null
  downloading.value = true
  progress.value = { received: 0, total: 0, percentage: -1, filename: '' }
  try {
    const result = await updateApi.downloadUpdate()
    return result?.version ?? null
  } finally {
    downloading.value = false
  }
}

/** 拉起更新引导脚本并请求启动器重启以完成替换。 */
async function applyUpdate(): Promise<boolean> {
  const result = await updateApi.applyUpdate()
  return Boolean(result?.restarting)
}

const downloadPercent = computed(() => progress.value.percentage)

export function useUpdateCheck() {
  return {
    lastResult: readonly(lastResult),
    checking: readonly(checking),
    updateDialogVisible,
    selfUpdateEnabled: readonly(selfUpdateEnabled),
    downloading: readonly(downloading),
    progress: readonly(progress),
    downloadPercent,
    checkUpdate,
    setStartupCheckResult,
    downloadUpdate,
    applyUpdate,
  }
}
