import backend from '@/api/client'

export const windowApi = {
  async open(descriptorId: string, sessionId?: string, instanceKey?: string) {
    const response = await backend.command('window_open', {
      descriptor_id: descriptorId,
      session_id: sessionId,
      instance_key: instanceKey,
    })
    if (!response.success || !response.data) throw new Error(response.message || '打开窗口失败')
    return response.data
  },
  async list() {
    const response = await backend.command('window_list')
    if (!response.success) throw new Error(response.message || '读取窗口列表失败')
    return response.data ?? []
  },
  async close(label: string) {
    const response = await backend.command('window_close', { label })
    if (!response.success) throw new Error(response.message || '关闭窗口失败')
  },
  async focus(label: string) {
    const response = await backend.command('window_focus', { label })
    if (!response.success) throw new Error(response.message || '聚焦窗口失败')
  },
}
