import { defineStore } from 'pinia'
import { ref } from 'vue'
import { pinia } from '@/app/stores'
import type { GameOperation } from '@/types/instances'

const defineCustomDownloadStore = defineStore('customDownload', () => {
  const url = ref('')
  const downloadDirectory = ref('')
  const namingMode = ref<'original' | 'custom'>('original')
  const customName = ref('')
  const userAgent = ref('')
  const defaultUserAgent = ref('EuoraCraft-Launcher')
  const headers = ref<{ id: number; name: string; value: string }[]>([])
  const nextHeaderId = ref(0)
  const overwrite = ref(false)
  const operationId = ref('')
  const operation = ref<GameOperation | null>(null)
  return {
    url,
    downloadDirectory,
    namingMode,
    customName,
    userAgent,
    defaultUserAgent,
    headers,
    nextHeaderId,
    overwrite,
    operationId,
    operation,
  }
})

/** 保留本次会话的下载表单与任务，切换页面后可继续取消或重试。 */
export const useCustomDownloadStore = () => defineCustomDownloadStore(pinia)
