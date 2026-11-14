import { ref } from 'vue'

/**
 * 为原生选择按钮提供在途状态。
 *
 * 系统选择对话框打开期间重复点击不应再次发起请求：`pick` 在途时直接返回 null，
 * `pending` 供按钮绑定 loading 与 disabled，避免用户以为没有响应而连点。
 * @returns pending 状态与执行函数 pick
 */
export function useNativePicker() {
  const pending = ref(false)

  /**
   * 在独占状态下执行一次选择动作。
   * @param action - 发起选择并等待结果的动作
   * @returns 动作返回值；已有选择在进行中时返回 null
   */
  async function pick<T>(action: () => Promise<T>): Promise<T | null> {
    if (pending.value) return null
    pending.value = true
    try {
      return await action()
    } finally {
      pending.value = false
    }
  }

  return { pending, pick }
}
